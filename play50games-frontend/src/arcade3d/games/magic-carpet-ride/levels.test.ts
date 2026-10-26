import { describe, expect, it } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems } from "@/arcade3d/levelMeta";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES } from "./levels";
import { magicCarpetRideMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

describe("magic carpet levels", () => {
   it("matches the spec table and the definition", () => {
      expect(levelMetaProblems(magicCarpetRideMeta)).toEqual([]);
      expect(definitionLevelProblems(magicCarpetRideMeta, definition)).toEqual([]);
      expect(magicCarpetRideMeta.slug).toBe("magic-carpet-ride");
      expect(magicCarpetRideMeta.status).toBe("dev");
      expect(magicCarpetRideMeta.owner).toBe("cursor");
      expect(magicCarpetRideMeta.collection).toBe("adventure");
      expect(magicCarpetRideMeta.order).toBe(47);
      expect(magicCarpetRideMeta.difficulty).toBe(2);
      expect(magicCarpetRideMeta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(definition.touchControls).toEqual(["joystick", "jump"]);
      expect(definition.touchLabels).toEqual({ jump: "Boost" });
      expect(definition.lives).toBe(3);
      expect(definition.resultDelayMs).toBe(900);
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(magicCarpetRideMeta.levels?.[id - 1].title).toBe(LEVEL_TITLES[id]);
         expect(magicCarpetRideMeta.levels?.[id - 1].scoring).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(magicCarpetRideMeta.levels?.[id - 1].clearScore).toBeUndefined();
         expect(levelRunConfig(definition, id).durationMs).toBe(level.durationMs);
         expect(levelEnvironment(definition, id)?.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)?.background).toBe(level.background);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(0);
         expect(definition.levels?.[id - 1].description).toBe(LEVEL_LINES[id]);
         const stats = levelHudStats(definition, id);
         expect(stats?.find((stat) => stat.key === "rings")?.max).toBe(level.ringQuota);
         expect(stats?.find((stat) => stat.key === "stars")?.max).toBe(level.starQuota);
         expect(stats?.find((stat) => stat.key === "boost")?.max).toBe(100);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3300);
   });
});
