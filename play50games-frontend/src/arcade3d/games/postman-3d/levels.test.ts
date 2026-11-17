import { describe, expect, it, vi } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { LEVEL_TITLES, LEVELS } from "./levels";
import { postman3dMeta as meta } from "./meta";
import { PROPOSED_LEVEL_LIMITS, createRun, step, streetEnd } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

describe("postman-3d levels: declarations", () => {
   it("five levels in meta and the definition, limits = PROPOSED_LEVEL_LIMITS, cleared by a win only", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(meta.levels!.map((l) => l.title)).toEqual(LEVEL_IDS.map((id) => LEVEL_TITLES[id]));
      expect(meta.levels!.every((l) => l.clearScore === undefined)).toBe(true);
      expect(meta).toMatchObject({ slug: "postman-3d", status: "dev", owner: "claude", collection: "skill", order: 50 });
   });

   it("each level's spec carries its own config, clock, lives, lighting and HUD maxima", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const spec = definition.levels!.find((l) => l.id === id)!;
         expect(spec.config).toBe(level);
         const cfg = levelRunConfig(definition, id);
         expect(cfg.durationMs).toBe(level.durationMs);
         expect(cfg.lives).toBe(level.lives);
         expect(cfg.resultDelayMs).toBe(900);
         const env = levelEnvironment(definition, id)!;
         expect(env.lighting).toBe(level.lighting);
         expect(env.background).toBe(level.background);
         const stats = levelHudStats(definition, id)!;
         expect(stats.find((s) => s.key === "delivered")!.max).toBe(level.letters + level.parcels);
         expect(stats.find((s) => s.key === "bag")!.max).toBe(level.bagCap);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(2);
      }
      expect(LEVEL_IDS.map((id) => LEVELS[id].lighting)).toEqual(["day", "day", "sunset", "day", "night"]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].markers)).toEqual([true, true, false, false, false]);
   });

   it("item counts are the plan's 4, 6, 8, 10, 14", () => {
      expect(LEVEL_IDS.map((id) => LEVELS[id].letters + LEVELS[id].parcels)).toEqual([4, 6, 8, 10, 14]);
   });

   it("difficulty never drops: more streets, houses, items, hazards; every level pays at least level 1; L5 <= 3 x L1", () => {
      for (let id = 2; id <= 5; id++) {
         const a = LEVELS[(id - 1) as LevelId];
         const b = LEVELS[id as LevelId];
         expect(b.streets).toBeGreaterThanOrEqual(a.streets);
         expect(b.streets * b.housesPerStreet).toBeGreaterThanOrEqual(a.streets * a.housesPerStreet);
         expect(b.letters + b.parcels).toBeGreaterThan(a.letters + a.parcels);
         expect(b.parcels).toBeGreaterThanOrEqual(a.parcels);
         expect(b.dogs).toBeGreaterThanOrEqual(a.dogs);
         expect(b.traffic).toBeGreaterThanOrEqual(a.traffic);
         expect(b.trafficSpeed).toBeGreaterThanOrEqual(a.trafficSpeed);
         expect(Number(b.markers)).toBeLessThanOrEqual(Number(a.markers));
         expect(b.durationMs).toBeGreaterThanOrEqual(a.durationMs);
         expect(PROPOSED_LEVEL_LIMITS[id as LevelId].maxScore).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[(id - 1) as LevelId].maxScore);
         expect(PROPOSED_LEVEL_LIMITS[id as LevelId].base).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[1].base);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("createRun reads the level it is given (streets, houses, items, bag, dogs, traffic, lives, bounds)", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const run = createRun(11, level);
         expect(run.houses.length).toBe(level.streets * level.housesPerStreet);
         expect(Math.max(...run.houses.map((h) => h.street)) + 1).toBe(level.streets);
         expect(run.items.length).toBe(level.letters + level.parcels);
         expect(run.bag).toBe(Math.min(level.bagCap, level.letters));
         expect([run.dogs.length, run.cars.length]).toEqual([level.dogs, level.traffic]);
         expect(run.lives).toBe(level.lives ?? null);
         expect(run.bounds.max.x).toBe(streetEnd(level));
         // cars move at the level's speed (the postman far from every road and the zebra)
         if (run.cars.length) {
            run.hero.x = -12;
            run.hero.z = -10;
            for (const car of run.cars) car.x = 10;
            step(run, { moveX: 0, moveY: 0, yaw: 0, actionPressed: false }, 0.05);
            for (const car of run.cars) expect(Math.abs(car.x - 10)).toBeCloseTo(level.trafficSpeed * 0.05, 9);
         }
      }
   });
});
