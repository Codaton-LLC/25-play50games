import { describe, expect, it } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems } from "@/arcade3d/levelMeta";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES } from "./levels";
import { submarineTreasureDiveMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

describe("submarine levels", () => {
   it("matches the spec table and the definition", () => {
      expect(levelMetaProblems(submarineTreasureDiveMeta)).toEqual([]);
      expect(definitionLevelProblems(submarineTreasureDiveMeta, definition)).toEqual([]);
      expect(submarineTreasureDiveMeta.slug).toBe("submarine-treasure-dive");
      expect(submarineTreasureDiveMeta.status).toBe("dev");
      expect(submarineTreasureDiveMeta.owner).toBe("cursor");
      expect(submarineTreasureDiveMeta.collection).toBe("adventure");
      expect(submarineTreasureDiveMeta.order).toBe(42);
      expect(submarineTreasureDiveMeta.difficulty).toBe(2);
      expect(submarineTreasureDiveMeta.controls.scheme).toBe("flight");
      expect(submarineTreasureDiveMeta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(definition.touchControls).toEqual(["joystick", "action"]);
      expect(definition.touchLabels).toEqual({ action: "Dive" });
      expect(definition.lives).toBeUndefined();
      expect(definition.resultDelayMs).toBe(900);
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(submarineTreasureDiveMeta.levels?.[id - 1].title).toBe(LEVEL_TITLES[id]);
         expect(submarineTreasureDiveMeta.levels?.[id - 1].scoring).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(submarineTreasureDiveMeta.levels?.[id - 1].clearScore).toBeUndefined();
         expect(levelRunConfig(definition, id).durationMs).toBe(level.durationMs);
         expect(levelEnvironment(definition, id)?.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)?.background).toBe(level.background);
         expect(levelEnvironment(definition, id)?.fog).toEqual(["#0e7490", 8, level.fogFar]);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(0);
         expect(definition.levels?.[id - 1].description).toBe(LEVEL_LINES[id]);
         const stats = levelHudStats(definition, id);
         expect(stats?.find((stat) => stat.key === "treasure")?.max).toBe(level.treasures);
         expect(stats?.find((stat) => stat.key === "battery")?.max).toBe(100);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });
});
