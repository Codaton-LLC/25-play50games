// The cleaner's walk cycle (gait.ts), pure, on the cleaner's landmarks: the stride is core
// contactStride (the walk's own at a walk, the contact stride at a run, recomputed here from core
// walkPose, footPoint and bodyLift), neither clamp of gaitPhaseStep ever bites at a speed the rules
// allow, the amount follows the speed, and the planted ankle stays put through a stance at every
// speed (the runner's old cap-4 gait slid). cleaner.test.ts checks the same on the real mesh's soles.
import { describe, expect, it } from "vitest";
import { MAX_ANIM_DT, clampFrameDt, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { bodyLift, contactStride, createPose, footPoint, walkPose, walkStride, type HumanoidLandmarks } from "@/arcade3d/core/rig";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { CLEANER_LANDMARKS } from "./assets";
import {
   AMOUNT_EASE_DOWN,
   CLEANER_MAX_CADENCE,
   CLEANER_MIN_STRIDE,
   CLEANER_SCALE,
   cleanerPhaseStep,
   createCleanerGait,
   gaitFrameDt,
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
function measuredContact(amount: number, l: HumanoidLandmarks): { stride: number; share: number } {
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
         const v = a * RUNNER.speed;
         const stride = strideOf(cleanerPhaseStep(a, v, DT), v);
         expect(stride, `amount ${a}`).toBeCloseTo(contactStride(a, L) * CLEANER_SCALE, 9);
         // the run starts letting go of the floor from 0.5 (core contactStride: 1.6 % longer at 0.53)
         expect(stride / (walkStride(a, L) * CLEANER_SCALE), `amount ${a}`).toBeCloseTo(1, a <= 0.5 ? 2 : 1);
         const contact = measuredContact(a, L);
         expect(contact.share, `amount ${a}`).toBeCloseTo(0.5, 2);
         expect(contact.stride / walkStride(a, L), `amount ${a}`).toBeCloseTo(1, 2);
      }
   });

   it("at a run the stride is core contactStride: within 1 % of the contact stride measured here (the ankle's sweep over the floor contact, the old RUN_STRIDE table's amounts), up to 1.42 x walkStride", () => {
      // the old table's measured factors (contact stride over walkStride), at amounts away from the walk-to-run handover
      const table = [
         [0.56, 1.183],
         [0.58, 1.211],
         [0.6, 1.228],
         [0.65, 1.265],
         [0.7, 1.303],
         [0.75, 1.342],
         [0.8, 1.375],
         [0.85, 1.4],
         [0.9, 1.41],
         [1, 1.42],
      ] as const;
      for (const [a, factor] of table) {
         const v = Math.min(1, a) * RUNNER.speed;
         const ratio = strideOf(cleanerPhaseStep(a, v, DT), v) / (walkStride(a, L) * CLEANER_SCALE);
         expect(Math.abs(ratio / factor - 1), `amount ${a}: x${ratio.toFixed(3)}`).toBeLessThan(0.01);
      }
      for (let a = 0.555; a < 1; a += 0.025) {
         const measured = measuredContact(a, L).stride / walkStride(a, L);
         const ratio = contactStride(a, L) / walkStride(a, L);
         expect(Math.abs(ratio / measured - 1), `amount ${a.toFixed(3)}: measured x${measured.toFixed(3)}`).toBeLessThan(0.02);
      }
      // the run touches the floor for a fraction of the cycle: 37 % at 0.55, 9 % at full speed
      expect(measuredContact(0.55, L).share).toBeLessThan(0.4);
      expect(measuredContact(1, L).share).toBeLessThan(0.1);
      expect(contactStride(2, L)).toBe(contactStride(1, L));
   });

   it("neither clamp bites at a speed the rules allow (0.05 to 5 u/s, the amount at or above speed / 5): the cadence stays under 5.05 strides a second", () => {
      let peak = 0;
      for (let v = 0.05; v <= RUNNER.speed + 1e-9; v += 0.05) {
         for (const extra of [0, 0.1, 0.3, 1]) {
            const a = Math.min(1, v / RUNNER.speed + extra);
            const own = contactStride(a, L) * CLEANER_SCALE;
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
      expect(cleanerPhaseStep(1, RUNNER.speed, DT) / TAU / DT).toBeCloseTo(4.24, 1);
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

   it("gaitFrameDt: while playing the gait steps by the play time the rules counted (at most 1/20 s), else by the animation clock", () => {
      expect(gaitFrameDt({ phase: "playing", frameMs: 16 }, 0.016)).toBeCloseTo(0.016, 12);
      // an 80 ms frame: the run clock counts 50 ms (MAX_FRAME_DT), the animation clock 80 ms
      expect(gaitFrameDt({ phase: "playing", frameMs: clampFrameDt(0.08) * 1000 }, Math.min(0.08, MAX_ANIM_DT))).toBeCloseTo(0.05, 12);
      expect(gaitFrameDt({ phase: "playing", frameMs: 0 }, 0.016)).toBe(0);
      // after the end (and in the countdown) the amount eases down on the animation clock; paused it is 0
      expect(gaitFrameDt({ phase: "over", frameMs: 0 }, 0.016)).toBe(0.016);
      expect(gaitFrameDt({ phase: "countdown", frameMs: 0 }, 0.016)).toBe(0.016);
      expect(gaitFrameDt({ phase: "paused", frameMs: 16 }, 0)).toBe(0);
   });

   it("at a sustained 10-20 fps the legs cover exactly the ground the rules moved the runner (the animation clock's delta would turn them 1.33-2 times as far: the foot skids 33-100 %)", () => {
      /** Over 4 s at `fps`: the gait's phase advance (strides) x its stride, over the ground the rules covered. */
      const cover = (fps: number, v: number, drive: (state: { phase: "playing"; frameMs: number }, animDelta: number) => number) => {
         const frame = 1 / fps;
         const gait = createCleanerGait();
         let ground = 0;
         let turned = 0;
         for (let i = 0; i < 4 * fps; i++) {
            // one frame as the canvas runs it: the run clock counts at most 1/20 s (useRunFrame moves
            // the runner by that), the animation clock the whole frame up to 0.1 s
            const state = { phase: "playing" as const, frameMs: clampFrameDt(frame) * 1000 };
            ground += v * playedFrameDt(state);
            const before = gait.phase;
            stepCleanerGait(gait, v, drive(state, Math.min(frame, MAX_ANIM_DT)));
            turned += (((gait.phase - before) % TAU) + TAU) % TAU;
         }
         // the amount is v / 5 from the first frame on (it follows the speed up at once)
         const stride = contactStride(gait.amount, L) * CLEANER_SCALE;
         return ((turned / TAU) * stride) / ground;
      };
      for (const fps of [10, 15, 20, 60]) {
         for (const v of [1, 2.5, 5]) {
            expect(cover(fps, v, gaitFrameDt), `${fps} fps v ${v}`).toBeCloseTo(1, 9);
            const old = cover(fps, v, (_state, animDelta) => animDelta);
            if (fps < 20) expect(old, `old drive ${fps} fps v ${v}`).toBeGreaterThan(1.3);
            else expect(old, `old drive ${fps} fps v ${v}`).toBeCloseTo(1, 9);
         }
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
 * consecutive steps, from the second stance on): `net`, the ankle's travel from touch-down to
 * lift-off over the body's travel meanwhile (0 = it stays put, 1 = it slides with the body), and
 * `maxDrift`, the farthest (world units) the ankle gets from its touch-down point within any stance
 * (the walk's foot rocks forward and back, which the net hides).
 */
function stances(step: Step, l: HumanoidLandmarks, scale: number, speedAt: (t: number) => number, seconds: number, from = 0): { net: number; maxDrift: number } {
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
   let maxDrift = 0;
   let drift = 0;
   let start = -1;
   for (let i = 0; i < frames.length; i++) {
      if (on(i) && start < 0) {
         start = i;
         drift = 0;
      }
      if (on(i)) drift = Math.max(drift, Math.abs(frames[i].z - frames[start].z));
      if (!on(i) && start >= 0) {
         if (start > 0 && i - 1 > start) {
            slide += Math.abs(frames[i - 1].z - frames[start].z);
            body += frames[i - 1].x - frames[start].x;
            maxDrift = Math.max(maxDrift, drift);
         }
         start = -1;
      }
   }
   expect(body).toBeGreaterThan(0);
   return { net: slide / body, maxDrift };
}

const stanceSlide = (...args: Parameters<typeof stances>): number => stances(...args).net;

describe("clean-city: the planted foot stays put (core footPoint, the cleaner's landmarks)", () => {
   const gaitStep: Step = (g, v, dt) => stepCleanerGait(g, v, dt);
   const steady = (v: number) => () => v;
   const fromRest = (v: number) => (t: number) => Math.min(v, RUNNER.accel * (t + PROBE_DT));

   it("at every steady speed from the joystick's slowest (0.6 u/s) to the 5 u/s top speed, its ankle's net travel from touch-down to lift-off is under 6 % of the ground covered in a stance (6.5 % in the walk-to-run handover, 2.75 u/s)", () => {
      for (const v of [0.6, 1, 1.5, 2, 2.5, 2.75, 3, 3.5, 4, 4.5, 5]) {
         expect(stanceSlide(gaitStep, L, CLEANER_SCALE, steady(v), 2, 1), `v ${v}`).toBeLessThan(v === 2.75 ? 0.065 : 0.06);
      }
   });

   it("within a stance the ankle gets under 2.5 cm from where it touched down at a walk (0.6-2.5 u/s: it rocks forward, then back), under 1 cm at 2.75 u/s and under 3 mm at a run (3-5 u/s)", () => {
      let walkPeak = 0;
      for (const v of [0.6, 1, 1.5, 2, 2.25, 2.5]) {
         const { maxDrift } = stances(gaitStep, L, CLEANER_SCALE, steady(v), 2, 1);
         expect(maxDrift, `v ${v}`).toBeLessThan(0.025);
         walkPeak = Math.max(walkPeak, maxDrift);
      }
      // the rock the README documents (1.5-2.5 cm back at 2-2.7 u/s): a core re-timing of the walk's
      // stance (or foot IK) would lower it, and the README with it
      expect(walkPeak).toBeGreaterThan(0.012);
      expect(stances(gaitStep, L, CLEANER_SCALE, steady(2.75), 2, 1).maxDrift).toBeLessThan(0.01);
      for (const v of [3, 3.5, 4, 4.5, 5]) {
         expect(stances(gaitStep, L, CLEANER_SCALE, steady(v), 2, 1).maxDrift, `v ${v}`).toBeLessThan(0.003);
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

   it("plain walkStride at a run (not the contact stride) would skid the planted foot backwards: over 30 % at 5 u/s", () => {
      const plain: Step = (g, v, dt) => {
         g.amount = Math.min(1, v / RUNNER.speed);
         g.phase += ((v * dt) / (walkStride(g.amount, L) * CLEANER_SCALE)) * TAU;
      };
      expect(stanceSlide(plain, L, CLEANER_SCALE, steady(5), 2, 1)).toBeGreaterThan(0.3);
      expect(stanceSlide(plain, L, CLEANER_SCALE, steady(2), 2, 1)).toBeLessThan(0.06);
   });
});
