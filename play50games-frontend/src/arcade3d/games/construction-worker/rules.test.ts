// Pins, dwell, energy, landing, stability and the store-backed ceiling. The oracle is slower than
// the 41.56 s bound (it waits for a quiet hook); the bound is the gates plus t(k) = 0.88 + 1.13 k.
import { describe, expect, it } from "vitest";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { constructionWorkerMeta } from "./meta";
import {
   ACCEL_CAP, ANGLE_LIM, BOB_SPEED, BUILDING_BONUS, CABLE, CLOCK_S, DAMPING,
   DROP_R, DROP_R_TOWER, DWELL_S, FLOOR, GRAVITY, HOOK_BLOCK, JIB_Y, MAX_OMEGA, MAX_VR, PICK_MAX_R,
   PICK_R, PIECE_H, PILE_A, PILE_R, PLAN, RADIUS_MAX, RADIUS_MIN, SLOT_A, SLOT_R, SWING_MAX,
   TIME_BONUS, clampSwing, createRun, dropRadius, pileUnder, pivotAccel, rateLanding, slotAt,
   stepRun, swingEnergy, swingMagnitude, swingSpeed, type CraneInput, type Run,
} from "./rules";

const RULES = constructionWorkerMeta.scoring;
const ZERO: CraneInput = { rot: 0, radial: 0, pick: -1, actionPick: false, drop: false };

function clamp(v: number, lo: number, hi: number): number {
   return v < lo ? lo : v > hi ? hi : v;
}

function at(run: Run, angle: number, radius: number): void {
   run.angle = angle;
   run.radius = radius;
   run.omega = 0;
   run.vr = 0;
   run.swing.x.x = 0;
   run.swing.x.v = 0;
   run.swing.z.x = 0;
   run.swing.z.v = 0;
   stepRun(run, ZERO, 1 / 120);
}

