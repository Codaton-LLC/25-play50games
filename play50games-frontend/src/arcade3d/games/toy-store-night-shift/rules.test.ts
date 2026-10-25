import { describe, expect, it } from "vitest";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS, shelvesOf } from "./levels";
import {
   CARRY_SPEED, CLEAN_POINTS, MAX_SPEED, MERCY_S, PROPOSED_LEVEL_LIMITS, REACH, RIGHT_POINTS, SHELF_GAP, STUN_S, TIME_BONUS_PER_SECOND, WINDUP_HIT,
   createRun, distanceToShelf, idleInput, objectiveCeiling, objectivesReachable, rowCount, standable, step, timeBonus, type Run, type ToyInput,
} from "./rules";
import { play } from "./testing/bot";

const DT = 1 / 60;
/** No wind-ups: a rules check that is not about them. */
const calm = (r: Run): Run => {
   r.windups.length = 0;
   return r;
};
const use = (): ToyInput => ({ ...idleInput(), use: true });

/** Puts the guard at the front of shelf `s`, 0.8 m off its face. */
function atShelf(run: Run, s: number): void {
   const shelf = run.shelves[s];
   run.hero.x = shelf.x;
   run.hero.z = shelf.maxZ + 0.8;
   run.hero.vx = 0;
   run.hero.vz = 0;
}

function atToy(run: Run, i: number): void {
   run.hero.x = run.toys[i].x;
   run.hero.z = run.toys[i].z + 0.3;
   run.hero.vx = 0;
   run.hero.vz = 0;
}

/** Picks toy `i` up with one Use press. */
function pick(run: Run, i: number): void {
   atToy(run, i);
   step(run, use(), DT, 100_000);
   expect(run.toys[i].state).toBe(1);
}

/** First toy index of a kind, optionally one that is still on the floor. */
const toyOf = (run: Run, cat: string, not = -1) => run.toys.findIndex((t, i) => t.cat === cat && i !== not && t.state === 0);
const shelfOf = (run: Run, cat: string, other = false) => run.shelves.findIndex((s) => (other ? s.cat !== cat : s.cat === cat));

describe("toy store layout", () => {
   it("is the same run for the same seed and reaches every toy and shelf front (200 seeds x 5 levels)", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         for (let seed = 0; seed < 200; seed++) {
            const a = createRun(seed, level);
            const b = createRun(seed, level);
            expect(objectivesReachable(a)).toBe(true);
            expect(a.toys.map((t) => [t.cat, t.x, t.z])).toEqual(b.toys.map((t) => [t.cat, t.x, t.z]));
            expect(a.shelves.map((s) => [s.cat, s.x, s.z])).toEqual(b.shelves.map((s) => [s.cat, s.x, s.z]));
            expect(a.shelves).toHaveLength(shelvesOf(level));
            expect(a.toys).toHaveLength(level.toys);
            expect(a.windups).toHaveLength(level.windups);
            // one shelf per kind (two from level 3), every kind with a toy
            const kinds = new Set(a.shelves.map((s) => s.cat));
            expect(kinds.size).toBe(level.categories);
            for (const cat of kinds) expect(a.shelves.filter((s) => s.cat === cat)).toHaveLength(level.shelvesPerCategory);
            for (const cat of kinds) expect(a.toys.some((t) => t.cat === cat)).toBe(true);
            // toys: at least 1.5 m apart, never in a shelf, clear of the start
            for (let i = 0; i < a.toys.length; i++) {
               expect(standable(a, a.toys[i].x, a.toys[i].z, 0.3)).toBe(true);
               for (let j = i + 1; j < a.toys.length; j++) expect(Math.hypot(a.toys[i].x - a.toys[j].x, a.toys[i].z - a.toys[j].z)).toBeGreaterThanOrEqual(1.5);
            }
            // aisles at least 1.4 m wide: between shelves of a row, between rows, and to the walls
            for (let i = 0; i < a.shelves.length; i++) {
               const s = a.shelves[i];
               expect(a.hx - s.maxX).toBeGreaterThanOrEqual(1.4);
               expect(s.minX + a.hx).toBeGreaterThanOrEqual(1.4);
               expect(a.hz - s.maxZ).toBeGreaterThanOrEqual(1.4);
               expect(s.minZ + a.hz).toBeGreaterThanOrEqual(1.4);
               for (let j = i + 1; j < a.shelves.length; j++) {
                  const t = a.shelves[j];
                  const gapX = Math.max(t.minX - s.maxX, s.minX - t.maxX);
                  const gapZ = Math.max(t.minZ - s.maxZ, s.minZ - t.maxZ);
                  expect(Math.max(gapX, gapZ)).toBeGreaterThanOrEqual(Math.min(SHELF_GAP, 1.4) - 1e-9);
               }
            }
         }
      }
   }, 120_000);

   it("spreads the shelves over the rows in turn", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         let sum = 0;
         for (let r = 0; r < level.aisles; r++) sum += rowCount(level, r);
         expect(sum).toBe(shelvesOf(level));
         expect(rowCount(level, 0)).toBeGreaterThanOrEqual(rowCount(level, level.aisles - 1));
      }
   });
});

