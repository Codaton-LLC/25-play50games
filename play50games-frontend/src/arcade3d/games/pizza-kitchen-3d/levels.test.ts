import { describe, expect, it, vi } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS, LEVEL_TITLES } from "./levels";
import { pizzaKitchen3dMeta as meta } from "./meta";
import { PROPOSED_LEVEL_LIMITS, TUNING, bakeGrade, createRun, kitchenHalf, objectiveCeiling, stations, step } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));
const { default: definition } = await import("./index");

describe("pizza-kitchen-3d levels", () => {
   it("declares five levels in meta and the definition, limits equal to the proof", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      expect(meta.slug).toBe("pizza-kitchen-3d");
      expect(meta.owner).toBe("claude");
      expect(meta.collection).toBe("skill");
      expect(meta.status).toBe("dev");
      for (const id of LEVEL_IDS) {
         expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(meta.levels![id - 1].title).toBe(LEVEL_TITLES[id]);
         expect(meta.levels![id - 1].clearScore).toBeUndefined();
      }
      expect(meta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
   });

   it("difficulty never drops, every level pays at least L1, L5 <= 3 x L1", () => {
      for (const id of [2, 3, 4, 5] as LevelId[]) {
         const a = LEVELS[(id - 1) as LevelId];
         const b = LEVELS[id];
         expect(b.orders).toBeGreaterThan(a.orders);
         expect(b.toppingTypes).toBeGreaterThanOrEqual(a.toppingTypes);
         expect(b.parallel).toBeGreaterThanOrEqual(a.parallel);
         expect(b.goldenS).toBeLessThanOrEqual(a.goldenS);
         expect(stations(b).length).toBeGreaterThanOrEqual(stations(a).length);
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[(id - 1) as LevelId].maxScore);
         expect(objectiveCeiling(b)).toBeGreaterThanOrEqual(objectiveCeiling(LEVELS[1]));
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   // each level field is read: these fail if a rule ignores it (mutation probes on every read)
   for (const id of LEVEL_IDS) {
      it(`L${id}: the run is built from this level's config`, () => {
         const l = LEVELS[id];
         const r = createRun(17, l);
         expect(r.tickets.length).toBe(l.orders);
         expect(r.ovens.length).toBe(l.ovens);
         expect(r.tickets.filter((t) => t.state === "open").length).toBe(l.parallel);
         const ids = stations(l).map((s) => s.id);
         expect(ids.filter((s) => s.startsWith("oven")).length).toBe(l.ovens);
         expect(ids.includes("box")).toBe(l.boxStep);
         expect(ids.length).toBe(3 + l.toppingTypes + l.ovens + (l.boxStep ? 1 : 0) + 1);
         expect(kitchenHalf(l)).toBeCloseTo(ids.length * 0.8 + 0.4, 10);
         let most = 0;
         for (let seed = 1; seed <= 300; seed++) for (const t of createRun(seed, l).tickets) most = Math.max(most, t.ingredients.length - 2);
         expect(most).toBe(l.maxToppings);
         expect(bakeGrade(l.bakeS - 0.01, l)).toBe("raw");
         expect(bakeGrade(l.bakeS, l)).toBe("perfect");
         expect(bakeGrade(l.bakeS + l.goldenS - 0.01, l)).not.toBe("burnt");
         expect(bakeGrade(l.bakeS + l.goldenS, l)).toBe("burnt");
         // patience: the first ticket expires exactly at patienceS (never on L1-L3)
         const q = createRun(17, l);
         const end = l.patienceS > 0 ? l.patienceS : 100;
         for (let t = 0; t < end - 0.06; t += 0.05) step(q, 0.05, 0, 0, false);
         expect(q.expired).toBe(0);
         for (let i = 0; i < 4; i++) step(q, 0.05, 0, 0, false);
         expect(q.expired).toBe(l.patienceS > 0 ? l.parallel : 0);
         // the clock: an idle run ends with timeup at the level's duration
         const z = createRun(3, { ...l, patienceS: 0 });
         while (!z.end) step(z, 0.05, 0, 0, false);
         expect(z.end).toBe("timeup");
         expect(z.time).toBeCloseTo(l.durationMs / 1000, 6);
         // the definition hands the shell this level's clock, lighting and Served max
         expect(levelRunConfig(definition, id).durationMs).toBe(l.durationMs);
         expect(levelRunConfig(definition, id).resultDelayMs).toBe(TUNING.resultDelayMs);
         expect(levelEnvironment(definition, id)!.lighting).toBe(l.lighting);
         expect(levelEnvironment(definition, id)!.background).toBe(l.background);
         const spec = definition.levels!.find((s) => s.id === id)!;
         expect((spec.hudStats ?? definition.hudStats)![0].max).toBe(l.orders);
      });
   }
});