describe("construction-worker rules", () => {
   it("pins the gates, the pickup disc, the accel cap and the radius", () => {
      expect(PICK_MAX_R).toBe(7.8);
      expect(DROP_R).toBe(8.9);
      expect(DROP_R_TOWER).toBe(9.02);
      expect(PICK_R).toBe(0.45);
      expect(ACCEL_CAP).toBe(2);
      expect(RADIUS_MAX).toBe(9.6);
      expect(dropRadius(0)).toBe(8.9);
      expect(dropRadius(2)).toBe(9.02);
      expect(PLAN).toHaveLength(36);
      expect(PLAN[0]).toEqual({ kind: 0, slot: 0, floor: 0, building: 0 });
      expect(PLAN[8].building).toBe(1);
      expect(PLAN[20].building).toBe(2);
      expect(PLAN[35]).toMatchObject({ building: 2, floor: 3 });
      expect(CLOCK_S).toBe(240);
      expect(TIME_BONUS).toBe(5);
      expect(BUILDING_BONUS).toBe(500);
      expect(BOB_SPEED).toBe(0.4);
      expect(DWELL_S).toBe(0.25);
      expect(DAMPING).toBe(1.4);
      expect(RULES.maxScore).toBe(6100);
      expect(RULES.minDurationMs).toBe(9000);
      expect(RULES.maxDurationMs).toBe(242000);
      expect(RULES.base).toBe(0);
      expect(RULES.maxPointsPerSec).toBe(150);
   });

   it("keeps pile discs apart and slots fixed across seeds and frame sizes", () => {
      const a = { x: 0, z: 0 };
      const b = { x: 0, z: 0 };
      slotAt(0, a);
      for (let i = 0; i < PILE_A.length - 1; i++) {
         const chord = PILE_R * (PILE_A[i + 1] - PILE_A[i]);
         expect(chord).toBeGreaterThan(PICK_R * 2);
      }
      expect(PILE_R * 0.15).toBeCloseTo(1.05, 5);
      for (let seed = 1; seed <= 20; seed++) {
         for (const frames of [fixedFrames(1000 / 60), fixedFrames(50), randomFrames(seed, 0.004, 0.05)]) {
            const run = createRun(seed);
            const input = { ...ZERO, rot: 0.4, radial: 0.3 };
            for (let n = 0; n < 8; n++) stepRun(run, input, frames());
            slotAt(0, b);
            expect(b.x).toBeCloseTo(a.x, 8);
            expect(b.z).toBeCloseTo(a.z, 8);
            expect(run.windowStyle === 0 || run.windowStyle === 1).toBe(true);
            expect(run.angle).toBeLessThanOrEqual(ANGLE_LIM);
            expect(run.radius).toBeLessThanOrEqual(9.6);
         }
      }
   });

   it("restarts the dwell when radius, disc or bob speed fails, and ignores a wrong key that must not burn time", () => {
      const run = createRun(1);
      at(run, PILE_A[0], 7);
      expect(pileUnder(run)).toBe(0);
      stepRun(run, { ...ZERO, pick: 0 }, 0.05);
      expect(run.armed).toBe(0);
      for (let n = 0; n < 3; n++) stepRun(run, ZERO, 0.05);
      expect(run.dwell).toBeGreaterThan(0.15);
      expect(run.dwell).toBeLessThan(DWELL_S);
      expect(run.carried).toBe(-1);
      stepRun(run, ZERO, 0.05);
      expect(run.carried).toBe(0);

      const slow = createRun(2);
      at(slow, PILE_A[0], 7);
      stepRun(slow, { ...ZERO, pick: 0 }, 0.05);
      slow.radius = 7.9;
      stepRun(slow, ZERO, 0.05);
      expect(slow.dwell).toBe(0);
      expect(slow.carried).toBe(-1);
      at(slow, PILE_A[0], 7);
      stepRun(slow, ZERO, 0.2);
      expect(slow.carried).toBe(-1);
      stepRun(slow, ZERO, 0.05);
      expect(slow.carried).toBe(0);

      const fast = createRun(3);
      at(fast, PILE_A[0], 7);
      stepRun(fast, { ...ZERO, pick: 0 }, 0.05);
      fast.swing.x.v = BOB_SPEED / CABLE + 0.02;
      stepRun(fast, ZERO, 0.05);
      expect(fast.dwell).toBe(0);

      const off = createRun(4);
      at(off, 0, 4.5);
      const left = off.timeLeft;
      stepRun(off, { ...ZERO, pick: 0 }, 0.05);
      expect(off.armed).toBe(-1);
      expect(off.timeLeft).toBeCloseTo(left - 0.05, 5);

      const wrong = createRun(5);
      at(wrong, PILE_A[1], 7);
      const before = wrong.timeLeft;
      stepRun(wrong, { ...ZERO, pick: 1 }, 0.05);
      expect(wrong.carried).toBe(-1);
      expect(wrong.lock).toBeGreaterThan(0.9);
      expect(wrong.timeLeft).toBeLessThan(before - 0.9);
      const locked = wrong.timeLeft;
      stepRun(wrong, { ...ZERO, pick: 2 }, 0.05);
      expect(wrong.timeLeft).toBeCloseTo(locked - 0.05, 5);

      const carry = createRun(6);
      at(carry, PILE_A[1], 7);
      carry.carried = 0;
      const t0 = carry.timeLeft;
      stepRun(carry, { ...ZERO, pick: 1 }, 0.05);
      expect(carry.timeLeft).toBeCloseTo(t0 - 0.05, 5);
      expect(carry.carried).toBe(0);
   });

   it("measures the pickup speed relative to the trolley: a moving trolley with a still bob picks, a fast swing does not", () => {
      // The trolley sweeps the hook across pile 0 at 0.5 m/s: over the old absolute 0.15 and over 0.4.
      const omega = 0.5 / 7;
      const moving = createRun(1);
      at(moving, PILE_A[0] - 0.012, 7);
      moving.omega = omega;
      const cruise = { ...ZERO, rot: omega / MAX_OMEGA };
      stepRun(moving, { ...cruise, pick: 0 }, 1 / 60);
      expect(moving.armed).toBe(0);
      expect(Math.hypot(moving.bobVx, moving.bobVz)).toBeGreaterThan(0.45);
      for (let n = 0; n < 17 && moving.carried < 0; n++) {
         stepRun(moving, cruise, 1 / 60);
         expect(swingSpeed(moving)).toBeLessThan(0.05);
         expect(Math.hypot(moving.bobVx, moving.bobVz)).toBeGreaterThan(BOB_SPEED);
      }
      expect(moving.carried).toBe(0);

      const swing = (v: number) => {
         const run = createRun(2);
         at(run, PILE_A[0], 7);
         stepRun(run, { ...ZERO, pick: 0 }, 1 / 60);
         let longest = 0;
         for (let n = 0; n < 30 && run.carried < 0; n++) {
            run.swing.x.x = 0;
            run.swing.z.x = 0;
            run.swing.x.v = v / CABLE;
            run.swing.z.v = 0;
            stepRun(run, ZERO, 1 / 60);
            longest = Math.max(longest, run.dwell);
         }
         return { run, longest };
      };
      const fast = swing(0.42);
      expect(fast.run.carried).toBe(-1);
      expect(fast.longest).toBe(0);
      const slow = swing(0.37);
      expect(slow.run.carried).toBe(0);

      // The hook swung back over the pile from beyond the gate: only r <= 7.8 can fail here.
      const reach = (trolley: number) => {
         const run = createRun(3);
         at(run, PILE_A[0], trolley);
         const hold = () => {
            run.swing.x.x = 0;
            run.swing.x.v = 0;
            run.swing.z.x = Math.asin((PILE_R - trolley) / CABLE);
            run.swing.z.v = 0;
         };
         hold();
         stepRun(run, { ...ZERO, pick: 0 }, 1 / 60);
         for (let n = 0; n < 30 && run.carried < 0; n++) {
            hold();
            stepRun(run, ZERO, 1 / 60);
            expect(pileUnder(run)).toBe(0);
            expect(swingSpeed(run)).toBeLessThan(BOB_SPEED);
         }
         return run;
      };
      expect(reach(7.75).carried).toBe(0);
      const beyond = reach(7.9);
      expect(beyond.carried).toBe(-1);
      expect(beyond.dwell).toBe(0);
   });

   it("does not grow swing energy at zero pivot acceleration, and a full jib start stays under 0.35", () => {
      const run = createRun(1);
      run.swing.x.x = 0.2;
      const e0 = swingEnergy(run.swing);
      let peak = e0;
      for (let n = 0; n < 120; n++) {
         stepRun(run, ZERO, 1 / 60);
         peak = Math.max(peak, swingEnergy(run.swing));
      }
      expect(peak).toBeLessThanOrEqual(e0 * 1.0001);
      expect(swingEnergy(run.swing)).toBeLessThan(e0 * 0.5);

      const spun = createRun(1);
      spun.radius = 9.5;
      spun.omega = MAX_OMEGA;
      const raw = pivotAccel(0, 9.5, MAX_OMEGA, 1.8, 0, 0, { x: 0, z: 0, raw: 0 });
      expect(raw.raw).toBeGreaterThan(2);
      expect(Math.hypot(raw.x, raw.z)).toBeCloseTo(2, 5);
      const mild = pivotAccel(0, 5, 0, 0.5, 0, 0, { x: 0, z: 0, raw: 0 });
      expect(mild.raw).toBeGreaterThan(2);
      expect(mild.raw).toBeLessThan(3);
      expect(Math.hypot(mild.x, mild.z)).toBeCloseTo(ACCEL_CAP, 5);
      let maxA = 0;
      for (let n = 0; n < 180; n++) {
         stepRun(spun, { ...ZERO, rot: 1 }, 1 / 60);
         maxA = Math.max(maxA, swingMagnitude(spun.swing));
         expect(spun.cappedAccel).toBeLessThanOrEqual(2.001);
      }
      expect(maxA).toBeLessThan(SWING_MAX);

      const wide = createRun(1);
      wide.swing.x.x = 0.3;
      wide.swing.z.x = 0.3;
      wide.swing.x.v = 1;
      wide.swing.z.v = 1;
      clampSwing(wide.swing);
      expect(swingMagnitude(wide.swing)).toBeCloseTo(0.35, 5);
      expect(wide.swing.x.v).toBeLessThan(0.01);

      const over = createRun(1);
      over.swing.x.x = 0.3;
      over.swing.z.x = 0.3;
      stepRun(over, ZERO, 1 / 120);
      expect(swingMagnitude(over.swing)).toBeLessThanOrEqual(SWING_MAX + 1e-9);
   });

   it("rates the predicted landing, opens the tower drop at 9.02, and a miss retries the same step", () => {
      expect(rateLanding(0.14, false)).toBe(0);
      expect(rateLanding(0.14, true)).toBe(1);
      expect(rateLanding(0.5, false)).toBe(2);
      expect(rateLanding(1, false)).toBe(3);

      const hit = createRun(1);
      const step = PLAN[0];
      at(hit, SLOT_A[step.slot], 9.5);
      hit.carried = step.kind;
      stepRun(hit, { ...ZERO, drop: true }, 1 / 60);
      expect(hit.planIndex).toBe(1);
      expect(hit.score).toBe(100);
      expect(hit.carried).toBe(-1);

      const miss = createRun(1);
      at(miss, SLOT_A[0] + 0.25, 9.5);
      miss.carried = 0;
      const idx = miss.planIndex;
      stepRun(miss, { ...ZERO, drop: true }, 1 / 60);
      expect(miss.planIndex).toBe(idx);
      expect(miss.carried).toBe(-1);
      expect(miss.score).toBe(0);
      expect(miss.stability).toBe(88);

      const early = createRun(1);
      early.planIndex = 20;
      early.carried = PLAN[20].kind;
      early.radius = 9.01;
      early.angle = SLOT_A[PLAN[20].slot];
      stepRun(early, { ...ZERO, drop: true }, 1 / 60);
      expect(early.planIndex).toBe(20);
      expect(early.carried).toBe(PLAN[20].kind);
      early.radius = 9.02;
      at(early, SLOT_A[PLAN[20].slot], 9.02);
      early.carried = PLAN[20].kind;
      stepRun(early, { ...ZERO, drop: true }, 1 / 60);
      expect(early.planIndex).toBe(21);

      const flying = createRun(1);
      at(flying, SLOT_A[0], SLOT_R);
      flying.carried = 0;
      flying.swing.x.x = 0;
      flying.swing.x.v = 0.8;
      flying.omega = 0;
      flying.vr = 0;
      stepRun(flying, { ...ZERO, drop: true }, 1 / 120);
      expect(flying.planIndex).toBe(0);
      expect(flying.score).toBe(0);
      expect(flying.carried).toBe(-1);
   });

   it("leaves all-ok stability at 52, 28 and 4, and the 9th miss collapses", () => {
      const run = createRun(1);
      const place = (offset: number) => {
         const step = PLAN[run.planIndex];
         at(run, SLOT_A[step.slot], SLOT_R);
         run.swing.x.x = offset / CABLE;
         run.carried = step.kind;
         run.cheer = 0;
         stepRun(run, { ...ZERO, drop: true }, 1 / 120);
      };
      for (let n = 0; n < 8; n++) place(0.5);
      expect(run.stability).toBe(52);
      expect(run.score).toBe(8 * 30 + 500);
      const afterHouse = run.score;
      run.cheer = 0.01;
      stepRun(run, ZERO, 0.02);
      expect(run.stability).toBe(100);
      for (let n = 0; n < 12; n++) place(0.5);
      expect(run.stability).toBe(28);
      expect(run.score - afterHouse).toBe(12 * 30 + 500);
      run.cheer = 0.01;
      stepRun(run, ZERO, 0.02);
      for (let n = 0; n < 16; n++) place(0.4);
      expect(run.stability).toBe(4);
      expect(run.phase).toBe("win");
      expect(run.score).toBe(8 * 30 + 12 * 30 + 16 * 30 + 500 * 3 + TIME_BONUS * Math.floor(run.timeLeft));

      const fall = createRun(1);
      for (let n = 0; n < 9; n++) {
         at(fall, 0.4, 9.5);
         fall.carried = PLAN[0].kind;
         stepRun(fall, { ...ZERO, drop: true }, 1 / 120);
      }
      expect(fall.phase).toBe("lose");
      expect(fall.planIndex).toBe(0);
      expect(fall.score).toBe(0);

      const good = createRun(4);
      const goodStep = PLAN[0];
      at(good, SLOT_A[goodStep.slot], SLOT_R);
      good.swing.x.x = 0.25 / CABLE;
      good.carried = goodStep.kind;
      stepRun(good, { ...ZERO, drop: true }, 1 / 120);
      expect(good.dropRating).toBe(1);
      expect(good.stability).toBe(97);
      expect(good.score).toBe(60);

      const placed = createRun(5);
      placed.stability = 3;
      at(placed, SLOT_A[0], SLOT_R);
      placed.swing.x.x = 0.25 / CABLE;
      placed.carried = 0;
      placed.stability = 3;
      stepRun(placed, { ...ZERO, drop: true }, 1 / 120);
      expect(placed.phase).toBe("lose");
      expect(placed.score).toBe(60);

      const okFall = createRun(6);
      okFall.stability = 6;
      at(okFall, SLOT_A[0], SLOT_R);
      okFall.swing.x.x = 0.5 / CABLE;
      okFall.carried = 0;
      okFall.stability = 6;
      stepRun(okFall, { ...ZERO, drop: true }, 1 / 120);
      expect(okFall.phase).toBe("lose");
      expect(okFall.stability).toBeLessThanOrEqual(0);
      expect(okFall.planIndex).toBe(1);
   });

   it("matches the proof times and keeps a same-frame drop behind the clock", () => {
      expect(0.88 + 1.13 * 8).toBeCloseTo(9.92, 5);
      expect(0.88 + 1.13 * 36).toBeCloseTo(41.56, 5);
      expect(0.88 + 1.13 * 9).toBeCloseTo(11.05, 5);
      const winT = 0.88 + 1.13 * 36;
      const winScore = 3600 + 1500 + TIME_BONUS * Math.floor(CLOCK_S - winT);
      expect(winScore).toBe(6090);
      expect(winScore / winT).toBeLessThanOrEqual(RULES.maxPointsPerSec);
      for (let k = 1; k <= 35; k++) {
         const t = 0.88 + 1.13 * k;
         const buildings = (k >= 8 ? 1 : 0) + (k >= 20 ? 1 : 0);
         const score = 100 * k + BUILDING_BONUS * buildings;
         expect(score / t).toBeLessThanOrEqual(RULES.maxPointsPerSec);
         expect(score).toBeLessThanOrEqual(4500);
      }
      expect(35 * 100 + 2 * BUILDING_BONUS).toBe(4500);
      const run = createRun(1);
      at(run, SLOT_A[0], 9.5);
      run.carried = 0;
      run.timeLeft = 0.01;
      stepRun(run, { ...ZERO, drop: true }, 0.05);
      expect(run.phase).toBe("timeup");
      expect(run.score).toBe(0);
      expect(run.planIndex).toBe(0);
   });

   it("allows a pick during the cheer and ignores a drop", () => {
      const drop = createRun(1);
      at(drop, SLOT_A[0], SLOT_R);
      drop.carried = 0;
      drop.cheer = 0.6;
      drop.score = 0;
      stepRun(drop, { ...ZERO, drop: true }, 0.05);
      expect(drop.carried).toBe(0);
      expect(drop.planIndex).toBe(0);
      expect(drop.score).toBe(0);
      expect(drop.cheer).toBeGreaterThan(0.4);

      const pick = createRun(2);
      at(pick, PILE_A[0], PILE_R);
      pick.cheer = 1;
      stepRun(pick, { ...ZERO, pick: 0 }, 0.05);
      expect(pick.armed).toBe(0);
      stepRun(pick, ZERO, 0.25);
      expect(pick.carried).toBe(0);
      expect(pick.cheer).toBeGreaterThan(0);
   });

   it("pays 5 times floor(time left) only when the tower is finished", () => {
      const run = createRun(1);
      const step = PLAN[35];
      at(run, SLOT_A[step.slot], SLOT_R);
      run.planIndex = 35;
      run.carried = step.kind;
      run.score = 5000;
      run.timeLeft = 10.9;
      run.stability = 100;
      stepRun(run, { ...ZERO, drop: true }, 1 / 120);
      expect(run.phase).toBe("win");
      // floor(10.9) = 10. 5 * 10 = 50. ceil would pay 55 (5655); a bonus of 4 would pay 40 (5640).
      expect(run.score).toBe(5650);
   });

   it("the hook and the carried piece stay clear of the mast and the tower top", () => {
      const run = createRun(1);
      let low = Infinity;
      for (let i = 0; i <= 8; i++) {
         for (let j = 0; j <= 6; j++) {
            run.angle = -0.6 + (1.2 * i) / 8;
            run.radius = RADIUS_MIN + ((RADIUS_MAX - RADIUS_MIN) * j) / 6;
            run.swing.x.x = SWING_MAX;
            run.swing.z.x = 0;
            at(run, run.angle, run.radius);
            run.swing.x.x = SWING_MAX;
            stepRun(run, ZERO, 1 / 120);
            const fromMast = Math.hypot(run.hookX, run.hookZ);
            expect(fromMast).toBeGreaterThan(1);
            const bottom = run.hookY - PIECE_H;
            low = Math.min(low, bottom);
            expect(run.hookY).toBeGreaterThanOrEqual(JIB_Y - CABLE - 0.01);
         }
      }
      expect(low).toBeGreaterThanOrEqual(3.8);
      expect(4 * FLOOR).toBe(3);
      expect(JIB_Y - CABLE).toBe(4.5);
      expect(HOOK_BLOCK).toBe(1.2);
      expect((JIB_Y - CABLE) - PIECE_H - 3).toBeCloseTo(0.8, 5);
   });
});

