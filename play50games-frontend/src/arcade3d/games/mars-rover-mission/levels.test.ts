import { describe, expect, it, vi } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES } from "./levels";
import { marsRoverMissionMeta } from "./meta";
import { fogFor } from "./looks";
import { PROPOSED_LEVEL_LIMITS, createRun, objectiveCeiling } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));

describe("mars-rover-mission levels", () => {
   it("matches the spec table and the definition", () => {
      expect(levelMetaProblems(marsRoverMissionMeta)).toEqual([]);
      expect(definitionLevelProblems(marsRoverMissionMeta, definition)).toEqual([]);
      expect(marsRoverMissionMeta.slug).toBe("mars-rover-mission");
      expect(marsRoverMissionMeta.status).toBe("dev");
      expect(marsRoverMissionMeta.owner).toBe("antigravity");
      expect(marsRoverMissionMeta.collection).toBe("adventure");
      expect(marsRoverMissionMeta.order).toBe(43);
      expect(marsRoverMissionMeta.difficulty).toBe(2);
      expect(marsRoverMissionMeta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(definition.touchControls).toEqual(["joystick"]);
      expect(definition.lives).toBe(3);
      expect(definition.resultDelayMs).toBe(900);

      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(marsRoverMissionMeta.levels?.[id - 1].title).toBe(LEVEL_TITLES[id]);
         expect(marsRoverMissionMeta.levels?.[id - 1].scoring).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(marsRoverMissionMeta.levels?.[id - 1].clearScore).toBeUndefined();
         expect(levelRunConfig(definition, id).durationMs).toBe(level.durationMs);
         expect(levelEnvironment(definition, id)?.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)?.background).toBe(level.background);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(0);
         expect(definition.levels?.[id - 1].description).toBe(LEVEL_LINES[id]);
         expect(definition.levels?.[id - 1].config).toBe(level);
         expect(levelEnvironment(definition, id)?.fog).toEqual(fogFor(level, id));

         const stats = levelHudStats(definition, id);
         expect(stats?.find((stat) => stat.key === "samples")?.max).toBe(level.sites);
         expect(stats?.find((stat) => stat.key === "battery")?.max).toBe(100);
      }

      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("level 1 is the spec's landing zone; L4's dust storm is the thickest fog; L5 is space", () => {
      expect(LEVELS[1]).toMatchObject({ width: 40, depth: 32, sites: 3, chargers: 1, rocks: 6, boulders: 0, drainScale: 0.8, durationMs: 120_000 });
      for (const id of [1, 2, 3, 5] as LevelId[]) {
         const [, n, f] = fogFor(LEVELS[id], id);
         expect(f - n).toBeGreaterThan(fogFor(LEVELS[4], 4)[2] - fogFor(LEVELS[4], 4)[1]);
      }
      expect(LEVELS[5].lighting).toBe("space");
   });

   it("difficulty never drops; every level pays at least level 1; L5 <= 3 x L1", () => {
      for (let id = 2; id <= 5; id++) {
         const a = LEVELS[(id - 1) as LevelId];
         const b = LEVELS[id as LevelId];
         expect(b.sites).toBeGreaterThan(a.sites);
         expect(b.rocks).toBeGreaterThanOrEqual(a.rocks);
         expect(b.boulders).toBeGreaterThanOrEqual(a.boulders);
         expect(b.boulderSpeed).toBeGreaterThanOrEqual(a.boulderSpeed);
         expect(b.chargers).toBeGreaterThanOrEqual(a.chargers);
         expect(b.width * b.depth).toBeGreaterThanOrEqual(a.width * a.depth);
         expect(b.durationMs).toBeGreaterThanOrEqual(a.durationMs);
         expect(PROPOSED_LEVEL_LIMITS[id as LevelId].maxScore).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[(id - 1) as LevelId].maxScore);
         expect(PROPOSED_LEVEL_LIMITS[id as LevelId].base).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[1].base);
      }
      // the battery gets hungrier up to L4; L5 eases it a little for its longer plain (spec)
      expect(LEVEL_IDS.map((id) => LEVELS[id].drainScale)).toEqual([0.8, 0.9, 1.0, 1.15, 1.1]);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("createRun reads the level it is given", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(5, LEVELS[id], id);
         expect(run.level).toBe(LEVELS[id]);
         expect(run.levelId).toBe(id);
         expect([run.sites.length, run.chargers.length, run.rocks.length, run.boulders.length]).toEqual([LEVELS[id].sites, LEVELS[id].chargers, LEVELS[id].rocks, LEVELS[id].boulders]);
         for (const b of run.boulders) expect(b.speed).toBe(LEVELS[id].boulderSpeed);
         expect(PROPOSED_LEVEL_LIMITS[id].base).toBe(objectiveCeiling(LEVELS[id].sites));
      }
   });
});