describe("toy store use, drop, stun and carry", () => {
   it("a right drop pays 80, +20 when no wrong drop happened since the previous right one", () => {
      const run = createRun(3, LEVELS[1]);
      const a = 0;
      pick(run, a);
      atShelf(run, shelfOf(run, run.toys[a].cat));
      step(run, use(), DT, 100_000);
      expect(run.ev.right).toBeGreaterThanOrEqual(0);
      expect(run.score).toBe(RIGHT_POINTS + CLEAN_POINTS);
      expect(run.placed).toBe(1);
      expect(run.toys[a].state).toBe(2);
   });

   it("a wrong drop pays 0, stuns 0.50 s, leaves the toy on the floor at the shelf and ends the clean bonus until the next right drop", () => {
      const run = createRun(3, LEVELS[1]);
      pick(run, 0);
      const wrong = shelfOf(run, run.toys[0].cat, true);
      atShelf(run, wrong);
      step(run, use(), DT, 100_000);
      expect(run.ev.wrong).toBe(true);
      expect(run.score).toBe(0);
      expect(run.hero.stun).toBe(STUN_S);
      expect(run.toys[0].state).toBe(0);
      expect(run.carried).toHaveLength(0);
      expect(distanceToShelf(run.shelves[wrong], run.toys[0].x, run.toys[0].z)).toBeLessThan(0.8);
      // stunned: no movement and no Use for 0.50 s, on keyboard and touch alike
      const x = run.hero.x;
      const input = { moveX: 1, moveY: 0, use: true, yaw: 0 };
      let t = 0;
      while (run.hero.stun > 0) {
         step(run, input, DT, 100_000);
         t += DT;
         expect(run.hero.x).toBe(x);
         expect(run.carried).toHaveLength(0);
      }
      expect(t).toBeGreaterThanOrEqual(STUN_S - 2 * DT);
      expect(t).toBeLessThan(STUN_S + 2 * DT);
      // the next right drop is 80 only, the one after is 100 again
      run.hero.vx = 0;
      pick(run, 0);
      atShelf(run, shelfOf(run, run.toys[0].cat));
      step(run, use(), DT, 100_000);
      expect(run.score).toBe(RIGHT_POINTS);
      const b = toyOf(run, run.toys[1].cat === run.toys[0].cat ? run.toys[1].cat : run.toys[1].cat);
      pick(run, b);
      atShelf(run, shelfOf(run, run.toys[b].cat));
      step(run, use(), DT, 100_000);
      expect(run.score).toBe(RIGHT_POINTS + RIGHT_POINTS + CLEAN_POINTS);
   });

   it("a toy pays once: a toy knocked off and shelved again earns one right drop", () => {
      const run = createRun(5, LEVELS[1]);
      pick(run, 0);
      atShelf(run, shelfOf(run, run.toys[0].cat));
      step(run, use(), DT, 100_000);
      const after = run.score;
      step(run, use(), DT, 100_000);
      expect(run.score).toBe(after);
      expect(run.placed).toBe(1);
   });

   it("carries one toy on levels 1-3 and two on levels 4-5, never more", () => {
      const one = calm(createRun(2, LEVELS[2]));
      pick(one, 0);
      const second = one.toys.findIndex((t, i) => i !== 0 && t.state === 0);
      // a free corner, out of every shelf's reach
      one.toys[second].x = one.start.x;
      one.toys[second].z = one.start.z;
      atToy(one, second);
      step(one, use(), DT, 100_000);
      expect(one.carried).toEqual([0]);
      expect(one.toys[second].state).toBe(0);

      const two = calm(createRun(2, LEVELS[4]));
      expect(two.level.carry).toBe(2);
      pick(two, 0);
      pick(two, 1);
      expect(two.carried).toEqual([0, 1]);
      two.toys[2].x = two.start.x;
      two.toys[2].z = two.start.z;
      atToy(two, 2);
      step(two, use(), DT, 100_000);
      expect(two.carried).toHaveLength(2);
      expect(two.toys[2].state).toBe(0);
   });

   it("walks at 0.9 of the top speed while carrying", () => {
      const run = createRun(2, LEVELS[1]);
      run.hero.x = 0;
      run.hero.z = 0;
      run.windups.length = 0;
      const input = { moveX: 1, moveY: 0, use: false, yaw: 0 };
      for (let i = 0; i < 90; i++) step(run, input, DT, 100_000);
      expect(Math.hypot(run.hero.vx, run.hero.vz)).toBeCloseTo(MAX_SPEED, 2);
      pick(run, 0);
      run.hero.x = 0;
      run.hero.z = 0;
      for (let i = 0; i < 90; i++) step(run, input, DT, 100_000);
      expect(Math.hypot(run.hero.vx, run.hero.vz)).toBeCloseTo(MAX_SPEED * CARRY_SPEED, 2);
   });

   it("two shelves take each kind from level 3: either is right", () => {
      const run = calm(createRun(4, LEVELS[3]));
      const cat = run.toys[0].cat;
      const shelves = run.shelves.map((s, i) => [s, i] as const).filter(([s]) => s.cat === cat);
      expect(shelves).toHaveLength(2);
      for (const [, index] of shelves) {
         const r = calm(createRun(4, LEVELS[3]));
         pick(r, 0);
         atShelf(r, index);
         step(r, use(), DT, 100_000);
         expect(r.ev.right).toBe(index);
      }
   });

   it("a wrong top toy blocks the one under it: Use drops only the top", () => {
      const run = calm(createRun(6, LEVELS[4]));
      const a = 0;
      const b = run.toys.findIndex((t, i) => i !== a && t.cat !== run.toys[a].cat);
      pick(run, a);
      pick(run, b);
      // a shelf of a's kind, not of b's: the top (b) is wrong there
      atShelf(run, shelfOf(run, run.toys[a].cat));
      step(run, use(), DT, 100_000);
      expect(run.ev.wrong).toBe(true);
      expect(run.carried).toEqual([a]);
      expect(run.toys[b].state).toBe(0);
      expect(run.placed).toBe(0);
   });

   it("with a toy and a shelf both in reach, a matching shelf takes the drop and a wrong shelf never steals the pick-up", () => {
      const run = calm(createRun(8, LEVELS[4]));
      pick(run, 0);
      // a floor toy 0.5 m from the hero and a wrong shelf within reach: pick
      const wrong = shelfOf(run, run.toys[0].cat, true);
      atShelf(run, wrong);
      run.toys[1].x = run.hero.x + 0.4;
      run.toys[1].z = run.hero.z;
      step(run, use(), DT, 100_000);
      expect(run.ev.pick).toBe(1);
      expect(run.ev.wrong).toBe(false);
      // a matching shelf within reach: drop (the top one is toy 1)
      const right = shelfOf(run, run.toys[1].cat);
      atShelf(run, right);
      run.toys[2].x = run.hero.x + 0.4;
      run.toys[2].z = run.hero.z;
      step(run, use(), DT, 100_000);
      expect(run.ev.right).toBe(right);
   });

   it("Use does nothing out of reach", () => {
      const run = createRun(8, LEVELS[1]);
      run.hero.x = run.start.x;
      run.hero.z = run.start.z;
      expect(Math.hypot(run.toys[0].x - run.hero.x, run.toys[0].z - run.hero.z)).toBeGreaterThan(REACH);
      step(run, use(), DT, 100_000);
      expect(run.carried).toHaveLength(0);
      expect(run.ev.wrong).toBe(false);
   });

   it("a wind-up hit drops every carried toy where the guard stands, pays 0, and has a 0.80 s mercy", () => {
      const run = createRun(9, LEVELS[4]);
      pick(run, 0);
      pick(run, 1);
      const w = run.windups[0];
      run.hero.x = w.x;
      run.hero.z = w.z;
      const score = run.score;
      step(run, idleInput(), DT, 100_000);
      expect(run.ev.hit).toBe(true);
      expect(run.carried).toHaveLength(0);
      expect(run.toys[0].state).toBe(0);
      expect(run.toys[1].state).toBe(0);
      expect(Math.hypot(run.toys[0].x - run.hero.x, run.toys[0].z - run.hero.z)).toBeLessThan(0.6);
      expect(run.score).toBe(score);
      expect(run.mercy).toBeGreaterThan(MERCY_S - 2 * DT);
      // picked up again inside the mercy: a second overlap costs nothing
      pick(run, 0);
      run.hero.x = w.x;
      run.hero.z = w.z;
      step(run, idleInput(), DT, 100_000);
      expect(run.ev.hit).toBe(false);
      expect(run.carried).toEqual([0]);
      void WINDUP_HIT;
   });

   it("wins when every toy is on a shelf and pays 4 per full second left", () => {
      const run = createRun(1, LEVELS[1]);
      run.toys.forEach((t, i) => {
         t.state = 2;
         t.shelf = shelfOf(run, t.cat);
         t.slot = i;
      });
      run.placed = run.toys.length - 1;
      const last = run.toys[run.toys.length - 1];
      last.state = 0;
      pick(run, run.toys.length - 1);
      atShelf(run, shelfOf(run, last.cat));
      const before = run.score;
      step(run, use(), DT, 90_500);
      expect(run.over).toBe("win");
      expect(run.score - before).toBe(RIGHT_POINTS + CLEAN_POINTS + timeBonus(90_500));
      expect(timeBonus(90_500)).toBe(TIME_BONUS_PER_SECOND * 90);
      expect(timeBonus(0)).toBe(0);
   });

   it("keyboard and touch share one step: the same input gives the same run", () => {
      const a = createRun(9, LEVELS[5]);
      const b = createRun(9, LEVELS[5]);
      const input = { moveX: 0.6, moveY: -0.4, use: false, yaw: 0 };
      for (let i = 0; i < 240; i++) {
         step(a, input, DT, 100_000);
         step(b, { ...input }, DT, 100_000);
      }
      expect(a.hero).toEqual(b.hero);
      expect(a.windups.map((w) => [w.x, w.z])).toEqual(b.windups.map((w) => [w.x, w.z]));
   });
});