const CMD: CraneInput = { rot: 0, radial: 0, pick: -1, actionPick: false, drop: false };

/** Rate-limit `next` toward `current` so a frame commands at most `accel` per second. */
function ease(current: number, next: number, accel: number, dt: number): number {
   const step = Math.max(0, accel) * dt;
   return current + clamp(next - current, -step, step);
}

/**
 * Store-backed bots, one physics for every pointer. The damped driver uses swing-damped
 * proportional speeds and drops when the predicted landing is inside 0.38 m. The stop-curve
 * driver brakes on a stop curve, drops inside 0.35 m, and while the tower gust is on it
 * accelerates against the wind. One reused command.
 */
// kp radius, kd radius, kp angle, kd angle, swing damp, drop metres, max vr, max ω, radial accel, angular gain.
const FINE_GAINS = [3.2, 3, 2.5, 1.8, 4, 0.38, 1.4, 0.4, 2, 4];

function landDist(run: Run, step: { slot: number; floor: number }): number {
   const fall = Math.max(0, run.hookY - PIECE_H - step.floor * FLOOR);
   const t = Math.sqrt((2 * fall) / GRAVITY);
   const sx = SLOT_R * Math.sin(SLOT_A[step.slot]);
   const sz = SLOT_R * Math.cos(SLOT_A[step.slot]);
   return Math.hypot(run.hookX + run.bobVx * t - sx, run.hookZ + run.bobVz * t - sz);
}

