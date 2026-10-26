import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS, tasksOf } from "./levels";
import {
   AIR_MAX, ALGAE_HOLD_S, BASKET_R, CARRY_MAX, CLEAN_POINTS, COLUMN_R, CURRENT_ACCEL, FILTER_HOLD_S, FLOAT_H, FLOAT_S, HIGH_MIN_Y, LIVES,
   PROPOSED_LEVEL_LIMITS, RADIUS, SHARK_AIR, SHARK_MERCY_S, SHARK_PUSH, TASK_POINTS, TIME_BONUS_PER_SECOND, createRun, distanceToLoop, idleInput,
   loopPoints, objectivesReachable, objectiveCeiling, step, timeBonus, type AquariumInput, type Run,
} from "./rules";

const DT = 1 / 60;

function frames(run: Run, input: AquariumInput, seconds: number, left = 100_000): void {
   for (let i = 0; i < Math.round(seconds * 60); i++) step(run, input, DT, left);
}

function held(): AquariumInput {
   return { ...idleInput(), action: true };
}

/** Puts the diver on the stand point of algae `i`. */
function atAlgae(run: Run, i: number): void {
   run.hero.x = run.algae[i].stand.x;
   run.hero.z = run.algae[i].stand.z;
}

describe("aquarium layout", () => {
   it("is the same run for the same seed and reaches every objective (200 seeds x 5 levels)", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         for (let seed = 0; seed < 200; seed++) {
            const a = createRun(seed, level);
            const b = createRun(seed, level);
            expect(objectivesReachable(a)).toBe(true);
            expect(a.algae.map((p) => [p.x, p.z, p.high])).toEqual(b.algae.map((p) => [p.x, p.z, p.high]));
            expect(a.trash.map((t) => [t.x, t.z])).toEqual(b.trash.map((t) => [t.x, t.z]));
            expect(a.solids.map((s) => [s.kind, s.x, s.z])).toEqual(b.solids.map((s) => [s.kind, s.x, s.z]));
            expect(a.algae).toHaveLength(level.algae);
            expect(a.algae.filter((p) => p.high)).toHaveLength(level.highAlgae);
            expect(a.trash).toHaveLength(level.trash);
            expect(a.filters).toHaveLength(level.filters);
            expect(a.sharks).toHaveLength(level.sharks);
            expect(a.tasks).toBe(tasksOf(level));
            // every patch has a stand point within the 1.2 m work range, outside every solid
            for (const p of a.algae) expect(Math.hypot(p.stand.x - p.x, p.stand.z - p.z)).toBeLessThan(1.2);
            // solids keep a diver-wide lane between them
            for (let i = 0; i < a.solids.length; i++) {
               for (let j = i + 1; j < a.solids.length; j++) {
                  const s = a.solids[i];
                  const t = a.solids[j];
                  expect(Math.hypot(s.x - t.x, s.z - t.z)).toBeGreaterThanOrEqual(s.r + t.r + 0.9);
               }
            }
         }
      }
   }, 120_000);

   it("keeps every solid off the sharks' loop and leaves a 2 m lane along the glass", () => {
      for (const id of [3, 4, 5] as const) {
         const level = LEVELS[id];
         const points = loopPoints(level);
         for (let seed = 0; seed < 40; seed++) {
            const run = createRun(seed, level);
            for (const s of run.solids) expect(distanceToLoop(points, s.x, s.z)).toBeGreaterThanOrEqual(s.r + 1.2);
         }
         const xs = points.map((p) => p.x);
         const zs = points.map((p) => p.z);
         const lane = Math.min(Math.min(...xs) + level.width / 2, level.width / 2 - Math.max(...xs), Math.min(...zs) + level.depth / 2);
         expect(lane - 1.0).toBeGreaterThanOrEqual(2);
      }
   });
});