describe("toy store score limits", () => {
   it("pays at most 100 per toy before the clock bonus", () => {
      for (const id of LEVEL_IDS) expect(objectiveCeiling(LEVELS[id])).toBe(100 * LEVELS[id].toys);
   });

   it("an honest bot, a human-paced bot, an idle bot and a spam bot stay inside each level's limits", () => {
      for (const id of LEVEL_IDS) {
         const limits = PROPOSED_LEVEL_LIMITS[id];
         let best = 0;
         let wins = 0;
         let runs = 0;
         for (let seed = 0; seed < 60; seed++) {
            const oracle = play(id, seed, seed % 3 === 0 ? 144 : seed % 3 === 1 ? 60 : 30, "oracle");
            runs += 1;
            expect(withinServerLimits(oracle.score, oracle.ms, limits)).toBe(true);
            expect(oracle.score).toBe(oracle.run.score);
            expect(capScore(oracle.score, oracle.ms, limits)).toBe(oracle.score);
            if (oracle.reason === "win") {
               wins += 1;
               best = Math.max(best, oracle.score);
            }
         }
         for (let seed = 0; seed < 30; seed++) {
            const human = play(id, seed, 30, "human");
            expect(withinServerLimits(human.score, human.ms, limits)).toBe(true);
            const spam = play(id, seed, 30, "spam");
            expect(spam.score).toBe(spam.run.score);
            expect(withinServerLimits(spam.score, spam.ms, limits)).toBe(true);
            expect(capScore(spam.score, spam.ms, limits)).toBe(spam.score);
         }
         for (let seed = 0; seed < 10; seed++) {
            const idle = play(id, seed, 20, "idle");
            expect(idle.score).toBe(0);
            expect(idle.reason).not.toBe("win");
            expect(withinServerLimits(idle.score, idle.ms, limits)).toBe(true);
         }
         console.log(`L${id} oracle wins ${wins}/${runs}, best ${best} (max ${limits.maxScore})`);
         expect(wins / runs).toBeGreaterThanOrEqual(0.98);
         expect(best).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
      }
   }, 900_000);
});
