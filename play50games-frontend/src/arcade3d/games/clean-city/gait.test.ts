// The cleaner's walk cycle (gait.ts), pure, on the cleaner's landmarks: the stride is the walk's own
// at a walk and the measured contact stride at a run (RUN_STRIDE, recomputed here from core walkPose,
// footPoint and bodyLift), neither clamp of gaitPhaseStep ever bites at a speed the rules allow, the
// amount follows the speed, and the planted ankle stays put through a stance at every speed (the
// runner's old cap-4 gait slid). cleaner.test.ts checks the same on the real mesh's soles.
import { describe, expect, it } from "vitest";
import { bodyLift, createPose, footPoint, walkPose, walkStride, type HumanoidLandmarks } from "@/arcade3d/core/rig";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { CLEANER_LANDMARKS } from "./assets";
import {
   AMOUNT_EASE_DOWN,
   CLEANER_MAX_CADENCE,
   CLEANER_MIN_STRIDE,
   CLEANER_SCALE,
   RUN_STRIDE,
   cleanerPhaseStep,
   createCleanerGait,
   runStrideFactor,
   stepCleanerGait,
   type CleanerGait,
} from "./gait";
import { RUNNER } from "./rules";

const TAU = Math.PI * 2;
const DT = 1 / 60;
/** The stance probes step 10 times a frame: a run touches the floor for about 1.3 frames at 60 fps. */
const PROBE_DT = 1 / 600;
/** A sole on the floor (GLB units, 0.25 mm drawn): bodyLift puts the lower sole at 0. */
const ON_FLOOR = 0.0005;
const L = CLEANER_LANDMARKS;
/** the stride (m) a phase step stands for */
const strideOf = (step: number, v: number, dt = DT) => (v * dt * TAU) / step;

/**
 * The stride (GLB units) that keeps walkPose's left foot still while it touches the floor at
 * `amount`: inside the stance half walkStride assumes (phase π/2..3π/2), the longest run of phases
 * with the sole within 2 mm of the floor (body lifted by bodyLift), its ankle's sweep over it.
 */
function contactStride(amount: number, l: HumanoidLandmarks): { stride: number; share: number } {
   const n = 1800;
   const p = createPose();
   const f = new Float64Array(4);
   const sole: number[] = [];
   const z: number[] = [];
   for (let i = 0; i <= n; i++) {
      walkPose(Math.PI / 2 + (i / n) * Math.PI, amount, p);
      footPoint(p, l, 1, f);
      sole.push(f[3] + bodyLift(p, l));
      z.push(f[2]);
   }
   let best = { from: 0, len: 0 };
   for (let s = 0; s <= n; s++) {
      if (sole[s] >= 0.002 || (s > 0 && sole[s - 1] < 0.002)) continue;
      let len = 0;
      while (s + len <= n && sole[s + len] < 0.002) len++;
      if (len > best.len) best = { from: s, len };
   }
   const dphi = ((best.len - 1) / n) * Math.PI;
   return { stride: (TAU * (z[best.from] - z[best.from + best.len - 1])) / dphi, share: dphi / TAU };
}