describe("aquarium work, air, float, carry", () => {
   it("scrubs an algae patch in 1.00 s of held Work and a filter in 1.50 s; releasing resets the hold", () => {
      const run = createRun(3, LEVELS[1]);
      atAlgae(run, 0);
      const input = held();
      frames(run, input, ALGAE_HOLD_S - 0.1);
      expect(run.algae[0].done).toBe(false);
      expect(run.holdTime).toBeGreaterThan(0.8);
      frames(run, idleInput(), 0.05);
      expect(run.holdTime).toBe(0);
      let t = 0;
      while (!run.algae[0].done && t < 2) {
         step(run, input, DT, 100_000);
         t += DT;
      }
      expect(t).toBeGreaterThanOrEqual(ALGAE_HOLD_S - DT);
      expect(t).toBeLessThan(ALGAE_HOLD_S + 2 * DT);

      const f = createRun(3, LEVELS[1]);
      f.hero.x = f.filters[0].x + 1.12;
      f.hero.z = f.filters[0].z;
      f.hero.x = Math.min(f.hx - RADIUS, f.hero.x);
      let u = 0;
      while (!f.filters[0].done && u < 3) {
         step(f, input, DT, 100_000);
         u += DT;
      }
      expect(f.filters[0].done).toBe(true);
      expect(u).toBeGreaterThanOrEqual(FILTER_HOLD_S - DT);
      expect(u).toBeLessThan(FILTER_HOLD_S + 2 * DT);
   });

   it("leaving the 1.2 m range resets the hold", () => {
      const run = createRun(5, LEVELS[1]);
      atAlgae(run, 0);
      frames(run, held(), 0.5);
      expect(run.holdTime).toBeGreaterThan(0.4);
      run.hero.x += run.algae[0].wall === 1 ? 2 : run.algae[0].wall === 2 ? -2 : 0;
      run.hero.z += run.algae[0].wall === 0 ? 2 : 0;
      frames(run, held(), 2 * DT);
      expect(run.holdTime).toBeLessThan(0.1);
   });

   it("a high patch does not progress while the diver is below 1.0 m, and does while floating above it", () => {
      const run = createRun(7, LEVELS[2]);
      const i = run.algae.findIndex((a) => a.high);
      expect(i).toBeGreaterThanOrEqual(0);
      atAlgae(run, i);
      frames(run, held(), 3);
      expect(run.algae[i].done).toBe(false);
      expect(run.holdTime).toBe(0);
      // float: Space once, hold Work through two floats
      const input = held();
      let t = 0;
      let peak = 0;
      let above = 0;
      while (!run.algae[i].done && t < 6) {
         input.jumpPressed = run.hero.float <= 0 && run.hero.y <= HIGH_MIN_Y;
         step(run, input, DT, 100_000);
         peak = Math.max(peak, run.hero.y);
         if (run.hero.y > HIGH_MIN_Y) above += DT;
         t += DT;
      }
      expect(run.algae[i].done).toBe(true);
      expect(peak).toBeGreaterThan(FLOAT_H - 0.05);
      expect(peak).toBeLessThanOrEqual(FLOAT_H + 1e-9);
      expect(above).toBeGreaterThanOrEqual(ALGAE_HOLD_S - 2 * DT);
   });

   it("floats up once per 0.9 s arc and cannot re-float in the air", () => {
      const run = createRun(1, LEVELS[1]);
      const input = idleInput();
      input.jumpPressed = true;
      step(run, input, DT, 100_000);
      expect(run.ev.float).toBe(true);
      let t = DT;
      let floats = 0;
      while (run.hero.float > 0) {
         step(run, input, DT, 100_000);
         if (run.ev.float) floats += 1;
         t += DT;
      }
      expect(floats).toBe(0);
      expect(t).toBeGreaterThanOrEqual(FLOAT_S - DT);
      expect(t).toBeLessThanOrEqual(FLOAT_S + 2 * DT);
      expect(run.hero.y).toBe(0);
   });

   it("air 0 costs one life, drops the carried trash where the diver was and respawns at the entry with full air", () => {
      const run = createRun(2, LEVELS[3]);
      const t = run.trash[0];
      run.hero.x = t.x;
      run.hero.z = t.z;
      step(run, idleInput(), DT, 100_000);
      expect(run.carried).toEqual([0]);
      const x = run.hero.x;
      const z = run.hero.z;
      run.hero.air = 0.01;
      step(run, idleInput(), DT, 100_000);
      expect(run.ev.airOut).toBe(true);
      expect(run.ev.lifeLost).toBe(true);
      expect(run.lives).toBe(LIVES - 1);
      expect(run.hero.air).toBe(AIR_MAX);
      expect(run.hero.x).toBe(run.entry.x);
      expect(run.hero.z).toBe(run.entry.z);
      expect(run.carried).toEqual([]);
      expect(run.trash[0].state).toBe(0);
      expect(run.trash[0].x).toBe(x);
      expect(run.trash[0].z).toBe(z);
   });

   it("three lives lost ends the run", () => {
      const run = createRun(2, LEVELS[1]);
      for (let i = 0; i < LIVES; i++) {
         run.hero.air = 0.001;
         step(run, idleInput(), DT, 100_000);
      }
      expect(run.over).toBe("lose");
      expect(run.ev.lost).toBe(true);
   });

   it("a shark costs 30 air once per 0.8 s mercy and pushes the diver 1.5 m", () => {
      const run = createRun(4, LEVELS[3]);
      const shark = run.sharks[0];
      run.hero.x = shark.x + 0.5;
      run.hero.z = shark.z;
      // keep the hero out of the bubble column and away from solids for a clean push
      const before = { x: run.hero.x, z: run.hero.z };
      const air = run.hero.air;
      step(run, idleInput(), DT, 100_000);
      expect(run.ev.sharkHit).toBe(true);
      expect(air - run.hero.air).toBeGreaterThanOrEqual(SHARK_AIR);
      expect(air - run.hero.air).toBeLessThan(SHARK_AIR + 1);
      expect(Math.hypot(run.hero.x - before.x, run.hero.z - before.z)).toBeGreaterThan(SHARK_PUSH - 0.6);
      // a second overlap inside the mercy costs nothing
      run.hero.x = shark.x;
      run.hero.z = shark.z;
      const air2 = run.hero.air;
      frames(run, idleInput(), SHARK_MERCY_S - 0.1);
      expect(air2 - run.hero.air).toBeLessThan(2);
      expect(run.mercy).toBeGreaterThan(0);
   });

   it("trash is collected on overlap up to three and emptied in the basket, one task each", () => {
      const run = createRun(6, LEVELS[5]);
      expect(run.trash.length).toBe(3);
      for (const t of run.trash) {
         run.hero.x = t.x;
         run.hero.z = t.z;
         step(run, idleInput(), DT, 100_000);
      }
      expect(run.carried).toHaveLength(CARRY_MAX);
      // a fourth item is not taken while the hands are full
      run.trash.push({ x: run.hero.x + 0.1, z: run.hero.z, state: 0, spin: 0 });
      step(run, idleInput(), DT, 100_000);
      expect(run.carried).toHaveLength(CARRY_MAX);
      expect(run.trash[3].state).toBe(0);
      run.hero.air = 80;
      run.hero.x = run.basket.x;
      run.hero.z = run.basket.z;
      step(run, idleInput(), DT, 100_000);
      expect(run.ev.bin).toBe(true);
      expect(run.carried).toHaveLength(0);
      expect(run.done).toBe(3);
      expect(run.score).toBe(3 * (TASK_POINTS + CLEAN_POINTS));
   });

   it("pays 120, and 30 more only when the task finished with air above 50", () => {
      const rich = createRun(3, LEVELS[1]);
      atAlgae(rich, 0);
      rich.hero.air = 60;
      frames(rich, held(), 1.2);
      expect(rich.score).toBe(TASK_POINTS + CLEAN_POINTS);
      const poor = createRun(3, LEVELS[1]);
      atAlgae(poor, 0);
      poor.hero.air = 49;
      frames(poor, held(), 1.2);
      expect(poor.score).toBe(TASK_POINTS);
      const edge = createRun(3, LEVELS[1]);
      atAlgae(edge, 0);
      edge.hero.air = 52;
      frames(edge, held(), 1.2);
      // the air at the finishing frame is what counts: 52 minus about 1.8 s of working drain stays above 50
      expect(edge.score).toBe(TASK_POINTS + CLEAN_POINTS);
   });

   it("working drains 1.5x as fast, and the bubble column refills 25 per second", () => {
      const idle = createRun(3, LEVELS[1]);
      frames(idle, idleInput(), 4);
      const spent = AIR_MAX - idle.hero.air;
      expect(spent).toBeCloseTo(LEVELS[1].airDrain * 4, 1);
      const work = createRun(3, LEVELS[1]);
      atAlgae(work, 0);
      work.algae[0].done = true;
      work.filters.forEach((f) => (f.done = true));
      work.hero.x = work.filters[0].x + 1.12;
      work.hero.z = work.filters[0].z;
      work.hero.x = Math.min(work.hx - RADIUS, work.hero.x);
      work.filters[0].done = false;
      frames(work, held(), 1.0);
      expect(AIR_MAX - work.hero.air).toBeCloseTo(LEVELS[1].airDrain * 1.5 * 1.0, 1);
      const refill = createRun(3, LEVELS[1]);
      refill.hero.air = 10;
      refill.hero.x = refill.column.x;
      refill.hero.z = refill.column.z;
      frames(refill, idleInput(), 2);
      expect(refill.hero.air).toBeCloseTo(60, 0);
      void COLUMN_R;
   });

   it("the exit hatch does not win before the list is done, then wins and pays 4 per second left", () => {
      const run = createRun(8, LEVELS[1]);
      run.hero.x = run.hatch.x;
      run.hero.z = run.hatch.z;
      step(run, idleInput(), DT, 90_000);
      expect(run.over).toBeNull();
      run.algae.forEach((a) => (a.done = true));
      run.filters.forEach((f) => (f.done = true));
      run.trash.forEach((t) => (t.state = 2));
      run.done = run.tasks;
      step(run, idleInput(), DT, 90_000);
      expect(run.over).toBe("win");
      expect(run.ev.won).toBe(true);
      expect(run.score).toBe(timeBonus(90_000));
      expect(timeBonus(90_000)).toBe(TIME_BONUS_PER_SECOND * 90);
      expect(timeBonus(89_999)).toBe(TIME_BONUS_PER_SECOND * 89);
      expect(timeBonus(0)).toBe(0);
   });

   it("the current drifts the diver at 0.5 m/s in world x on level 5 only", () => {
      const calm = createRun(1, LEVELS[4]);
      calm.hero.x = 0;
      calm.hero.z = 0;
      frames(calm, idleInput(), 2);
      expect(Math.abs(calm.hero.vx)).toBeLessThan(1e-9);
      const wet = createRun(1, LEVELS[5]);
      wet.hero.x = -3;
      wet.hero.z = 2;
      const x0 = wet.hero.x;
      frames(wet, idleInput(), 2);
      expect(wet.hero.vx).toBeCloseTo(CURRENT_ACCEL, 3);
      expect(wet.hero.x - x0).toBeGreaterThan(0.7);
   });

   it("keyboard and touch share one step: the same input gives the same run", () => {
      const a = createRun(9, LEVELS[2]);
      const b = createRun(9, LEVELS[2]);
      const input = { moveX: 0.6, moveY: -0.4, action: true, jumpPressed: false, yaw: 0 };
      for (let i = 0; i < 120; i++) {
         step(a, input, DT, 100_000);
         step(b, { ...input }, DT, 100_000);
      }
      expect(a.hero).toEqual(b.hero);
      expect(a.score).toBe(b.score);
   });
});