function driveFine(run: Run, dt: number): CraneInput {
   const g = FINE_GAINS;
   CMD.rot = 0; CMD.radial = 0; CMD.pick = -1; CMD.actionPick = false; CMD.drop = false;
   const step = PLAN[run.planIndex];
   if (!step || run.phase !== "play" || run.lock > 0 || !(dt > 0)) return CMD;
   const carrying = run.carried >= 0;
   const wantR = carrying ? Math.max(SLOT_R, dropRadius(step.building)) : PILE_R;
   const wantA = carrying ? SLOT_A[step.slot] : PILE_A[step.kind];
   const aErr = wantA - run.angle;
   const rErr = wantR - run.radius;
   const s = Math.sin(run.angle);
   const c = Math.cos(run.angle);
   const radius = Math.max(run.radius, RADIUS_MIN);
   const radSwing = run.swing.x.v * s + run.swing.z.v * c;
   const tanSwing = run.swing.x.v * c - run.swing.z.v * s;
   const vrWant = clamp(g[0] * rErr - g[1] * run.vr - g[4] * radSwing, -g[6], g[6]);
   const omWant = clamp(g[2] * aErr - g[3] * run.omega - g[4] * tanSwing / radius, -g[7], g[7]);
   const vrCmd = ease(run.vr, vrWant, g[8], dt);
   const omCmd = ease(run.omega, omWant, g[9] / radius, dt);
   CMD.radial = clamp(vrCmd, -MAX_VR, MAX_VR) / MAX_VR;
   CMD.rot = clamp(omCmd, -MAX_OMEGA, MAX_OMEGA) / MAX_OMEGA;
   if (!carrying && run.radius <= PICK_MAX_R && pileUnder(run) === step.kind && Math.hypot(run.bobVx, run.bobVz) < 0.4) CMD.actionPick = true;
   const gate = carrying && run.cheer <= 0 && run.radius >= dropRadius(step.building) && Math.abs(aErr) < 0.18;
   if (gate && (run.guide === 2 || landDist(run, step) < g[5])) CMD.drop = true;
   return CMD;
}

