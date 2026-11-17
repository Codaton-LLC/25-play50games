import { describe, expect, it } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems } from "@/arcade3d/levelMeta";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES } from "./levels";
import { hauntedMansionKeysMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

describe("haunted-mansion-keys levels", () => {
   it("matches the spec table and the definition", () => {
      expect(levelMetaProblems(hauntedMansionKeysMeta)).toEqual([]);
      expect(definitionLevelProblems(hauntedMansionKeysMeta, definition)).toEqual([]);
      expect(hauntedMansionKeysMeta.slug).toBe("haunted-mansion-keys");
      expect(hauntedMansionKeysMeta.status).toBe("dev");
      expect(hauntedMansionKeysMeta.owner).toBe("antigravity");
      expect(hauntedMansionKeysMeta.collection).toBe("adventure");
      expect(hauntedMansionKeysMeta.order).toBe(39);
      expect(hauntedMansionKeysMeta.difficulty).toBe(2);
      expect(hauntedMansionKeysMeta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(definition.touchControls).toEqual(["joystick", "action"]);
      expect(definition.touchLabels).toEqual({ action: "Use" });
      expect(definition.resultDelayMs).toBe(900);

      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(hauntedMansionKeysMeta.levels?.[id - 1].title).toBe(LEVEL_TITLES[id]);
         expect(hauntedMansionKeysMeta.levels?.[id - 1].scoring).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(hauntedMansionKeysMeta.levels?.[id - 1].clearScore).toBeUndefined();

         const runConfig = levelRunConfig(definition, id);
         expect(runConfig.durationMs).toBe(level.durationMs);
         if (level.lives !== undefined) {
            expect(runConfig.lives).toBe(level.lives);
         } else {
            expect(runConfig.lives).toBeUndefined();
         }

         expect(levelEnvironment(definition, id)?.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)?.background).toBe(level.background);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(0);
         expect(definition.levels?.[id - 1].description).toBe(LEVEL_LINES[id]);

         const stats = levelHudStats(definition, id);
         expect(stats?.find((stat) => stat.key === "keys")?.max).toBe(level.keys);
      }

      // 3x score limit check
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });
});
