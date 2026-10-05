import { describe, expect, it } from "vitest";
import {
   BAD_KINDS,
   CATCH_BOX,
   CHEF,
   COMBO_DOUBLE_AT,
   DOUBLE_POINTS,
   FALL_DISTANCE,
   GOOD_KINDS,
   GOOD_POINTS,
   LIVES,
   MAX_ALIVE,
   MAX_SCORE,
   ROUND_MS,
   SPAWN_X,
   SPAWN_Y,
   STEPS,
   buildPlan,
   catchPoints,
   createRng,
   createRun,
   finalScore,
   gapForWaitStart,
   itemY,
   overlapsCatchBox,
   spawnTimes,
   splitDt,
   step,
   withinServerLimits,
   type RunState,
   type StepInput,
} from "./rules";

const DT = 50;
const DT_60 = 16.7;
const SEEDS = Array.from({ length: 1000 }, (_v, i) => i + 1);

function play(state: RunState, dt: number, inputFor: (state: RunState, dt: number) => StepInput, stop?: (state: RunState) => boolean): { caught: number; missed: number; badCaught: number } {
   let caught = 0;
   let missed = 0;
   let badCaught = 0;
   let guard = 0;
   while (!state.ended && guard++ < 200_000) {
      if (stop && stop(state)) break;
      const ev = step(state, dt, inputFor(state, dt));
      caught += ev.caught;
      missed += ev.missed;
      badCaught += ev.badCaught;
   }
   return { caught, missed, badCaught };
}

/** Chef is already under whichever item crosses on the next frame. That is perfect play. */
function perfectInput(state: RunState, dt: number): StepInput {
   const next = Math.min(ROUND_MS, state.elapsedMs + splitDt(state.carryMs, dt).wholeMs);
   let x: number | null = null;
   let best = Infinity;
   for (let i = 0; i < state.items.length; i++) {
      const item = state.items[i];
      if (!item.active) continue;
      const y0 = itemY(item.bornMs, state.elapsedMs, item.speed);
      const y1 = itemY(item.bornMs, next, item.speed);
      if (y0 > CATCH_BOX.top && y1 <= CATCH_BOX.top && item.spawnIndex < best) {
         best = item.spawnIndex;
         x = item.x;
      }
   }
   if (x === null) return { dir: 0 };
   state.chefX = x;
   state.chefV = 0;
   return { targetX: x };
}

/** Walk toward the bad item that reaches the box first. */
function catchBadInput(state: RunState): StepInput {
   let x: number | null = null;
   let best = Infinity;
   for (let i = 0; i < state.items.length; i++) {
      const item = state.items[i];
      if (!item.active || !item.bad) continue;
      const y = itemY(item.bornMs, state.elapsedMs, item.speed);
      const eta = (y - CATCH_BOX.top) / item.speed;
      if (eta < best) {
         best = eta;
         x = item.x;
      }
   }
   if (x === null) return { dir: 0 };
   return { targetX: x };
}

