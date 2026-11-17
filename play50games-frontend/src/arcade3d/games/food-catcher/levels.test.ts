import { describe, expect, it, vi } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS } from "./levels";
import { foodCatcherMeta } from "./meta";
import { CHEF, CATCH_BOX, FALL_DISTANCE, PROPOSED_LEVEL_LIMITS, buildPlan, createRun, finalScore, overlapsCatchBox, step, timeBonus, withinServerLimits, type RunState, type StepInput } from "./rules";

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
      expect(foodCatcherMeta.levels?.[0].clearScore).toBe(600);
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

   it("adds 20 points per whole second left on a win (levels 2-5 only)", () => {
      expect(LEVEL_IDS.map((id) => LEVELS[id].timeBonusPerSec)).toEqual([0, 20, 20, 20, 20]);
      expect(timeBonus(LEVELS[2], 27_057)).toBe(20 * 92);
      expect(timeBonus(LEVELS[2], 119_001)).toBe(0);
      expect(timeBonus(LEVELS[2], 130_000)).toBe(0);
      const run = createRun(3, LEVELS[2], { forceGood: true });
      for (const spawn of run.plan) spawn.x = 0;
      let before = 0;
      while (!run.ended) {
         before = run.score;
         step(run, 50, { targetX: 0 });
      }
      expect(run.ended).toBe("win");
      expect(run.score - before).toBe(20 + timeBonus(LEVELS[2], run.elapsedMs));
      // standing still never clears, so it never gets the bonus
      for (const id of [2, 3, 4, 5] as const) {
         for (let seed = 1; seed <= 50; seed++) {
            const idle = createRun(seed, LEVELS[id]);
            while (!idle.ended) step(idle, 50, { dir: 0 });
            expect(idle.ended).not.toBe("win");
            expect(idle.score).toBeLessThan(20 * LEVELS[id].targetGood);
         }
      }
   });

   it("never clears a level by standing still (level 1: below clearScore; levels 2-5: drops cost lives)", () => {
      const clearScore = foodCatcherMeta.levels?.[0].clearScore ?? 0;
      for (const id of LEVEL_IDS) {
         for (const x of [0, 1.5, 3.5]) {
            for (let seed = 1; seed <= 200; seed++) {
               const idle = createRun(seed, LEVELS[id]);
               idle.chefX = x;
               while (!idle.ended) step(idle, 50, { dir: 0 });
               expect(idle.ended).not.toBe("win");
               if (id === 1) expect(idle.score).toBeLessThan(clearScore);
            }
         }
      }
   }, 60_000);

   it("costs a life for every fifth dropped good item on levels 2-5 only", () => {
      const run = createRun(5, LEVELS[2], { forceGood: true });
      for (const spawn of run.plan) spawn.x = 3.4;
      const lives: number[] = [];
      while (!run.ended) {
         const ev = step(run, 50, { targetX: -3.5 });
         if (ev.dropLives > 0) lives.push(run.drops);
      }
      expect(lives).toEqual([5, 10, 15]);
      expect(run.ended).toBe("lose");
      const l1 = createRun(5, LEVELS[1], { forceGood: true });
      for (const spawn of l1.plan) spawn.x = 3.4;
      while (!l1.ended) step(l1, 50, { targetX: -3.5 });
      expect(l1.ended).toBe("timeup");
      expect(l1.lives).toBe(3);
   });

   it("caps extra golden points at the per-level objective allowance", () => {
      expect(LEVEL_IDS.map((id) => LEVELS[id].bonusLimit)).toEqual([0, 3, 5, 7, 12]);
      const level = { ...LEVELS[2], targetGood: 2, goldenEvery: 1, bonusLimit: 1, timeBonusPerSec: 0 };
      const run = createRun(1, level, { forceGood: true });
      for (const spawn of run.plan) spawn.x = 0;
      while (!run.ended) step(run, 50, { targetX: 0 });
      expect(run.goodCaught).toBe(2);
      expect(run.score).toBe(30);
   });

   it("is clearable by a movement-limited player in at least 90% of 200 seeds per level, whose best is >= 90% of maxScore", () => {
      const clearsByLevel: number[] = [];
      for (const id of [2, 3, 4, 5] as const) {
         let clears = 0;
         let best = 0;
         const failures: Record<string, number> = {};
         for (let seed = 1; seed <= 200; seed++) {
            const run = playHuman(seed, id);
            const finished = finalScore(run.score, run.elapsedMs, PROPOSED_LEVEL_LIMITS[id]);
            expect(finished.score).toBe(run.score);
            expect(withinServerLimits(finished.score, finished.durationMs, PROPOSED_LEVEL_LIMITS[id])).toBe(true);
            best = Math.max(best, finished.score);
            if (run.ended === "win") clears++;
            else failures[`${run.ended}:${run.lives}`] = (failures[`${run.ended}:${run.lives}`] ?? 0) + 1;
         }
         clearsByLevel.push(clears);
         // honest play (no teleport, real junk, max chef speed): the limit is not loose
         expect(best, `level ${id} honest best`).toBeGreaterThanOrEqual(0.9 * PROPOSED_LEVEL_LIMITS[id].maxScore);
         expect(clears, `level ${id} clears; failures ${JSON.stringify(failures)}`).toBeGreaterThanOrEqual(180);
      }
      expect(clearsByLevel).toEqual([200, 200, 199, 196]);
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

   it("clears level 1 (clearScore) for a movement-limited player on most seeds", () => {
      const clearScore = foodCatcherMeta.levels?.[0].clearScore ?? 0;
      let clears = 0;
      for (let seed = 1; seed <= 200; seed++) {
         const run = createRun(seed, LEVELS[1]);
         while (!run.ended) step(run, 50, humanPacedInput(run));
         if (run.score >= clearScore) clears++;
      }
      expect(clears).toBeGreaterThanOrEqual(0.6 * 200);
   }, 60_000);

   it("uses core level specs for clocks, lighting, instructions and HUD maxima", () => {
      expect(LEVEL_IDS.map((id) => levelRunConfig(definition, id).durationMs)).toEqual([90_000, 120_000, 150_000, 180_000, 180_000]);
      expect(LEVEL_IDS.map((id) => levelHudStats(definition, id))).toEqual([
         [{ key: "combo", label: "Combo" }],
         [{ key: "caught", label: "Food", max: 25 }, { key: "drops", label: "Drops", max: 5 }],
         [{ key: "caught", label: "Food", max: 35 }, { key: "drops", label: "Drops", max: 5 }],
         [{ key: "caught", label: "Food", max: 45 }, { key: "drops", label: "Drops", max: 5 }],
         [{ key: "caught", label: "Food", max: 60 }, { key: "drops", label: "Drops", max: 5 }],
      ]);
      expect(LEVEL_IDS.map((id) => levelEnvironment(definition, id)?.lighting)).toEqual(["indoor", "day", "sunset", "night", "sunset"]);
      expect(levelInstructions(definition, 1)).toEqual(definition.instructions);
      expect(levelInstructions(definition, 2)).toContain("Finish fast: +20 for every second left. Five in a row score double.");
   });
});
