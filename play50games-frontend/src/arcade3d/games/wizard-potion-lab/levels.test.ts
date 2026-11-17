import { describe, expect, it } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems } from "@/arcade3d/levelMeta";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES } from "./levels";
import { wizardPotionLabMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS, objectiveCeiling } from "./rules";

describe("wizard potion lab levels", () => {
   it("matches the spec table and the definition", () => {
      expect(levelMetaProblems(wizardPotionLabMeta)).toEqual([]);
      expect(definitionLevelProblems(wizardPotionLabMeta, definition)).toEqual([]);
      expect(wizardPotionLabMeta.slug).toBe("wizard-potion-lab");
      expect(wizardPotionLabMeta.status).toBe("dev");
      expect(wizardPotionLabMeta.owner).toBe("cursor");
      expect(wizardPotionLabMeta.collection).toBe("skill");
      expect(wizardPotionLabMeta.order).toBe(38);
      expect(wizardPotionLabMeta.difficulty).toBe(2);
      expect(wizardPotionLabMeta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(definition.touchControls).toEqual(["joystick", "action"]);
      expect(definition.touchLabels).toEqual({ action: "Use" });
      expect(definition.lives).toBeUndefined();
      expect(definition.resultDelayMs).toBe(900);
      expect(levelRunConfig(definition, 1).lives).toBeUndefined();
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(wizardPotionLabMeta.levels?.[id - 1].title).toBe(LEVEL_TITLES[id]);
         expect(wizardPotionLabMeta.levels?.[id - 1].scoring).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(wizardPotionLabMeta.levels?.[id - 1].clearScore).toBeUndefined();
         expect(levelRunConfig(definition, id).durationMs).toBe(level.durationMs);
         expect(levelRunConfig(definition, id).lives).toBe(id === 1 ? undefined : 3);
         expect(levelEnvironment(definition, id)?.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)?.background).toBe(level.background);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(0);
         expect(definition.levels?.[id - 1].description).toBe(LEVEL_LINES[id]);
         expect(objectiveCeiling(level)).toBe(380 * level.recipes);
         expect(PROPOSED_LEVEL_LIMITS[id].base).toBe(380 * level.recipes);
         expect(PROPOSED_LEVEL_LIMITS[id].minDurationMs).toBe(4000);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      expect(LEVELS[1].wrongCostsLife).toBe(false);
      expect(LEVELS[1].lives).toBeUndefined();
      expect(LEVELS[5].dual).toBe(true);
      expect(LEVELS[3].wander).toBe(true);
   });
});
