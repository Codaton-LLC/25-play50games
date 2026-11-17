import { describe, expect, it } from "vitest";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   BAG_CLOCK_S,
   DELIVER_POINTS,
   DESK_POINT,
   DOOR_X,
   HALF_W,
   LIVES,
   MAX_SPEED,
   PAD_POINT,
   PROPOSED_LEVEL_LIMITS,
   QUICK_POINTS,
   RADIUS,
   RIDE_S,
   START,
   STUN_S,
   TIME_BONUS_PER_SECOND,
   TROLLEY_GAP,
   TROLLEY_RADIUS,
   USE_RANGE,
   bagQueue,
   createRun,
   doorLabel,
   doorZ,
   earliestEndS,
   earliestWinS,
   idleInput,
   standable,
   step,
   stepTrolley,
   targetAt,
   timeBonus,
   winCeiling,
   type Run,
} from "./rules";

const press = (run: Run, timeLeftMs = 100_000) => {
   const input = idleInput();
   input.actionPressed = true;
   return step(run, input, 1 / 60, timeLeftMs);
};
const place = (run: Run, x: number, z: number) => {
   run.hero.x = x;
   run.hero.z = z;
   run.hero.vx = 0;
   run.hero.vz = 0;
};
const atDesk = (run: Run) => place(run, DESK_POINT.x, DESK_POINT.z + 0.5);
const atPad = (run: Run) => place(run, PAD_POINT.x - 0.25, PAD_POINT.z);
const atDoor = (run: Run, index: number) => place(run, DOOR_X - 1.05, doorZ(index));
const wait = (run: Run, s: number, hz = 60) => {
   const input = idleInput();
   for (let t = 0; t < s - 1e-9; t += 1 / hz) step(run, input, 1 / hz, 100_000);
};

describe("hotel layout and bag queue", () => {
   it("is the same run for the same seed, and every bag is a solvable room within the level", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         for (let seed = 0; seed < 200; seed++) {
            const a = createRun(seed, level);
            expect(a.bags).toEqual(createRun(seed, level).bags);
            expect(a.bags).toHaveLength(level.bags);
            let floor = 1;
            for (const bag of a.bags) {
               expect(bag.floor).toBeGreaterThanOrEqual(1);
               expect(bag.floor).toBeLessThanOrEqual(level.floors);
               expect(bag.index).toBeGreaterThanOrEqual(1);
               expect(bag.index).toBeLessThanOrEqual(level.doors);
               // L1: every bag on floor 1. From L2 every bag is for another floor than the last: one ride each
               if (level.floors === 1) expect(bag.floor).toBe(1);
               else expect(bag.floor).not.toBe(floor);
               floor = bag.floor;
            }
            // the shuffle bag: every run of `doors` bags from the start uses each door once
            for (let r = 0; r * level.doors < level.bags; r++) {
               const round = a.bags.slice(r * level.doors, (r + 1) * level.doors).map((b) => b.index);
               expect(new Set(round).size).toBe(round.length);
            }
            for (let k = 1; k < a.bags.length; k++) expect(a.bags[k]).not.toEqual(a.bags[k - 1]);
         }
      }
      expect(bagQueue(7, LEVELS[5])).not.toEqual(bagQueue(8, LEVELS[5]));
   });

   it("flood fill: the desk, the pad and every door's Use zone are reachable from the start (200 seeds)", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < 200; seed += id === 1 ? 1 : 40) {
            const run = createRun(seed, LEVELS[id]);
            const cell = 0.1;
            const cols = Math.round((HALF_W * 2) / cell) + 1;
            const rows = Math.round(run.length / cell) + 1;
            const seen = new Uint8Array(cols * rows);
            const wx = (c: number) => -HALF_W + c * cell;
            const wz = (r: number) => r * cell;
            const queue: number[] = [];
            const push = (c: number, r: number) => {
               if (c < 0 || r < 0 || c >= cols || r >= rows) return;
               const k = r * cols + c;
               if (seen[k] || !standable(run, wx(c), wz(r), RADIUS)) return;
               seen[k] = 1;
               queue.push(k);
            };
            push(Math.round((START.x + HALF_W) / cell), Math.round(START.z / cell));
            expect(queue.length).toBe(1);
            while (queue.length) {
               const k = queue.pop()!;
               const c = k % cols;
               const r = (k - c) / cols;
               push(c + 1, r); push(c - 1, r); push(c, r + 1); push(c, r - 1);
            }
            const reached = (px: number, pz: number) => {
               for (let k = 0; k < seen.length; k++) if (seen[k] && Math.hypot(wx(k % cols) - px, wz(Math.floor(k / cols)) - pz) <= USE_RANGE - 0.1) return true;
               return false;
            };
            expect(reached(DESK_POINT.x, DESK_POINT.z)).toBe(true);
            expect(reached(PAD_POINT.x, PAD_POINT.z)).toBe(true);
            for (let i = 0; i < run.level.doors; i++) expect(reached(DOOR_X, doorZ(i))).toBe(true);
         }
      }
   });

   it("the Use zones never overlap: desk, pad and doors are each reached alone", () => {
      const run = createRun(1, LEVELS[5]);
      const points = [[DESK_POINT.x, DESK_POINT.z], [PAD_POINT.x, PAD_POINT.z], ...Array.from({ length: 6 }, (_, i) => [DOOR_X, doorZ(i)])];
      for (let a = 0; a < points.length; a++) for (let b = a + 1; b < points.length; b++) {
         expect(Math.hypot(points[a][0] - points[b][0], points[a][1] - points[b][1])).toBeGreaterThan(2 * USE_RANGE);
      }
      expect(targetAt(run, DESK_POINT.x, DESK_POINT.z + 1)).toEqual({ kind: "desk" });
      expect(targetAt(run, PAD_POINT.x, PAD_POINT.z)).toEqual({ kind: "pad" });
      expect(targetAt(run, DOOR_X - 1, doorZ(3))).toEqual({ kind: "door", index: 3 });
      expect(targetAt(run, 0, (doorZ(1) + doorZ(2)) / 2)).toBeNull();
   });

   it("door labels are floor * 100 + index", () => {
      expect(doorLabel(1, 1)).toBe(101);
      expect(doorLabel(3, 4)).toBe(304);
      expect(doorLabel(4, 6)).toBe(406);
   });
});

