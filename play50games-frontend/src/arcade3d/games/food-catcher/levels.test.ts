import { describe, expect, it, vi } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS } from "./levels";
import { foodCatcherMeta } from "./meta";
import { CHEF, CATCH_BOX, FALL_DISTANCE, PROPOSED_LEVEL_LIMITS, buildPlan, createRun, finalScore, overlapsCatchBox, step, withinServerLimits, type RunState, type StepInput } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

function humanPacedInput(run: RunState): StepInput {
   let targetX: number | null = null;
   let earliestCross = Infinity;
   const nextElapsed = run.elapsedMs + 50;
   const activeBad: { x: number; crossingAt: number }[] = [];
   for (const item of run.items) {
      if (!item.active) continue;
      const fallFrames = Math.ceil((FALL_DISTANCE / item.speed) * 20);
      const crossingAt = item.bornMs + fallFrames * 50;
      if (item.bad) activeBad.push({ x: item.x, crossingAt });
      if (item.bad && crossingAt <= nextElapsed && crossingAt > run.elapsedMs) {
         const safe = [CHEF.minX, CHEF.maxX, item.x - CATCH_BOX.halfWidth - 0.351, item.x + CATCH_BOX.halfWidth + 0.351]
            .map((x) => Math.max(CHEF.minX, Math.min(CHEF.maxX, x)))
            .filter((x) => !overlapsCatchBox(item.x, CATCH_BOX.top, x))
            .sort((a, b) => Math.abs(a - run.chefX) - Math.abs(b - run.chefX));
         return { targetX: safe[0] ?? run.chefX };
      }
      if (item.bad) continue;
      if (crossingAt < earliestCross) {
         earliestCross = crossingAt;
         targetX = item.x;
      }
   }
   for (const bad of activeBad) {
      if (bad.crossingAt - run.elapsedMs > 1000) continue;
      const goal = targetX ?? run.chefX;
      if (!overlapsCatchBox(bad.x, CATCH_BOX.top, goal)) continue;
      const safe = [CHEF.minX, CHEF.maxX, bad.x - CATCH_BOX.halfWidth - 0.351, bad.x + CATCH_BOX.halfWidth + 0.351]
         .map((x) => Math.max(CHEF.minX, Math.min(CHEF.maxX, x)))
         .filter((x) => !overlapsCatchBox(bad.x, CATCH_BOX.top, x))
         .sort((a, b) => Math.abs(a - run.chefX) - Math.abs(b - run.chefX));
      return { targetX: safe[0] ?? run.chefX };
   }
   return targetX === null ? { dir: 0 } : { targetX };
}

function playHuman(seed: number, id: 2 | 3 | 4 | 5): RunState {
   const run = createRun(seed, LEVELS[id]);
   while (!run.ended) step(run, 50, humanPacedInput(run));
   return run;
}

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
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * foodCatcherMeta.scoring.maxScore);
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

   it("increases objectives, speed, density and junk monotonically", () => {
      for (const [lower, higher] of [[1, 2], [2, 3], [3, 4], [4, 5]] as const) {
         expect(LEVELS[higher].targetGood).toBeGreaterThan(LEVELS[lower].targetGood);
         expect(LEVELS[higher].speedFactor).toBeGreaterThan(LEVELS[lower].speedFactor);
         expect(LEVELS[higher].gapFactor).toBeLessThan(LEVELS[lower].gapFactor);
         expect(LEVELS[higher].badChanceBoost).toBeGreaterThan(LEVELS[lower].badChanceBoost);
      }
      expect(LEVELS[1].goldenEvery).toBe(0);
      expect(LEVELS[2].goldenEvery).toBeGreaterThan(0);
   });

   it("caps extra golden points at the per-level objective allowance", () => {
      expect(LEVEL_IDS.map((id) => LEVELS[id].bonusLimit)).toEqual([0, 3, 5, 7, 12]);
      const level = { ...LEVELS[2], targetGood: 2, goldenEvery: 1, bonusLimit: 1 };
      const run = createRun(1, level, { forceGood: true });
      for (const spawn of run.plan) spawn.x = 0;
      while (!run.ended) step(run, 50, { targetX: 0 });
      expect(run.goodCaught).toBe(2);
      expect(run.score).toBe(30);
   });

   it("is clearable by a movement-limited player in at least 90% of 200 seeds per level", () => {
      const clearsByLevel: number[] = [];
      for (const id of [2, 3, 4, 5] as const) {
         let clears = 0;
         const failures: Record<string, number> = {};
         for (let seed = 1; seed <= 200; seed++) {
            const run = playHuman(seed, id);
            const finished = finalScore(run.score, run.elapsedMs, PROPOSED_LEVEL_LIMITS[id]);
            expect(finished.score).toBe(run.score);
            expect(withinServerLimits(finished.score, finished.durationMs, PROPOSED_LEVEL_LIMITS[id])).toBe(true);
            if (run.ended === "win") clears++;
            else failures[`${run.ended}:${run.lives}`] = (failures[`${run.ended}:${run.lives}`] ?? 0) + 1;
         }
         clearsByLevel.push(clears);
         expect(clears, `level ${id} clears; failures ${JSON.stringify(failures)}`).toBeGreaterThanOrEqual(180);
      }
      expect(clearsByLevel).toEqual([200, 200, 199, 198]);
   }, 60_000);

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
      expect(levelInstructions(definition, 2)).toContain("Up to 3 golden snacks add +10 points; every 8th drop is golden.");
   });
});
