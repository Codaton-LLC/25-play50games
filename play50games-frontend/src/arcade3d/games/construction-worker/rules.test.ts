// Pins, dwell, energy, landing, stability and the store-backed ceiling. The oracle is slower than
// the 41.56 s bound (it waits for a quiet hook); the bound is the gates plus t(k) = 0.88 + 1.13 k.
import { describe, expect, it } from "vitest";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { constructionWorkerMeta } from "./meta";
import {
   ACCEL_CAP, ANGLE_LIM, BOB_SPEED, CABLE, CLOCK_S, DROP_R, DROP_R_TOWER, DWELL_S, FLOOR,
   HOOK_BLOCK, JIB_Y, MAX_OMEGA, PICK_MAX_R, PICK_R, PIECE_H,
   PILE_A, PILE_R, PLAN, RADIUS_MAX, RADIUS_MIN, SLOT_A, SLOT_R, SWING_MAX,
   clampSwing, createRun, dropRadius, pileUnder, pivotAccel, rateLanding, slotAt, stepRun,
   swingEnergy, swingMagnitude, type CraneInput, type Run,
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
      run.cheer = 0.01;
      stepRun(run, ZERO, 0.02);
      expect(run.stability).toBe(100);
      for (let n = 0; n < 12; n++) place(0.5);
      expect(run.stability).toBe(28);
      run.cheer = 0.01;
      stepRun(run, ZERO, 0.02);
      for (let n = 0; n < 16; n++) place(0.4);
      expect(run.stability).toBe(4);
      expect(run.phase).toBe("win");

      const fall = createRun(1);
      for (let n = 0; n < 9; n++) {
         at(fall, 0.4, 9.5);
         fall.carried = PLAN[0].kind;
         stepRun(fall, { ...ZERO, drop: true }, 1 / 120);
      }
      expect(fall.phase).toBe("lose");
      expect(fall.planIndex).toBe(0);
      expect(fall.score).toBe(0);
   });

   it("matches the proof times and keeps a same-frame drop behind the clock", () => {
      expect(0.88 + 1.13 * 8).toBeCloseTo(9.92, 5);
      expect(0.88 + 1.13 * 36).toBeCloseTo(41.56, 5);
      expect(0.88 + 1.13 * 9).toBeCloseTo(11.05, 5);
      expect(3600 + 1500 + 5 * Math.floor(150 - 41.56)).toBe(5640);
      const run = createRun(1);
      at(run, SLOT_A[0], 9.5);
      run.carried = 0;
      run.timeLeft = 0.01;
      stepRun(run, { ...ZERO, drop: true }, 0.05);
      expect(run.phase).toBe("timeup");
      expect(run.score).toBe(0);
      expect(run.planIndex).toBe(0);
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

function cruise(err: number, accel: number, max: number): number {
   if (Math.abs(err) < 1e-4) return 0;
   const v = Math.min(max, Math.sqrt(Math.abs(2 * accel * err)));
   return (Math.sign(err) * v) / max;
}

let settle = false;

function oracle(run: Run): CraneInput {
   const input: CraneInput = { rot: 0, radial: 0, pick: -1, actionPick: false, drop: false };
   const step = PLAN[run.planIndex];
   if (!step || run.phase !== "play" || run.lock > 0) return input;
   const going = run.carried < 0;
   const wantR = going ? PILE_R : Math.max(SLOT_R, dropRadius(step.building));
   const wantA = going ? PILE_A[step.kind] : SLOT_A[step.slot];
   const aErr = wantA - run.angle;
   const rErr = wantR - run.radius;
   if (going && Math.abs(aErr) < 0.035 && Math.abs(rErr) < 0.1) settle = true;
   if (!going || Math.abs(aErr) > 0.12 || Math.abs(rErr) > 0.35) settle = false;
   if (settle && going) {
      input.rot = 0;
      input.radial = 0;
   } else {
      input.rot = Math.abs(aErr) < 0.012 ? 0 : cruise(aErr, 1.8, 0.9);
      input.radial = Math.abs(rErr) < 0.05 ? 0 : cruise(rErr, 5, 2.5);
   }
   if (going && pileUnder(run) === step.kind) input.actionPick = true;
   if (!going && run.cheer <= 0 && run.radius >= dropRadius(step.building) && run.guide === 2) {
      input.drop = true;
      input.rot = 0;
      input.radial = 0;
   }
   return input;
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

describe("construction-worker score ceiling", () => {
   it("a perfect-seeking oracle stays inside the proof, and an idle crane scores 0 at 150 s", () => {
      let houseMs = -1;
      let houseScore = -1;
      const run = createRun(7);
      const store = createArcadeStore();
      const end = simulateRun(store, {
         frame: fixedFrames(1000 / 60),
         maxFrames: 20000,
         step: (dt, _t, live) => {
            play(run, oracle(run), dt, live);
            if (houseMs < 0 && run.planIndex >= 8) {
               houseMs = live.getState().elapsedMs;
               houseScore = live.getState().score;
            }
         },
      });
      expect(end.elapsedMs).toBeGreaterThanOrEqual(41500);
      expect(end.score).toBeLessThanOrEqual(5640);
      expect(end.score).toBeGreaterThan(1000);
      expect(houseMs).toBeGreaterThanOrEqual(9900);
      expect(houseScore).toBeLessThanOrEqual(1300);
      expect(withinServerLimits(end.score, end.elapsedMs, RULES)).toBe(true);
      expect(capScore(end.score, end.elapsedMs, RULES)).toBe(end.score);

      for (const frame of [fixedFrames(50), randomFrames(11, 0.004, 0.05)]) {
         settle = false;
         const again = createRun(7);
         const other = createArcadeStore();
         const done = simulateRun(other, {
            frame,
            maxFrames: 12000,
            step: (dt, _t, live) => play(again, oracle(again), dt, live),
         });
         expect(done.elapsedMs).toBeGreaterThanOrEqual(41500);
         expect(done.score).toBeLessThanOrEqual(5640);
         expect(withinServerLimits(done.score, done.elapsedMs, RULES)).toBe(true);
         expect(capScore(done.score, done.elapsedMs, RULES)).toBe(done.score);
      }

      const idleRun = createRun(3);
      const idle = createArcadeStore();
      const timed = simulateRun(idle, {
         frame: fixedFrames(50),
         maxFrames: 8000,
         step: (dt, _t, live) => play(idleRun, ZERO, dt, live),
      });
      expect(timed.endReason).toBe("timeup");
      expect(timed.score).toBe(0);
      expect(timed.elapsedMs).toBeGreaterThanOrEqual(CLOCK_S * 1000 - 100);
      expect(timed.elapsedMs).toBeLessThanOrEqual(152000);
      expect(withinServerLimits(0, timed.elapsedMs, RULES)).toBe(true);
   }, 40_000);
});
