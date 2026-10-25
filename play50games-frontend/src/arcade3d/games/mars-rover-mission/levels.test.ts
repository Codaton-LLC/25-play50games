import { describe, expect, it } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems } from "@/arcade3d/levelMeta";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES } from "./levels";
import { marsRoverMissionMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

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

         const stats = levelHudStats(definition, id);
         expect(stats?.find((stat) => stat.key === "samples")?.max).toBe(level.sites);
         expect(stats?.find((stat) => stat.key === "battery")?.max).toBe(100);
      }

      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });
});