const STOP = { radAcc: 3.5, angK: 4, stop: 0.8, dropDist: 0.35 };

function driveStop(run: Run, dt: number): CraneInput {
   const p = STOP;
   CMD.rot = 0;
   CMD.radial = 0;
   CMD.pick = -1;
   CMD.actionPick = false;
   CMD.drop = false;
   const step = PLAN[run.planIndex];
   if (!step || run.phase !== "play" || run.lock > 0 || !(dt > 0)) return CMD;
   const carrying = run.carried >= 0;
   const wantR = carrying ? Math.max(SLOT_R, dropRadius(step.building)) : PILE_R;
   const wantA = carrying ? SLOT_A[step.slot] : PILE_A[step.kind];
   const aErr = wantA - run.angle;
   const rErr = wantR - run.radius;
   const radius = Math.max(run.radius, RADIUS_MIN);
   const angAcc = p.angK / radius;
   const cap = (dist: number, accel: number, max: number) => Math.min(max, Math.sqrt(Math.max(0, 2 * accel * Math.abs(dist))) * p.stop);
   const gust = step.building === 2 && run.towerTime >= 0 && run.towerTime % 7 < 1.05;
   let vrCmd: number;
   let omCmd: number;
   if (gust) {
      vrCmd = run.vr - 2.5 * Math.sin(run.angle) * dt;
      omCmd = run.omega - (2.5 * Math.cos(run.angle) * dt) / radius;
   } else {
      vrCmd = ease(run.vr, Math.sign(rErr) * cap(rErr, p.radAcc, 2.3), p.radAcc, dt);
      omCmd = ease(run.omega, Math.sign(aErr) * cap(aErr, angAcc, 0.75), angAcc, dt);
   }
   const atPile = !carrying && Math.abs(aErr) < 0.05 && Math.abs(rErr) < 0.16;
   if (atPile && Math.hypot(run.bobVx, run.bobVz) < BOB_SPEED && Math.abs(run.vr) < 0.06 && Math.abs(run.omega) < 0.02) {
      vrCmd = run.vr;
      omCmd = run.omega;
   }
   CMD.radial = clamp(vrCmd, -MAX_VR, MAX_VR) / MAX_VR;
   CMD.rot = clamp(omCmd, -MAX_OMEGA, MAX_OMEGA) / MAX_OMEGA;
   if (!carrying && run.radius <= PICK_MAX_R && pileUnder(run) === step.kind) CMD.actionPick = true;
   const gate = carrying && run.cheer <= 0 && run.radius >= dropRadius(step.building);
   const bob = Math.hypot(run.bobVx, run.bobVz);
   if (gate && (run.guide === 2 || (p.dropDist > 0 && Math.abs(aErr) < 0.2 && bob < 1.1 && landDist(run, step) < p.dropDist))) CMD.drop = true;
   return CMD;
}