describe("schedule", () => {
   it("emits the 126 integer spawn times from the gap table", () => {
      const times = spawnTimes();
      expect(times).toHaveLength(126);
      expect(times.slice(0, 6)).toEqual([1200, 2400, 3600, 4800, 6000, 7200]);
      expect(times[times.length - 1]).toBe(89_950);
      const counts = STEPS.map((row) => times.filter((t) => t >= row.start && t < row.end).length);
      expect(counts).toEqual([12, 15, 18, 24, 27, 30]);
      for (let i = 0; i < times.length; i++) {
         expect(Number.isInteger(times[i])).toBe(true);
         const gap = i === 0 ? times[0] : times[i] - times[i - 1];
         const waitStart = i === 0 ? 0 : times[i - 1];
         expect(gap).toBe(gapForWaitStart(waitStart));
         expect(gap).toBeGreaterThanOrEqual(500);
      }
   });

   it("keeps the first three spawns good for every seed, and a new seed changes x or kind", () => {
      const times = spawnTimes();
      for (let s = 0; s < SEEDS.length; s++) {
         const plan = buildPlan(SEEDS[s]);
         expect(plan.map((p) => p.time)).toEqual(times);
         expect(plan[0].bad).toBe(false);
         expect(plan[1].bad).toBe(false);
         expect(plan[2].bad).toBe(false);
         expect(GOOD_KINDS).toContain(plan[0].kind);
      }
      const a = buildPlan(1);
      const b = buildPlan(2);
      const same = a.every((p, i) => p.x === b[i].x && p.kind === b[i].kind && p.bad === b[i].bad);
      expect(same).toBe(false);
      expect(a.map((p) => p.time)).toEqual(b.map((p) => p.time));
   });

   it("keeps spawns 0-2 good and matches each step's bad chance over 2000 seeds", () => {
      const tallies = STEPS.map(() => ({ bad: 0, total: 0 }));
      for (let seed = 1; seed <= 2000; seed++) {
         const plan = buildPlan(seed);
         expect(plan[0].bad).toBe(false);
         expect(plan[1].bad).toBe(false);
         expect(plan[2].bad).toBe(false);
         for (let i = 3; i < plan.length; i++) {
            const row = STEPS.findIndex((stepRow) => plan[i].time >= stepRow.start && plan[i].time < stepRow.end);
            expect(row).toBeGreaterThanOrEqual(0);
            tallies[row].total += 1;
            if (plan[i].bad) tallies[row].bad += 1;
         }
      }
      for (let row = 0; row < STEPS.length; row++) {
         expect(tallies[row].bad).toBeGreaterThan(0);
         expect(tallies[row].total).toBeGreaterThan(0);
         const rate = tallies[row].bad / tallies[row].total;
         expect(Math.abs(rate - STEPS[row].badChance)).toBeLessThanOrEqual(0.03);
      }
   });

   it("changes kinds with the seed, shows every kind, and reaches both ends of the spawn line", () => {
      expect(buildPlan(1).map((spawn) => spawn.kind)).not.toEqual(buildPlan(2).map((spawn) => spawn.kind));
      const goods = new Set<string>();
      const bads = new Set<string>();
      let minX = Infinity;
      let maxX = -Infinity;
      for (let seed = 1; seed <= 2000; seed++) {
         const plan = buildPlan(seed);
         for (let i = 0; i < plan.length; i++) {
            if (plan[i].x < minX) minX = plan[i].x;
            if (plan[i].x > maxX) maxX = plan[i].x;
            if (plan[i].bad) bads.add(plan[i].kind);
            else goods.add(plan[i].kind);
         }
      }
      for (let i = 0; i < GOOD_KINDS.length; i++) expect(goods.has(GOOD_KINDS[i])).toBe(true);
      for (let i = 0; i < BAD_KINDS.length; i++) expect(bads.has(BAD_KINDS[i])).toBe(true);
      expect(minX).toBeGreaterThanOrEqual(SPAWN_X.min);
      expect(maxX).toBeLessThanOrEqual(SPAWN_X.max);
      expect(minX).toBeLessThanOrEqual(SPAWN_X.min + 0.2);
      expect(maxX).toBeGreaterThanOrEqual(SPAWN_X.max - 0.2);
   });
});

