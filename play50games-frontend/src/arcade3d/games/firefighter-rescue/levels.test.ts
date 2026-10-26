import { describe, expect, it } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems } from "@/arcade3d/levelMeta";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES } from "./levels";
import { firefighterRescueMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

describe("firefighter levels", () => {
   it("matches the spec table and the definition", () => {
      expect(levelMetaProblems(firefighterRescueMeta)).toEqual([]);
      expect(definitionLevelProblems(firefighterRescueMeta, definition)).toEqual([]);
      expect(firefighterRescueMeta.slug).toBe("firefighter-rescue");
      expect(firefighterRescueMeta.status).toBe("dev");
      expect(firefighterRescueMeta.owner).toBe("cursor");
      expect(firefighterRescueMeta.collection).toBe("adventure");
      expect(firefighterRescueMeta.order).toBe(31);
      expect(firefighterRescueMeta.difficulty).toBe(2);
      expect(firefighterRescueMeta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(definition.touchControls).toEqual(["joystick", "action", "jump"]);
      expect(definition.touchLabels).toEqual({ action: "Spray", jump: "Hop" });
      expect(definition.lives).toBe(3);
      expect(definition.resultDelayMs).toBe(900);
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(firefighterRescueMeta.levels?.[id - 1].title).toBe(LEVEL_TITLES[id]);
         expect(firefighterRescueMeta.levels?.[id - 1].scoring).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(firefighterRescueMeta.levels?.[id - 1].clearScore).toBeUndefined();
         expect(levelRunConfig(definition, id).durationMs).toBe(level.durationMs);
         expect(levelEnvironment(definition, id)?.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)?.background).toBe(level.background);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(0);
         expect(definition.levels?.[id - 1].description).toBe(LEVEL_LINES[id]);
         const stats = levelHudStats(definition, id);
         expect(stats?.find((stat) => stat.key === "fires")?.max).toBe(level.fires);
         expect(stats?.find((stat) => stat.key === "saved")?.max).toBe(level.civilians);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3300);
   });
});
