import { describe, expect, it } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems } from "@/arcade3d/levelMeta";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES } from "./levels";
import { catVsRobotVacuumMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

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
         const stats = levelHudStats(definition, id);
         expect(stats?.find((stat) => stat.key === "treats")?.max).toBe(level.treats);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });
});