describe("hotel desk, elevator and doors", () => {
   it("L1: Use on the dark elevator pad does nothing (no ride, no floor change, no buzz)", () => {
      const run = createRun(3, LEVELS[1]);
      atDesk(run);
      expect(press(run).took).toBe(true);
      atPad(run);
      const ev = press(run);
      expect(ev.rideStart).toBe(false);
      expect(ev.buzz).toBe(false);
      expect(run.hero.ride).toBe(0);
      wait(run, 1.5);
      expect(run.floor).toBe(1);
   });

   it("a bag for floor 2 cannot score while the doors wear floor 1: it is a wrong door", () => {
      const run = createRun(0, LEVELS[2]);
      run.bags[0] = { floor: 2, index: 3 };
      atDesk(run);
      press(run);
      atDoor(run, 2);
      const ev = press(run);
      expect(ev.delivered).toBe(-1);
      expect(ev.wrong).toBe(2);
      expect(ev.score).toBe(0);
      expect(run.carrying).toBe(true);
      expect(run.lives).toBe(LIVES - 1);
   });

   it("the ride locks movement for exactly 1.00 s of play time, then the doors wear the bag's floor", () => {
      for (const hz of [30, 60, 144, 7]) {
         const run = createRun(5, LEVELS[3]);
         const target = run.bags[0].floor;
         atDesk(run);
         press(run);
         atPad(run);
         const start = { x: run.hero.x, z: run.hero.z };
         expect(press(run).rideStart).toBe(true);
         const input = idleInput();
         input.moveX = 1;
         input.moveY = 1;
         input.actionPressed = true;
         let t = 0;
         let arrivedAt = -1;
         while (t < RIDE_S + 0.5) {
            // the press frame itself counted 1/60 s of no ride; the ride starts at the next frame
            const ev = step(run, input, 1 / hz, 100_000);
            t += 1 / hz;
            if (arrivedAt < 0) {
               expect(run.hero.x).toBe(start.x);
               expect(run.hero.z).toBe(start.z);
               if (!ev.arrived) expect(run.floor).toBe(1);
            }
            if (ev.arrived) arrivedAt = t;
         }
         expect(arrivedAt).toBeGreaterThanOrEqual(RIDE_S - 1e-6);
         expect(arrivedAt).toBeLessThan(RIDE_S + 1 / hz + 1e-6);
         expect(run.floor).toBe(target);
      }
   });

   it("Use on the pad without a bag, or with a bag for this floor, only buzzes", () => {
      const run = createRun(2, LEVELS[2]);
      atPad(run);
      expect(press(run).buzz).toBe(true);
      expect(run.hero.ride).toBe(0);
      run.bags[0] = { floor: 1, index: 1 };
      atDesk(run);
      press(run);
      atPad(run);
      const ev = press(run);
      expect(ev.buzz).toBe(true);
      expect(ev.rideStart).toBe(false);
   });

   it("a wrong door keeps the bag, costs a life and stuns for 0.40 s; three wrong doors lose", () => {
      const run = createRun(1, LEVELS[1]);
      const bag = run.bags[0];
      const wrong = bag.index === 1 ? 1 : 0;
      atDesk(run);
      press(run);
      for (let k = 1; k <= LIVES; k++) {
         atDoor(run, wrong);
         const ev = press(run);
         expect(ev.wrong).toBe(wrong);
         expect(ev.lifeLost).toBe(true);
         expect(run.carrying).toBe(true);
         expect(run.score).toBe(0);
         expect(run.lives).toBe(LIVES - k);
         if (k < LIVES) {
            expect(run.hero.stun).toBe(STUN_S);
            const input = idleInput();
            input.moveX = 1;
            let held = 0;
            while (run.hero.stun > 0) {
               const x = run.hero.x;
               step(run, input, 1 / 60, 100_000);
               held += 1 / 60;
               if (run.hero.stun > 0) expect(run.hero.x).toBe(x);
            }
            expect(held).toBeCloseTo(STUN_S, 1);
         } else {
            expect(ev.lost).toBe(true);
            expect(run.over).toBe("lose");
         }
      }
   });

   it("Use at a door without a bag, or at the desk with one, buzzes and costs nothing", () => {
      const run = createRun(4, LEVELS[1]);
      atDoor(run, 0);
      const a = press(run);
      expect(a.buzz).toBe(true);
      expect(a.lifeLost).toBe(false);
      atDesk(run);
      press(run);
      const b = press(run);
      expect(b.buzz).toBe(true);
      expect(run.lives).toBe(LIVES);
   });

   it("pays +80 a bag, +40 while its 30 s clock is above half, and 5 per full second left on the win", () => {
      const run = createRun(6, LEVELS[1]);
      for (let k = 0; k < run.level.bags; k++) {
         const bag = run.bags[k];
         atDesk(run);
         expect(press(run).took).toBe(true);
         expect(run.bagClock).toBe(BAG_CLOCK_S);
         if (k === 1) wait(run, BAG_CLOCK_S / 2 + 0.05);
         atDoor(run, bag.index - 1);
         const ev = press(run, 61_500);
         expect(ev.delivered).toBe(bag.index - 1);
         const pay = DELIVER_POINTS + (k === 1 ? 0 : QUICK_POINTS);
         if (k < run.level.bags - 1) expect(ev.score).toBe(pay);
         else {
            expect(ev.won).toBe(true);
            expect(ev.score).toBe(pay + TIME_BONUS_PER_SECOND * 61);
         }
      }
      expect(run.score).toBe(3 * DELIVER_POINTS + 2 * QUICK_POINTS + 5 * 61);
      expect(timeBonus(999)).toBe(0);
      expect(timeBonus(-5)).toBe(0);
   });

   it("each bag pays once: Use again at the same door after a delivery buzzes", () => {
      const run = createRun(9, LEVELS[2]);
      run.bags[0] = { floor: 2, index: 1 };
      atDesk(run);
      press(run);
      atPad(run);
      press(run);
      wait(run, RIDE_S + 0.05);
      atDoor(run, 0);
      expect(press(run).delivered).toBe(0);
      const again = press(run);
      expect(again.score).toBe(0);
      expect(again.buzz).toBe(true);
      expect(run.delivered).toBe(1);
   });
});

