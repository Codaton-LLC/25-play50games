import { describe, expect, it } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems } from "@/arcade3d/levelMeta";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES } from "./levels";
import { taxiRushMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

describe("taxi levels", () => {
   it("matches the spec table and the definition", () => {
      expect(levelMetaProblems(taxiRushMeta)).toEqual([]);
      expect(definitionLevelProblems(taxiRushMeta, definition)).toEqual([]);
      expect(taxiRushMeta.slug).toBe("taxi-rush-3d");
      expect(taxiRushMeta.status).toBe("dev");
      expect(taxiRushMeta.owner).toBe("cursor");
      expect(taxiRushMeta.collection).toBe("adventure");
      expect(taxiRushMeta.order).toBe(32);
      expect(taxiRushMeta.difficulty).toBe(2);
      expect(taxiRushMeta.controls.scheme).toBe("steer");
      expect(taxiRushMeta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(definition.touchControls).toEqual(["joystick"]);
      expect(definition.lives).toBe(3);
      expect(definition.resultDelayMs).toBe(900);
      expect(definition.slug).toBe("taxi-rush-3d");
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(taxiRushMeta.levels?.[id - 1].title).toBe(LEVEL_TITLES[id]);
         expect(taxiRushMeta.levels?.[id - 1].scoring).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(taxiRushMeta.levels?.[id - 1].clearScore).toBeUndefined();
         expect(levelRunConfig(definition, id).durationMs).toBe(level.durationMs);
         expect(levelEnvironment(definition, id)?.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)?.background).toBe(level.background);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(0);
         expect(definition.levels?.[id - 1].description).toBe(LEVEL_LINES[id]);
         const stats = levelHudStats(definition, id);
         expect(stats?.find((stat) => stat.key === "rides")?.max).toBe(level.rides);
         expect(stats?.find((stat) => stat.key === "fare")?.max).toBe(100);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });
});
