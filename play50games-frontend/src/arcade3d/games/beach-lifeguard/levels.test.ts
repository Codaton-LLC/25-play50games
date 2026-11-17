import { describe, expect, it } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, LEVEL_LINES, LEVEL_TITLES } from "./levels";
import { beachLifeguardMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS } from "./rules";

describe("beach lifeguard levels", () => {
   it("meta, the definition and the proposed limits agree on all five levels", () => {
      expect(levelMetaProblems(beachLifeguardMeta)).toEqual([]);
      expect(definitionLevelProblems(beachLifeguardMeta, definition)).toEqual([]);
      expect(beachLifeguardMeta).toMatchObject({ slug: "beach-lifeguard", status: "dev", owner: "antigravity", collection: "adventure", order: 34, difficulty: 2 });
      expect(beachLifeguardMeta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(definition.touchControls).toEqual(["joystick", "action"]);
      expect(definition.touchLabels).toEqual({ action: "Grab" });
      expect(definition.lives).toBe(3);
      expect(definition.resultDelayMs).toBe(900);
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(beachLifeguardMeta.levels?.[id - 1].title).toBe(LEVEL_TITLES[id]);
         expect(scoringFor(beachLifeguardMeta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(beachLifeguardMeta.levels?.[id - 1].clearScore).toBeUndefined();
         expect(levelRunConfig(definition, id).durationMs).toBe(level.durationMs);
         expect(levelEnvironment(definition, id)?.lighting).toBe(level.lighting);
         expect(levelEnvironment(definition, id)?.background).toBe(level.background);
         expect(levelEnvironment(definition, id)?.fog?.[2]).toBe(level.fogFar);
         expect(levelInstructions(definition, id).length).toBeGreaterThan(0);
         expect(definition.levels?.[id - 1].description).toBe(LEVEL_LINES[id]);
         expect(definition.levels?.[id - 1].config).toBe(level);
         const stats = levelHudStats(definition, id);
         expect(stats?.find((stat) => stat.key === "saved")?.max).toBe(level.rescues);
         expect(stats?.find((stat) => stat.key === "alert")?.max).toBe(100);
      }
   });

   it("level 1 is the spec's base beach", () => {
      expect(LEVELS[1]).toEqual({ width: 24, water: 12, rescues: 2, alertS: 40, jetSki: false, durationMs: 120_000, lighting: "day", background: "#7dd3fc", fogFar: 80 });
   });

   it("difficulty never eases: wider, deeper, more rescues, shorter alerts, the jet ski only later, nearer fog", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = LEVELS[(id - 1) as LevelId];
         const b = LEVELS[id];
         expect(b.width).toBeGreaterThan(a.width);
         expect(b.water).toBeGreaterThan(a.water);
         expect(b.rescues).toBeGreaterThan(a.rescues);
         expect(b.alertS).toBeLessThan(a.alertS);
         expect(b.durationMs).toBeGreaterThanOrEqual(a.durationMs);
         expect(b.fogFar).toBeLessThanOrEqual(a.fogFar);
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[(id - 1) as LevelId].maxScore);
      }
      expect(LEVEL_IDS.map((id) => LEVELS[id].jetSki)).toEqual([false, false, false, true, true]);
   });

   it("every level is worth at least level 1, and level 5 at most 3x level 1", () => {
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
         expect(PROPOSED_LEVEL_LIMITS[id].base).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].base);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore / PROPOSED_LEVEL_LIMITS[1].maxScore).toBeLessThanOrEqual(3);
   });
});
