import { describe, expect, it } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems } from "@/arcade3d/levelMeta";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES } from "./levels";
import { jungleBridgeRunMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

describe("jungle-bridge-run levels", () => {
   it("matches the spec table and the definition", () => {
      expect(levelMetaProblems(jungleBridgeRunMeta)).toEqual([]);
      expect(definitionLevelProblems(jungleBridgeRunMeta, definition)).toEqual([]);
      expect(jungleBridgeRunMeta.slug).toBe("jungle-bridge-run");
      expect(jungleBridgeRunMeta.status).toBe("dev");
      expect(jungleBridgeRunMeta.owner).toBe("antigravity");
      expect(jungleBridgeRunMeta.collection).toBe("adventure");
      expect(jungleBridgeRunMeta.order).toBe(46);
      expect(jungleBridgeRunMeta.difficulty).toBe(2);
      expect(jungleBridgeRunMeta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(definition.touchControls).toEqual([]);
      expect(definition.lives).toBe(3);
      expect(definition.resultDelayMs).toBe(800);
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(jungleBridgeRunMeta.levels?.[id - 1].title).toBe(LEVEL_TITLES[id]);
         expect(jungleBridgeRunMeta.levels?.[id - 1].scoring).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(jungleBridgeRunMeta.levels?.[id - 1].clearScore).toBeUndefined();
         expect(levelRunConfig(definition, id).durationMs).toBe(level.durationMs);
         expect(levelEnvironment(definition, id)?.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)?.background).toBe(level.background);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(0);
         expect(definition.levels?.[id - 1].description).toBe(LEVEL_LINES[id]);
         const stats = levelHudStats(definition, id);
         expect(stats?.find((stat) => stat.key === "section")?.max).toBe(level.sections);
         expect(stats?.find((stat) => stat.key === "gems")?.max).toBe(level.sections * level.gemsPerSection);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3300);
   });
});