describe("movement and the catch box", () => {
   it("accelerates to 9 in 0.2 s and decelerates back to 0", () => {
      const state = createRun(1);
      step(state, 200, { dir: 1 });
      expect(state.chefV).toBe(9);
      expect(state.chefX).toBeCloseTo(1.8, 10);
      step(state, 200, { dir: 0 });
      expect(state.chefV).toBe(0);
   });

   it("walks toward a touch x at most 9 * dt and does not pass it", () => {
      const state = createRun(1);
      step(state, 100, { targetX: 10 });
      expect(state.chefX).toBeCloseTo(0.9, 10);
      step(state, 1000, { targetX: 1 });
      expect(state.chefX).toBeCloseTo(1, 10);
   });

   it("clamps the chef so the catch box stays inside x [-4.2, 4.2]", () => {
      const state = createRun(1);
      step(state, 1000, { targetX: 99 });
      expect(state.chefX).toBe(CHEF.maxX);
      expect(state.chefX - CATCH_BOX.halfWidth).toBeGreaterThanOrEqual(-4.2);
      expect(state.chefX + CATCH_BOX.halfWidth).toBeLessThanOrEqual(4.2);
      step(state, 1000, { targetX: -99 });
      expect(state.chefX).toBe(CHEF.minX);
   });

   it("catches only on the frame the centre crosses y = 1.6", () => {
      expect(FALL_DISTANCE).toBeCloseTo(4.4, 10);
      expect(itemY(1200, 1200, 1.6)).toBe(SPAWN_Y);
      expect(itemY(1200, 3900, 1.6)).toBeGreaterThan(CATCH_BOX.top);
      expect(itemY(1200, 3950, 1.6)).toBeLessThanOrEqual(CATCH_BOX.top);
      expect(overlapsCatchBox(0, 1.6, 0)).toBe(true);
      expect(overlapsCatchBox(3.4, 1.6, 0)).toBe(false);
      expect(overlapsCatchBox(1.05, 1.6, 0)).toBe(true);
      expect(overlapsCatchBox(-1.05, 1.6, 0)).toBe(true);
      expect(overlapsCatchBox(1.06, 1.6, 0)).toBe(false);
      expect(overlapsCatchBox(-1.06, 1.6, 0)).toBe(false);
   });

   it("catches x = 1.0 on the crossing frame and misses x = 1.1", () => {
      const caught = createRun(1);
      caught.elapsedMs = 3900;
      caught.nextSpawn = caught.plan.length;
      caught.alive = 1;
      const hit = caught.items[0];
      hit.active = true;
      hit.bad = false;
      hit.kind = "apple";
      hit.x = 1;
      hit.speed = 1.6;
      hit.bornMs = 1200;
      hit.spawnIndex = 0;
      expect(step(caught, DT, { dir: 0 }).caught).toBe(1);

      const missed = createRun(1);
      missed.elapsedMs = 3900;
      missed.nextSpawn = missed.plan.length;
      missed.alive = 1;
      const miss = missed.items[0];
      miss.active = true;
      miss.bad = false;
      miss.kind = "apple";
      miss.x = 1.1;
      miss.speed = 1.6;
      miss.bornMs = 1200;
      miss.spawnIndex = 0;
      expect(step(missed, DT, { dir: 0 }).missed).toBe(1);
   });

   it("treats NaN and Infinity as no touch target and uses the keyboard", () => {
      const nan = createRun(1);
      step(nan, 200, { targetX: Number.NaN, dir: 1 });
      expect(nan.chefV).toBe(9);
      expect(nan.chefX).toBeCloseTo(1.8, 10);

      const infinite = createRun(1);
      step(infinite, 200, { targetX: Number.POSITIVE_INFINITY, dir: -1 });
      expect(infinite.chefV).toBe(-9);
      expect(infinite.chefX).toBeCloseTo(-1.8, 10);
   });

   it("keeps elapsedMs a whole number and parks the fractional dt in carryMs", () => {
      expect(splitDt(0, 50)).toEqual({ wholeMs: 50, carryMs: 0 });
      expect(splitDt(0, 16.7)).toEqual({ wholeMs: 16, carryMs: 0.7 });
      const state = createRun(1);
      step(state, 16.7, { dir: 0 });
      expect(state.elapsedMs).toBe(16);
      expect(state.carryMs).toBeCloseTo(0.7, 10);
      expect(Number.isInteger(state.elapsedMs)).toBe(true);
      for (let i = 0; i < 5000; i++) {
         step(state, 16.7, { dir: 0 });
         expect(Number.isInteger(state.elapsedMs)).toBe(true);
         expect(state.carryMs).toBeGreaterThanOrEqual(0);
         expect(state.carryMs).toBeLessThan(1);
      }
   });
});

