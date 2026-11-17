import { describe, expect, it } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems } from "@/arcade3d/levelMeta";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES } from "./levels";
import { farmTractorChallengeMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

describe("farm tractor levels", () => {
   it("matches the spec table and the definition", () => {
      expect(levelMetaProblems(farmTractorChallengeMeta)).toEqual([]);
      expect(definitionLevelProblems(farmTractorChallengeMeta, definition)).toEqual([]);
      expect(farmTractorChallengeMeta.slug).toBe("farm-tractor-challenge");
      expect(farmTractorChallengeMeta.status).toBe("dev");
      expect(farmTractorChallengeMeta.owner).toBe("kimi");
      expect(farmTractorChallengeMeta.collection).toBe("skill");
      expect(farmTractorChallengeMeta.order).toBe(35);
      expect(farmTractorChallengeMeta.difficulty).toBe(2);
      expect(farmTractorChallengeMeta.controls.scheme).toBe("steer");
      expect(farmTractorChallengeMeta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(definition.touchControls).toEqual(["joystick"]);
      expect(definition.lives).toBe(LEVELS[1].lives);
      expect(definition.resultDelayMs).toBe(900);
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(farmTractorChallengeMeta.levels?.[id - 1].title).toBe(LEVEL_TITLES[id]);
         expect(farmTractorChallengeMeta.levels?.[id - 1].scoring).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(farmTractorChallengeMeta.levels?.[id - 1].clearScore).toBeUndefined();
         expect(levelRunConfig(definition, id).durationMs).toBe(level.durationMs);
         expect(levelRunConfig(definition, id).lives).toBe(level.lives);
         expect(levelEnvironment(definition, id)?.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)?.background).toBe(level.background);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(0);
         expect(definition.levels?.[id - 1].description).toBe(LEVEL_LINES[id]);
         const stats = levelHudStats(definition, id);
         expect(stats?.find((stat) => stat.key === "trips")?.max).toBe(level.trips);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore / PROPOSED_LEVEL_LIMITS[1].maxScore).toBeLessThanOrEqual(3);
      expect(LEVELS[1].theme).toBe("yard");
      expect(new Set(LEVEL_IDS.map((id) => LEVELS[id].theme)).size).toBe(5);
   });
});