function play(run: Run, input: CraneInput, dt: number, store: ReturnType<typeof createArcadeStore>): void {
   stepRun(run, input, dt);
   if (run.gained) {
      store.getState().addScore(run.gained);
      run.gained = 0;
   }
   if (run.phase === "win") store.getState().end("win");
   else if (run.phase === "lose") store.getState().end("lose");
   else if (run.phase === "timeup") store.getState().end("timeup");
}

function played(drive: (run: Run, dt: number) => CraneInput, frame: () => number, maxFrames: number) {
   const run = createRun(7);
   let houseMs = -1;
   let houseScore = -1;
   const end = simulateRun(createArcadeStore(), {
      durationMs: CLOCK_S * 1000,
      frame,
      maxFrames,
      step: (dt, _t, live) => {
         play(run, drive(run, dt), dt, live);
         if (houseMs < 0 && run.planIndex >= 8) {
            houseMs = live.getState().elapsedMs;
            houseScore = live.getState().score;
         }
      },
   });
   return { end, run, houseMs, houseScore };
}

describe("construction-worker score ceiling", () => {
   it("a damped driver and a stop-curve driver win, inside the proof", () => {
      const fine = played(driveFine, fixedFrames(1000 / 60), 20000);
      expect(fine.end.endReason, `damped placed ${fine.run.planIndex}`).toBe("win");
      expect(fine.end.elapsedMs).toBeGreaterThanOrEqual(41560);
      expect(fine.end.elapsedMs).toBeLessThan(CLOCK_S * 1000);
      expect(fine.end.score).toBe(4300);
      expect(fine.end.score).toBeLessThanOrEqual(6090);
      expect(fine.houseMs).toBeGreaterThanOrEqual(9900);
      expect(fine.houseScore).toBeLessThanOrEqual(1300);
      expect(withinServerLimits(fine.end.score, fine.end.elapsedMs, RULES)).toBe(true);
      expect(capScore(fine.end.score, fine.end.elapsedMs, RULES)).toBe(fine.end.score);

      const coarse = played(driveStop, fixedFrames(1000 / 60), 20000);
      expect(coarse.end.endReason, `stop-curve placed ${coarse.run.planIndex}`).toBe("win");
      expect(coarse.end.elapsedMs).toBeGreaterThanOrEqual(41560);
      expect(coarse.end.elapsedMs).toBeLessThan(CLOCK_S * 1000);
      expect(coarse.end.score).toBe(3355);
      expect(coarse.end.score).toBeLessThanOrEqual(6090);
      expect(withinServerLimits(coarse.end.score, coarse.end.elapsedMs, RULES)).toBe(true);
      expect(capScore(coarse.end.score, coarse.end.elapsedMs, RULES)).toBe(coarse.end.score);
   }, 60_000);

   it("stays inside the limits at 20 fps and with jitter, and an idle crane scores 0 at 240 s", () => {
      for (const frame of [fixedFrames(50), randomFrames(11, 0.004, 0.05)]) {
         const done = played(driveFine, frame, 16000);
         expect(done.end.score).toBeLessThanOrEqual(6090);
         if (done.end.endReason === "win") expect(done.end.elapsedMs).toBeGreaterThanOrEqual(41560);
         expect(withinServerLimits(done.end.score, done.end.elapsedMs, RULES)).toBe(true);
         expect(capScore(done.end.score, done.end.elapsedMs, RULES)).toBe(done.end.score);
      }
      const idleRun = createRun(3);
      const idle = simulateRun(createArcadeStore(), {
         durationMs: CLOCK_S * 1000,
         frame: fixedFrames(50),
         maxFrames: 6000,
         step: (dt, _t, live) => play(idleRun, ZERO, dt, live),
      });
      expect(idle.endReason).toBe("timeup");
      expect(idle.score).toBe(0);
      expect(idle.elapsedMs).toBe(CLOCK_S * 1000);
      expect(withinServerLimits(0, idle.elapsedMs, RULES)).toBe(true);
   }, 60_000);
});