describe("scoring", () => {
   function align(seed: number, forceGood = false): RunState {
      const state = createRun(seed, { forceGood });
      for (let i = 0; i < state.plan.length; i++) state.plan[i].x = 0;
      return state;
   }

   it("scores +10 for the first four good catches and +20 from the fifth", () => {
      expect(catchPoints(4)).toBe(GOOD_POINTS);
      expect(catchPoints(COMBO_DOUBLE_AT)).toBe(DOUBLE_POINTS);
      const state = align(1, true);
      const got: number[] = [];
      play(state, DT, () => ({ dir: 0 }), (s) => {
         if (s.combo >= 6) return true;
         return false;
      });
      // replay the awards from the combo rule
      let combo = 0;
      let score = 0;
      while (combo < 6) {
         combo += 1;
         const pts = catchPoints(combo);
         score += pts;
         got.push(pts);
      }
      expect(got).toEqual([10, 10, 10, 10, 20, 20]);
      expect(state.combo).toBe(6);
      expect(state.score).toBe(score);
   });

   /** One item, one frame before it crosses y = 1.6. No further spawns. */
   function crossing(partial: { bad: boolean; x: number; combo: number; score?: number; lives?: number }): RunState {
      const state = createRun(1);
      state.elapsedMs = 3900;
      state.nextSpawn = state.plan.length;
      state.combo = partial.combo;
      state.score = partial.score ?? 0;
      state.lives = partial.lives ?? LIVES;
      state.alive = 1;
      const item = state.items[0];
      item.active = true;
      item.bad = partial.bad;
      item.kind = partial.bad ? "sock" : "apple";
      item.x = partial.x;
      item.speed = 1.6;
      item.bornMs = 1200;
      item.spawnIndex = 0;
      return state;
   }

   it("resets the combo when a good item is missed, and not when a bad item is dodged", () => {
      const missed = crossing({ bad: false, x: 3.4, combo: 5, score: 100 });
      const ev = step(missed, DT, { dir: 0 });
      expect(ev.missed).toBe(1);
      expect(ev.caught).toBe(0);
      expect(missed.combo).toBe(0);
      expect(missed.score).toBe(100);
      expect(missed.lives).toBe(LIVES);

      const dodged = crossing({ bad: true, x: 3.4, combo: 5, score: 100 });
      const dodge = step(dodged, DT, { dir: 0 });
      expect(dodge.missed).toBe(0);
      expect(dodge.badCaught).toBe(0);
      expect(dodge.lifeLost).toBe(false);
      expect(dodged.combo).toBe(5);
      expect(dodged.lives).toBe(LIVES);
      expect(dodged.score).toBe(100);

      const next = crossing({ bad: false, x: 0, combo: 5, score: 100 });
      const got = step(next, DT, { dir: 0 });
      expect(got.caught).toBe(1);
      expect(next.combo).toBe(6);
      expect(next.score - 100).toBe(DOUBLE_POINTS);
   });

   it("resets the combo and costs a life when a bad item is caught", () => {
      const state = crossing({ bad: true, x: 0, combo: 5, score: 100 });
      const ev = step(state, DT, { dir: 0 });
      expect(ev.badCaught).toBe(1);
      expect(ev.lifeLost).toBe(true);
      expect(ev.caught).toBe(0);
      expect(state.lives).toBe(2);
      expect(state.combo).toBe(0);
      expect(state.score).toBe(100);
   });

   it("ends at 9950 ms when the earliest three bad items are caught", () => {
      const state = createRun(1);
      for (let i = 0; i < state.plan.length; i++) {
         state.plan[i].x = i >= 3 && i <= 5 ? 0 : 3.4;
         if (i >= 3 && i <= 5) {
            state.plan[i].bad = true;
            state.plan[i].kind = "sock";
         }
      }
      play(state, DT, () => ({ dir: 0 }));
      expect(state.ended).toBe("lose");
      expect(state.elapsedMs).toBe(9950);
      expect(state.lives).toBe(0);
      expect(finalScore(state.score, state.elapsedMs).score).toBe(state.score);
   });

   it("ends on the clock at 90 s", () => {
      const state = createRun(1, { forceGood: true });
      play(state, DT, perfectInput);
      expect(state.ended).toBe("timeup");
      expect(state.elapsedMs).toBe(ROUND_MS);
   });

   it("scores exactly 2420 on perfect play at 50 ms", () => {
      const state = createRun(4, { forceGood: true });
      const tally = play(state, DT, perfectInput);
      expect(tally.caught).toBe(123);
      expect(tally.missed).toBe(0);
      expect(tally.badCaught).toBe(0);
      expect(state.score).toBe(2420);
      expect(finalScore(state.score, state.elapsedMs)).toEqual({ score: 2420, durationMs: ROUND_MS });
      expect(withinServerLimits(state.score, state.elapsedMs)).toBe(true);
   });

   it("measures perfect play at 16.7 ms and keeps it inside the cap", () => {
      const state = createRun(4, { forceGood: true });
      const tally = play(state, DT_60, perfectInput);
      const fromCatches = tally.caught < 5 ? GOOD_POINTS * tally.caught : DOUBLE_POINTS * tally.caught - 40;
      expect(state.score).toBe(fromCatches);
      expect(tally.missed).toBe(0);
      expect(state.ended).toBe("timeup");
      expect(state.elapsedMs).toBe(ROUND_MS);
      expect(state.score).toBeLessThanOrEqual(MAX_SCORE);
      expect(state.score * 1000).toBeLessThanOrEqual(50 * state.elapsedMs);
      expect(finalScore(state.score, state.elapsedMs).score).toBe(state.score);
      // locked after the first measurement so a later change cannot drift silently
      expect(tally.caught).toBe(123);
      expect(state.score).toBe(2420);
   });
});