describe("clean-city cleanerPhaseStep (gait.ts)", () => {
   it("standing still (or for no time) the phase does not advance", () => {
      expect(cleanerPhaseStep(0, 0, DT)).toBe(0);
      expect(cleanerPhaseStep(0.4, 0, DT)).toBe(0);
      expect(cleanerPhaseStep(0.4, 2, 0)).toBe(0);
   });

   it("at a walk (amount up to 0.53, 2.65 u/s) the stride is the walk's own x the cleaner's scale: the foot is planted for the whole stance half", () => {
      for (const a of [0.05, 0.12, 0.2, 0.3, 0.4, 0.5, 0.53]) {
         expect(runStrideFactor(a)).toBe(1);
         const v = a * RUNNER.speed;
         expect(strideOf(cleanerPhaseStep(a, v, DT), v), `amount ${a}`).toBeCloseTo(walkStride(a, L) * CLEANER_SCALE, 9);
         const contact = contactStride(a, L);
         expect(contact.share, `amount ${a}`).toBeCloseTo(0.5, 2);
         expect(contact.stride / walkStride(a, L), `amount ${a}`).toBeCloseTo(1, 2);
      }
   });

   it("at a run RUN_STRIDE is the measured contact stride over walkStride (within 1 %), and its interpolation within 2 % in between", () => {
      for (const [a, factor] of RUN_STRIDE) {
         if (a < 0.54) continue;
         const measured = contactStride(a, L).stride / walkStride(a, L);
         expect(Math.abs(measured / factor - 1), `amount ${a}: measured x${measured.toFixed(3)}`).toBeLessThan(0.01);
         expect(runStrideFactor(a)).toBeCloseTo(factor, 9);
      }
      for (let a = 0.555; a < 1; a += 0.025) {
         const measured = contactStride(a, L).stride / walkStride(a, L);
         expect(Math.abs(runStrideFactor(a) / measured - 1), `amount ${a.toFixed(3)}: measured x${measured.toFixed(3)}`).toBeLessThan(0.02);
      }
      // the run touches the floor for a fraction of the cycle: 37 % at 0.55, 9 % at full speed
      expect(contactStride(0.55, L).share).toBeLessThan(0.4);
      expect(contactStride(1, L).share).toBeLessThan(0.1);
      expect(runStrideFactor(1)).toBeGreaterThan(1.4);
      expect(runStrideFactor(2)).toBe(RUN_STRIDE[RUN_STRIDE.length - 1][1]);
   });

   it("neither clamp bites at a speed the rules allow (0.05 to 5 u/s, the amount at or above speed / 5): the cadence stays under 5.05 strides a second", () => {
      let peak = 0;
      for (let v = 0.05; v <= RUNNER.speed + 1e-9; v += 0.05) {
         for (const extra of [0, 0.1, 0.3, 1]) {
            const a = Math.min(1, v / RUNNER.speed + extra);
            const own = walkStride(a, L) * CLEANER_SCALE * runStrideFactor(a);
            expect(own).toBeGreaterThan(CLEANER_MIN_STRIDE);
            const step = cleanerPhaseStep(a, v, DT);
            expect(strideOf(step, v), `v ${v.toFixed(2)} amount ${a.toFixed(2)}`).toBeCloseTo(own, 9);
            peak = Math.max(peak, step / TAU / DT);
         }
      }
      // the most at the end of the walk (amount 0.53-0.54, 2.7 u/s); the walk itself about 4.8-4.9
      expect(peak).toBeLessThan(5.05);
      expect(CLEANER_MAX_CADENCE).toBeGreaterThan(peak);
      // at top speed: 4.24 strides a second (a 1.18 stride)
      expect(cleanerPhaseStep(1, RUNNER.speed, DT) / TAU / DT).toBeCloseTo(4.24, 2);
   });
});

describe("clean-city stepCleanerGait (gait.ts)", () => {
   it("the amount follows the speed up at once and eases down; the phase stays wrapped", () => {
      const gait = createCleanerGait();
      stepCleanerGait(gait, 0.4, DT);
      expect(gait.amount).toBeCloseTo(0.08, 12);
      stepCleanerGait(gait, 5, DT);
      expect(gait.amount).toBe(1);
      stepCleanerGait(gait, 9, DT);
      expect(gait.amount).toBe(1);
      stepCleanerGait(gait, 0, DT);
      expect(gait.amount).toBeCloseTo(Math.exp(-AMOUNT_EASE_DOWN * DT), 12);
      const before = gait.phase;
      stepCleanerGait(gait, 0, DT);
      expect(gait.phase).toBe(before);
      for (let i = 0; i < 600; i++) {
         stepCleanerGait(gait, 5, DT);
         expect(gait.phase).toBeGreaterThanOrEqual(0);
         expect(gait.phase).toBeLessThan(TAU);
      }
   });
});

type Step = (gait: CleanerGait, v: number, dt: number) => void;

/** The runner's gait on main before the cleaner: walkStride, but at most 4 strides a second and 0.1 m. */
const runnerStep = (l: HumanoidLandmarks, scale: number): Step => (g, v, dt) => {
   g.amount += (Math.min(1, v / RUNNER.speed) - g.amount) * (1 - Math.exp(-12 * dt));
   const stride = Math.max(0.1, walkStride(g.amount, l) * scale, v / 4);
   g.phase += ((v * dt) / stride) * TAU;
};

/**
 * Drives `step` at `speedAt(t)` and follows the left ankle on the floor plane as the Scene draws it
 * (the body carried along +z, the gait's pose lifted by bodyLift): per stance (the left foot carrying
 * the body, its sole on the floor (within ON_FLOOR) and no higher than the right one, over
 * consecutive steps, from the second stance on) the ankle's travel from touch-down to lift-off, over
 * the body's travel meanwhile. 0 = it stays put, 1 = it slides with the body.
 */