describe("aquarium score limits", () => {
   it("pays at most 150 per task before the clock bonus", () => {
      for (const id of LEVEL_IDS) expect(objectiveCeiling(LEVELS[id])).toBe(150 * tasksOf(LEVELS[id]));
   });

   // the bots and the per-level proof: proof.level-N.test.ts (testing/proof.ts)
});

describe("aquarium per-level reads", () => {
   it("the tank, the air drain and the shark speed come from the level being played", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const run = createRun(7, level);
         expect([run.hx * 2, run.hz * 2]).toEqual([level.width, level.depth]);
         // air: 2 s of standing still at the entry (away from the column) drains airDrain per second
         const air = run.hero.air;
         for (let i = 0; i < 120; i++) step(run, idleInput(), DT, 100_000);
         expect(air - run.hero.air).toBeCloseTo(level.airDrain * 2, 6);
         // sharks: the path travelled in 0.5 s is sharkSpeed x 0.5
         const sharks = createRun(7, level);
         expect(sharks.sharks.length).toBe(level.sharks);
         if (level.sharks > 0) {
            let travelled = 0;
            for (let i = 0; i < 30; i++) {
               const x = sharks.sharks[0].x;
               const z = sharks.sharks[0].z;
               step(sharks, idleInput(), DT, 100_000);
               travelled += Math.hypot(sharks.sharks[0].x - x, sharks.sharks[0].z - z);
            }
            expect(travelled).toBeCloseTo(level.sharkSpeed * 0.5, 1);
         }
      }
   });
});
