import { describe, expect, it, vi } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS } from "./levels";
import { LEVEL_LOOKS } from "./looks";
import { beeGardenMeta as meta } from "./meta";
import { PROPOSED_LEVEL_LIMITS, TUNING, createRun } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));

describe("bee-garden levels: declarations", () => {
   it("five levels in meta and the definition, limits = PROPOSED_LEVEL_LIMITS, cleared by a win only", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(meta.levels!.map((l) => l.title)).toEqual(["Flower Garden", "Vegetable Garden", "Greenhouse", "Forest Flowers", "Giant Garden"]);
      expect(meta.levels!.every((l) => l.clearScore === undefined)).toBe(true);
      expect(meta).toMatchObject({ slug: "bee-garden", status: "dev", owner: "antigravity", collection: "skill", order: 40 });
   });

   it("each level's spec carries its own config, clock, lighting and fog (no level reads level 1)", () => {
      for (const id of LEVEL_IDS) {
         const spec = definition.levels!.find((l) => l.id === id)!;
         expect(spec.config).toBe(LEVELS[id]);
         expect(levelRunConfig(definition, id).durationMs).toBe(LEVELS[id].durationMs);
         expect(levelRunConfig(definition, id).resultDelayMs).toBe(TUNING.resultDelayMs);
         const env = levelEnvironment(definition, id)!;
         expect(env.lighting).toBe(LEVELS[id].lighting);
         expect(env.lighting).toBe(LEVEL_LOOKS[id].lighting);
         expect(env.background).toBe(LEVEL_LOOKS[id].background);
         expect(env.fog).toEqual([LEVEL_LOOKS[id].fogColor, LEVEL_LOOKS[id].fogNear, LEVEL_LOOKS[id].fogFar]);
         expect(LEVEL_LOOKS[id].beeTint).toBe(LEVELS[id].tint);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(0);
      }
      expect(definition.durationMs).toBe(LEVELS[1].durationMs);
      expect(LEVEL_IDS.map((id) => LEVELS[id].lighting)).toEqual(["day", "day", "day", "sunset", "day"]);
      // the greenhouse's closer fog is its glass
      expect(LEVEL_LOOKS[3].fogFar).toBeLessThan(LEVEL_LOOKS[2].fogFar);
   });

   it("level 1 is the spec's base garden", () => {
      expect(LEVELS[1]).toMatchObject({ width: 18, depth: 14, units: 10, webs: 0, branches: 2, breeze: false, durationMs: 120_000 });
   });

   it("difficulty never drops: more nectar, hazards and garden; every level pays at least level 1; L5 <= 3 x L1", () => {
      for (let id = 2; id <= 5; id++) {
         const a = LEVELS[(id - 1) as LevelId];
         const b = LEVELS[id as LevelId];
         expect(b.units).toBeGreaterThan(a.units);
         expect(b.webs).toBeGreaterThanOrEqual(a.webs);
         expect(b.branches).toBeGreaterThanOrEqual(a.branches);
         expect(b.width * b.depth).toBeGreaterThan(a.width * a.depth);
         expect(b.durationMs).toBeGreaterThanOrEqual(a.durationMs);
         expect(PROPOSED_LEVEL_LIMITS[id as LevelId].maxScore).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[(id - 1) as LevelId].maxScore);
         expect(PROPOSED_LEVEL_LIMITS[id as LevelId].base).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].base);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      // the time per unit never grows: later gardens are not slack
      for (let id = 2; id <= 5; id++) expect(LEVELS[id as LevelId].durationMs / LEVELS[id as LevelId].units).toBeLessThanOrEqual(LEVELS[1].durationMs / LEVELS[1].units);
   });

   it("createRun reads the level it is given (sizes, counts, clock, breeze)", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(11, LEVELS[id], id);
         expect([run.bounds.halfX * 2, run.bounds.halfZ * 2]).toEqual([LEVELS[id].width, LEVELS[id].depth]);
         expect([run.flowers.length, run.webs.length, run.branches.length]).toEqual([LEVELS[id].units, LEVELS[id].webs, LEVELS[id].branches]);
         expect(run.timeLeft * 1000).toBe(LEVELS[id].durationMs);
         expect(run.level.breeze).toBe(id === 5);
      }
   });
});