describe("hotel movement and trolley", () => {
   it("never moves faster than 4.0 m/s (3.4 loaded after the first frames), and stays in the corridor", () => {
      for (const id of [1, 5] as const) {
         const run = createRun(11, LEVELS[id]);
         for (let i = 0; i < 20000; i++) {
            const input = idleInput();
            input.moveX = Math.sin(i * 0.037);
            input.moveY = Math.cos(i * 0.021);
            input.actionPressed = i % 97 === 0;
            const dt = 0.004 + ((i * 7919) % 46) / 1000;
            const x = run.hero.x;
            const z = run.hero.z;
            step(run, input, dt, 100_000);
            if (run.over) break;
            expect(Math.hypot(run.hero.x - x, run.hero.z - z)).toBeLessThanOrEqual(MAX_SPEED * dt + 1e-9);
            expect(standable(run, run.hero.x, run.hero.z, RADIUS - 1e-6)).toBe(true);
         }
      }
   });

   it("the trolley trails the bellboy, stays inside the corridor and never pushes him", () => {
      const a = createRun(13, LEVELS[5]);
      const b = createRun(13, LEVELS[5]);
      let far = 0;
      for (let i = 0; i < 3000; i++) {
         const input = idleInput();
         input.moveX = Math.sin(i * 0.01) > 0 ? 1 : -0.4;
         input.moveY = Math.cos(i * 0.004);
         step(a, input, 1 / 60, 100_000);
         // b: the same steps, with its trolley pulled into the door wall each frame first
         b.trolley.x.x = HALF_W + 3;
         step(b, input, 1 / 60, 100_000);
         expect(b.hero.x).toBe(a.hero.x);
         expect(b.hero.z).toBe(a.hero.z);
         expect(Math.abs(a.trolley.x.x)).toBeLessThanOrEqual(HALF_W - TROLLEY_RADIUS + 1e-9);
         expect(Math.abs(b.trolley.x.x)).toBeLessThanOrEqual(HALF_W - TROLLEY_RADIUS + 1e-9);
         far = Math.max(far, Math.hypot(a.trolley.x.x - a.hero.x, a.trolley.z.x - a.hero.z));
      }
      expect(far).toBeLessThan(3);
      // standing still, it settles at its gap (the hitch plus the bar) straight behind him
      const c = createRun(1, LEVELS[1]);
      c.hero.yaw = 0;
      for (let i = 0; i < 120; i++) stepTrolley(c, 1 / 60);
      expect(Math.hypot(c.trolley.x.x - c.hero.x, c.trolley.z.x - c.hero.z)).toBeCloseTo(TROLLEY_GAP, 2);
   });
});