function stanceSlide(step: Step, l: HumanoidLandmarks, scale: number, speedAt: (t: number) => number, seconds: number, from = 0): number {
   const gait = createCleanerGait();
   const p = createPose();
   const f = new Float64Array(4);
   const r = new Float64Array(4);
   let x = 0;
   const frames: Array<{ x: number; z: number; sole: number; other: number }> = [];
   for (let t = 0; t < seconds; t += PROBE_DT) {
      const v = speedAt(t);
      step(gait, v, PROBE_DT);
      x += v * PROBE_DT;
      if (t < from) continue;
      walkPose(gait.phase, gait.amount, p);
      const lift = bodyLift(p, l);
      footPoint(p, l, 1, f);
      footPoint(p, l, -1, r);
      frames.push({ x, z: x + f[2] * scale, sole: f[3] + lift, other: r[3] + lift });
   }
   const on =(i: number) => frames[i].sole < ON_FLOOR && frames[i].sole <= frames[i].other + 1e-9;
   let slide = 0;
   let body = 0;
   let start = -1;
   for (let i = 0; i < frames.length; i++) {
      if (on(i) && start < 0) start = i;
      if (!on(i) && start >= 0) {
         if (start > 0 && i - 1 > start) {
            slide += Math.abs(frames[i - 1].z - frames[start].z);
            body += frames[i - 1].x - frames[start].x;
         }
         start = -1;
      }
   }
   expect(body).toBeGreaterThan(0);
   return slide / body;
}

describe("clean-city: the planted foot stays put (core footPoint, the cleaner's landmarks)", () => {
   const gaitStep: Step = (g, v, dt) => stepCleanerGait(g, v, dt);
   const steady = (v: number) => () => v;
   const fromRest = (v: number) => (t: number) => Math.min(v, RUNNER.accel * (t + PROBE_DT));

   it("at every steady speed from the joystick's slowest (0.6 u/s) to the 5 u/s top speed, its ankle travels under 6 % of the ground covered in a stance", () => {
      for (const v of [0.6, 1, 1.5, 2, 2.5, 2.75, 3, 3.5, 4, 4.5, 5]) {
         expect(stanceSlide(gaitStep, L, CLEANER_SCALE, steady(v), 2, 1), `v ${v}`).toBeLessThan(0.06);
      }
   });

   it("speeding up from rest (24 u/s²) to 2.5 or 5 u/s, less than the old gait", () => {
      for (const v of [2.5, 5]) {
         const now = stanceSlide(gaitStep, L, CLEANER_SCALE, fromRest(v), 0.6);
         const old = stanceSlide(runnerStep(L, CLEANER_SCALE), L, CLEANER_SCALE, fromRest(v), 0.6);
         expect(now, `to ${v}`).toBeLessThan(0.12);
         expect(now, `to ${v}: old ${old.toFixed(3)}`).toBeLessThan(old);
      }
   });

   it("the runner's old gait (at most 4 strides a second) slid: over 15 % at a walk and 10 % at the top speed on the runner, more than 15 % at a walk on the cleaner", () => {
      for (const v of [1, 2]) expect(stanceSlide(runnerStep(RUNNER_LANDMARKS, 0.503), RUNNER_LANDMARKS, 0.503, steady(v), 2, 1), `runner v ${v}`).toBeGreaterThan(0.15);
      expect(stanceSlide(runnerStep(RUNNER_LANDMARKS, 0.503), RUNNER_LANDMARKS, 0.503, steady(5), 2, 1)).toBeGreaterThan(0.1);
      for (const v of [1, 2]) expect(stanceSlide(runnerStep(L, CLEANER_SCALE), L, CLEANER_SCALE, steady(v), 2, 1), `cleaner v ${v}`).toBeGreaterThan(0.15);
   });

   it("plain walkStride at a run (no RUN_STRIDE) would skid the planted foot backwards: over 30 % at 5 u/s", () => {
      const plain: Step = (g, v, dt) => {
         g.amount = Math.min(1, v / RUNNER.speed);
         g.phase += ((v * dt) / (walkStride(g.amount, L) * CLEANER_SCALE)) * TAU;
      };
      expect(stanceSlide(plain, L, CLEANER_SCALE, steady(5), 2, 1)).toBeGreaterThan(0.3);
      expect(stanceSlide(plain, L, CLEANER_SCALE, steady(2), 2, 1)).toBeLessThan(0.06);
   });
});
