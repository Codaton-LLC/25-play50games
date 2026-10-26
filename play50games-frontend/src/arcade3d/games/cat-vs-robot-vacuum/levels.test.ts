import { describe, expect, it } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems } from "@/arcade3d/levelMeta";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES } from "./levels";
import { catVsRobotVacuumMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS, ROOM_LEN, createRun } from "./rules";
import type { LevelId } from "@/arcade3d/types";

describe("cat-vs-robot-vacuum levels", () => {
   it("matches the spec table and the definition", () => {
      expect(levelMetaProblems(catVsRobotVacuumMeta)).toEqual([]);
      expect(definitionLevelProblems(catVsRobotVacuumMeta, definition)).toEqual([]);
      expect(catVsRobotVacuumMeta.slug).toBe("cat-vs-robot-vacuum");
      expect(catVsRobotVacuumMeta.status).toBe("dev");
      expect(catVsRobotVacuumMeta.owner).toBe("kimi");
      expect(catVsRobotVacuumMeta.collection).toBe("adventure");
      expect(catVsRobotVacuumMeta.order).toBe(36);
      expect(catVsRobotVacuumMeta.difficulty).toBe(1);
      expect(catVsRobotVacuumMeta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(definition.touchControls).toEqual(["joystick", "jump"]);
      expect(definition.touchLabels).toEqual({ jump: "Hop" });
      expect(definition.lives).toBe(3);
      expect(definition.resultDelayMs).toBe(900);
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(catVsRobotVacuumMeta.levels?.[id - 1].title).toBe(LEVEL_TITLES[id]);
         expect(catVsRobotVacuumMeta.levels?.[id - 1].scoring).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(catVsRobotVacuumMeta.levels?.[id - 1].clearScore).toBeUndefined();
         expect(levelRunConfig(definition, id).durationMs).toBe(level.durationMs);
         expect(levelEnvironment(definition, id)?.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)?.background).toBe(level.background);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(0);
         expect(definition.levels?.[id - 1].description).toBe(LEVEL_LINES[id]);
         expect(definition.levels?.[id - 1].config).toBe(level);
         const stats = levelHudStats(definition, id);
         expect(stats?.find((stat) => stat.key === "treats")?.max).toBe(level.treats);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("createRun reads the level it is given: rooms, treats, toys, vacuums, clutter", () => {
      for (const id of LEVEL_IDS) {
         const l = LEVELS[id];
         for (let seed = 1; seed <= 20; seed++) {
            const run = createRun(seed, l);
            expect(run.level).toBe(l);
            expect(run.length).toBe(l.rooms * ROOM_LEN);
            expect(run.furniture.length).toBe(l.rooms);
            expect([run.treats.length, run.toys.length, run.vacuums.length, run.clutter.length]).toEqual([l.treats, l.toys, l.vacuums, l.clutter]);
         }
      }
   });

   it("difficulty never drops and every level pays at least level 1; L5 <= 3 x L1", () => {
      for (let id = 2; id <= 5; id++) {
         const a = LEVELS[(id - 1) as LevelId];
         const b = LEVELS[id as LevelId];
         for (const k of ["rooms", "treats", "toys", "vacuums", "patrolSpeed", "chaseSpeed", "chaseRange", "clutter", "durationMs"] as const) expect(b[k]).toBeGreaterThanOrEqual(a[k]);
         expect(b.treats).toBeGreaterThan(a.treats);
         expect(PROPOSED_LEVEL_LIMITS[id as LevelId].maxScore).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[(id - 1) as LevelId].maxScore);
         expect(PROPOSED_LEVEL_LIMITS[id as LevelId].base).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[1].base);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      expect(LEVEL_IDS.map((id) => LEVELS[id].tint)).toEqual(["#fb923c", "#9ca3af", "#57534e", "#fde68a", "#c4b5fd"]);
   });
});
