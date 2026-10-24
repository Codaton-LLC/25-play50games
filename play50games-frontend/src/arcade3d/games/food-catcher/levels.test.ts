import { describe, expect, it, vi } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS } from "./levels";
import { foodCatcherMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS, buildPlan, createRun, step } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

describe("food-catcher level metadata", () => {
   it("declares the five planned levels with today's scoring unchanged on level 1", () => {
      expect(foodCatcherMeta.levels).toHaveLength(5);
      expect(foodCatcherMeta.levels?.map(({ id, title }) => [id, title])).toEqual([
         [1, "Fruit Catch"],
         [2, "Snack Catch"],
         [3, "Fast Food Mix"],
         [4, "Speed Kitchen"],
         [5, "Master Catch"],
      ]);
      expect(foodCatcherMeta.levels?.[0].scoring).toEqual(foodCatcherMeta.scoring);
      expect(levelMetaProblems(foodCatcherMeta)).toEqual([]);
      expect(definitionLevelProblems(foodCatcherMeta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(foodCatcherMeta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(foodCatcherMeta.levels?.[0].clearScore).toBe(260);
      expect(foodCatcherMeta.levels?.slice(1).every((level) => level.clearScore === undefined)).toBe(true);
      expect(foodCatcherMeta.scoring).toEqual({
         kind: "points",
         maxScore: 2500,
         minDurationMs: 9500,
         maxDurationMs: 93000,
         base: 0,
         maxPointsPerSec: 28,
         unitLabel: "pts",
         display: "int",
      });
   });

   it("keeps level 1's seeded schedule and applies the later-level spawn configs", () => {
      const base = createRun(17);
      const level1 = createRun(17, LEVELS[1]);
      const level2 = createRun(17, LEVELS[2]);
      expect(level1.level).toBe(LEVELS[1]);
      expect(level1.plan).toEqual(buildPlan(17));
      expect(level2.level).toBe(LEVELS[2]);
      expect(level2.plan[0].time).toBe(1080);
      expect(level2.plan[0].speed).toBeCloseTo(1.728, 12);
      expect(level2.plan[7].bonus).toBe(true);
      expect(level2.plan[0].time).toBeLessThan(base.plan[0].time);
      expect(level2.plan[0].speed).toBeGreaterThan(base.plan[0].speed);
   });

   it("wins later levels on their good-catch objective; level 1 remains timed score attack", () => {
      for (const id of [2, 3, 4, 5] as const) {
         const run = createRun(id, LEVELS[id], { forceGood: true });
         for (const spawn of run.plan) spawn.x = 0;
         let guard = 0;
         while (!run.ended && guard++ < 20_000) step(run, 50, { dir: 0 });
         expect(run.ended).toBe("win");
         expect(run.goodCaught).toBe(LEVELS[id].targetGood);
      }
      const level1 = createRun(1, LEVELS[1], { forceGood: true });
      expect(level1.level.targetGood).toBe(0);
   });

   it("uses core level specs for clocks, lighting, instructions and HUD maxima", () => {
      expect(LEVEL_IDS.map((id) => levelRunConfig(definition, id).durationMs)).toEqual([90_000, 120_000, 150_000, 180_000, 180_000]);
      expect(LEVEL_IDS.map((id) => levelHudStats(definition, id))).toEqual([
         [{ key: "combo", label: "Combo" }],
         [{ key: "caught", label: "Food", max: 25 }, { key: "combo", label: "Combo" }],
         [{ key: "caught", label: "Food", max: 35 }, { key: "combo", label: "Combo" }],
         [{ key: "caught", label: "Food", max: 45 }, { key: "combo", label: "Combo" }],
         [{ key: "caught", label: "Food", max: 60 }, { key: "combo", label: "Combo" }],
      ]);
      expect(LEVEL_IDS.map((id) => levelEnvironment(definition, id)?.lighting)).toEqual(["indoor", "day", "sunset", "night", "sunset"]);
      expect(levelInstructions(definition, 1)).toEqual(definition.instructions);
      expect(levelInstructions(definition, 2)).toContain("Golden snacks score +10 bonus points.");
   });
});