describe("limits", () => {
   it("does not lose a life before 5 s for 1000 seeds, even when every bad item is chased", () => {
      for (let s = 0; s < SEEDS.length; s++) {
         const state = createRun(SEEDS[s]);
         play(state, DT, () => catchBadInput(state), (run) => run.elapsedMs >= 5000);
         expect(state.ended).toBeNull();
         expect(state.lives).toBe(LIVES);
         expect(state.elapsedMs).toBeGreaterThanOrEqual(5000);
      }
   });

   it("stays under 5000 and under 50 points per second for many seeds and frame steps", () => {
      const dts = [DT_60, DT, 33, 100];
      for (let s = 0; s < 25; s++) {
         for (let d = 0; d < dts.length; d++) {
            const chased = createRun(100 + s * 17);
            play(chased, dts[d], () => catchBadInput(chased));
            expect(chased.score).toBeLessThanOrEqual(MAX_SCORE);
            expect(chased.score * 1000).toBeLessThanOrEqual(50 * chased.elapsedMs);
            expect(finalScore(chased.score, chased.elapsedMs).score).toBeLessThanOrEqual(chased.score);
            const perfect = createRun(200 + s * 17, { forceGood: true });
            play(perfect, dts[d], perfectInput);
            expect(perfect.score).toBeLessThanOrEqual(MAX_SCORE);
            expect(perfect.score * 1000).toBeLessThanOrEqual(50 * perfect.elapsedMs);
            expect(withinServerLimits(perfect.score, perfect.elapsedMs)).toBe(true);
         }
      }
   });

   it("clamps an over-cap score", () => {
      expect(finalScore(9000, 90_000)).toEqual({ score: 4500, durationMs: 90_000 });
      expect(finalScore(100, 1000)).toEqual({ score: 50, durationMs: 1000 });
      expect(finalScore(2420, 90_000).score).toBe(2420);
   });

   it("skips a spawn the 16 cap refuses and does not release it later", () => {
      const state = createRun(1, { maxAlive: 1 });
      expect(MAX_ALIVE).toBe(16);
      play(state, DT, () => ({ dir: 0 }), (s) => s.elapsedMs >= 2400);
      expect(state.alive).toBe(1);
      expect(state.items.some((item) => item.active && item.spawnIndex === 0)).toBe(true);
      expect(state.nextSpawn).toBe(2);
      play(state, DT, () => ({ dir: 0 }), (s) => s.elapsedMs >= 4800);
      const seen = state.items.filter((item) => item.active).map((item) => item.spawnIndex);
      expect(seen).toEqual([3]);
      expect(seen).not.toContain(1);
      expect(seen).not.toContain(2);
   });

   it("ends once when a last life and the clock land on the same frame", () => {
      const state = createRun(1);
      state.elapsedMs = 89_950;
      state.lives = 1;
      state.nextSpawn = state.plan.length;
      state.alive = 1;
      const item = state.items[0];
      item.active = true;
      item.bad = true;
      item.kind = "sock";
      item.x = 0;
      item.speed = 1.6;
      item.bornMs = 87_250;
      item.spawnIndex = 0;
      const ev = step(state, DT, { dir: 0 });
      expect(ev.ended).toBe("lose");
      expect(ev.lifeLost).toBe(true);
      expect(state.ended).toBe("lose");
      expect(state.elapsedMs).toBe(ROUND_MS);
      const score = state.score;
      const again = step(state, DT, { dir: 0 });
      expect(again.ended).toBeNull();
      expect(again.lifeLost).toBe(false);
      expect(state.score).toBe(score);
      expect(state.elapsedMs).toBe(ROUND_MS);
   });

   it("repeats a seeded run and ignores a non-positive dt", () => {
      const once = createRun(99);
      const twice = createRun(99);
      expect(once.plan).toEqual(twice.plan);
      play(once, DT, () => ({ dir: 1 }), (s) => s.elapsedMs >= 10_000);
      play(twice, DT, () => ({ dir: 1 }), (s) => s.elapsedMs >= 10_000);
      expect(twice.score).toBe(once.score);
      expect(twice.chefX).toBe(once.chefX);
      expect(twice.combo).toBe(once.combo);
      const before = once.elapsedMs;
      step(once, 0, { dir: 1 });
      step(once, -5, { dir: 1 });
      expect(once.elapsedMs).toBe(before);
      expect(createRng(1)()).toBe(createRng(1)());
   });
});
