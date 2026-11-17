import { describe, expect, it } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems } from "@/arcade3d/levelMeta";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES, shelvesOf } from "./levels";
import { toyStoreNightShiftMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS, objectiveCeiling } from "./rules";

describe("toy store levels", () => {
   it("matches the spec table and the definition", () => {
      expect(levelMetaProblems(toyStoreNightShiftMeta)).toEqual([]);
      expect(definitionLevelProblems(toyStoreNightShiftMeta, definition)).toEqual([]);
      expect(toyStoreNightShiftMeta.slug).toBe("toy-store-night-shift");
      expect(toyStoreNightShiftMeta.status).toBe("dev");
      expect(toyStoreNightShiftMeta.owner).toBe("kimi");
      expect(toyStoreNightShiftMeta.order).toBe(48);
      expect(toyStoreNightShiftMeta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(definition.touchControls).toEqual(["joystick", "action"]);
      expect(definition.touchLabels).toEqual({ action: "Use" });
      expect(definition.lives).toBeUndefined();
      expect(LEVEL_IDS.map((id) => LEVELS[id].toys)).toEqual([5, 8, 10, 14, 18]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].windups)).toEqual([0, 1, 2, 3, 4]);
      expect(LEVEL_IDS.map((id) => shelvesOf(LEVELS[id]))).toEqual([3, 4, 10, 12, 14]);
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const meta = toyStoreNightShiftMeta.levels![id - 1];
         expect(meta.title).toBe(LEVEL_TITLES[id]);
         expect(meta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(meta.scoring.base).toBe(objectiveCeiling(level));
         expect(meta.scoring.maxDurationMs).toBe(level.durationMs);
         expect(meta.clearScore).toBeUndefined();
         expect(levelRunConfig(definition, id).durationMs).toBe(level.durationMs);
         expect(levelEnvironment(definition, id)?.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)?.background).toBe(level.background);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(0);
         expect(definition.levels?.[id - 1].description).toBe(LEVEL_LINES[id]);
         const stats = levelHudStats(definition, id);
         expect(stats?.find((s) => s.key === "shelved")?.max).toBe(level.toys);
         expect(stats?.find((s) => s.key === "carrying")?.max).toBe(level.carry);
      }
   });

   it("level 1 is the base and difficulty never decreases", () => {
      expect(LEVELS[1].windups).toBe(0);
      expect(LEVELS[1].carry).toBe(1);
      for (const id of [2, 3, 4, 5] as const) {
         const a = LEVELS[(id - 1) as 1 | 2 | 3 | 4];
         const b = LEVELS[id];
         expect(b.toys).toBeGreaterThanOrEqual(a.toys);
         expect(b.aisles).toBeGreaterThanOrEqual(a.aisles);
         expect(b.categories).toBeGreaterThanOrEqual(a.categories);
         expect(b.windups).toBeGreaterThanOrEqual(a.windups);
         expect(b.windupSpeed).toBeGreaterThanOrEqual(a.windupSpeed);
         expect(b.carry).toBeGreaterThanOrEqual(a.carry);
         expect(b.durationMs).toBeGreaterThanOrEqual(a.durationMs);
      }
   });

   it("every level pays at least level 1's points, and level 5 stays within about 3x level 1", () => {
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
         expect(objectiveCeiling(LEVELS[id])).toBeGreaterThanOrEqual(objectiveCeiling(LEVELS[1]));
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });
});