// ---------- the per-level limit proof (the bots: bots.test.ts, levels.test.ts) ----------

describe("hotel score-limit proof per level (README)", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: limits derive from the earliest win; every win and every partial run fits base + pps t`, () => {
         const level = LEVELS[id];
         const limits = PROPOSED_LEVEL_LIMITS[id];
         const t0 = earliestWinS(level);
         const clock = level.durationMs / 1000;
         const bonus = TIME_BONUS_PER_SECOND * Math.floor(clock - t0);
         expect(limits.base).toBe((DELIVER_POINTS + QUICK_POINTS) * level.bags);
         expect(limits.maxScore).toBe(limits.base! + bonus);
         expect(limits.maxPointsPerSec).toBe(Math.ceil(bonus / t0));
         // the shortest run of any kind (three wrong doors: 2.08 s) still fits the window
         expect(limits.minDurationMs).toBe(2000);
         expect(limits.minDurationMs).toBeLessThanOrEqual(earliestEndS(level) * 1000);
         expect(earliestEndS(level)).toBeGreaterThan(2.05);
         expect(limits.maxDurationMs).toBe(level.durationMs + 2000);
         for (let t = t0; t <= clock + 1e-9; t += 0.01) {
            const score = winCeiling(level, t);
            expect(score).toBeLessThanOrEqual(limits.maxScore);
            expect(withinServerLimits(score, Math.max(t * 1000, limits.minDurationMs), limits)).toBe(true);
         }
         // before a win (and at time-up) the score is at most every bag but the last, quick
         expect(withinServerLimits((DELIVER_POINTS + QUICK_POINTS) * (level.bags - 1), limits.minDurationMs, limits)).toBe(true);
      });
   }
});
