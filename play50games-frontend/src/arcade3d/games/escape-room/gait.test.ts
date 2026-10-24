// The runner's walk cycle (gait.ts), pure, on RUNNER_LANDMARKS at escape-room's scale: the stride is
// the walk's own at a walk and the measured contact stride at a run (RUN_STRIDE, recomputed here from
// core walkPose, footPoint and bodyLift), and the planted ankle stays put through a stance at every
// speed up to RUNNER.speed (2.6 m/s). The old gait (plain walkStride, eased amount) skidded at a run.
import { describe, expect, it } from "vitest";
import { bodyLift, createPose, footPoint, walkPose, walkStride, type HumanoidLandmarks } from "@/arcade3d/core/rig";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { RUNNER_SCALE } from "./assets";
import { AMOUNT_EASE_DOWN, AMOUNT_EASE_UP, RUN_STRIDE, createRunnerGait, gaitFrameDt, runStrideFactor, runnerPhaseStep, stepRunnerGait, type RunnerGait } from "./gait";
import { RUNNER } from "./rules";

const TAU = Math.PI * 2;
const DT = 1 / 60;
const PROBE_DT = 1 / 600;
const ON_FLOOR = 0.0005;
const L = RUNNER_LANDMARKS;
const strideOf = (step: number, v: number, dt = DT) => (v * dt * TAU) / step;

/** The stride (GLB units) that keeps walkPose's left foot still while its sole is on the floor at `amount`. */
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

type Step = (gait: RunnerGait, v: number, dt: number) => void;

/** The planted left ankle's net travel per stance over the body's travel meanwhile (0 = it stays put). */
function stanceSlide(step: Step, speedAt: (t: number) => number, seconds: number, from = 0): number {
   const gait = createRunnerGait();
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
      const lift = bodyLift(p, L);
      footPoint(p, L, 1, f);
      footPoint(p, L, -1, r);
      frames.push({ x, z: x + f[2] * RUNNER_SCALE, sole: f[3] + lift, other: r[3] + lift });
   }
   const on = (i: number) => frames[i].sole < ON_FLOOR && frames[i].sole <= frames[i].other + 1e-9;
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

/** Scene.tsx's gait before gait.ts: plain walkStride (at least 0.1 m), the amount eased both ways at 12/s. */
const OLD_GAIT: Step = (g, v, dt) => {
   g.amount += (Math.min(1, v / RUNNER.speed) - g.amount) * (1 - Math.exp(-12 * dt));
   g.phase += ((v * dt) / Math.max(0.1, walkStride(g.amount, L) * RUNNER_SCALE)) * TAU;
};

describe("escape-room runner gait (gait.ts)", () => {
   it("standing still (or for no time) the phase does not advance; at a walk the stride is the walk's own x RUNNER_SCALE", () => {
      expect(runnerPhaseStep(0, 0, DT)).toBe(0);
      expect(runnerPhaseStep(0.4, 0, DT)).toBe(0);
      expect(runnerPhaseStep(0.4, 1, 0)).toBe(0);
      for (const a of [0.05, 0.2, 0.4, 0.53]) {
         expect(runStrideFactor(a)).toBe(1);
         const v = a * RUNNER.speed;
         expect(strideOf(runnerPhaseStep(a, v, DT), v), `amount ${a}`).toBeCloseTo(walkStride(a, L) * RUNNER_SCALE, 9);
         expect(contactStride(a, L).stride / walkStride(a, L), `amount ${a}`).toBeCloseTo(1, 2);
      }
   });

   it("RUN_STRIDE is the measured contact stride over walkStride (within 1 %), its interpolation within 2 % in between", () => {
      for (const [a, factor] of RUN_STRIDE) {
         if (a < 0.54) continue;
         const measured = contactStride(a, L).stride / walkStride(a, L);
         expect(Math.abs(measured / factor - 1), `amount ${a}: measured x${measured.toFixed(4)}`).toBeLessThan(0.01);
      }
      for (let a = 0.555; a < 1; a += 0.025) {
         const measured = contactStride(a, L).stride / walkStride(a, L);
         expect(Math.abs(runStrideFactor(a) / measured - 1), `amount ${a.toFixed(3)}`).toBeLessThan(0.02);
      }
      expect(contactStride(1, L).share).toBeLessThan(0.1);
      expect(runStrideFactor(2)).toBe(RUN_STRIDE[RUN_STRIDE.length - 1][1]);
      // at the 2.6 m/s top speed: a 1.60 m stride, about 1.6 strides (3.2 steps) a second
      expect(strideOf(runnerPhaseStep(1, RUNNER.speed, DT), RUNNER.speed)).toBeCloseTo(walkStride(1, L) * RUNNER_SCALE * 1.41, 9);
      expect(runnerPhaseStep(1, RUNNER.speed, DT) / TAU / DT).toBeCloseTo(1.62, 1);
   });

   it("the amount eases up fast (AMOUNT_EASE_UP) and down slower, and the phase stays wrapped", () => {
      const gait = createRunnerGait();
      stepRunnerGait(gait, RUNNER.speed, DT);
      expect(gait.amount).toBeCloseTo(1 - Math.exp(-AMOUNT_EASE_UP * DT), 12);
      for (let i = 0; i < 60; i++) stepRunnerGait(gait, RUNNER.speed * 2, DT);
      expect(gait.amount).toBeGreaterThan(0.999);
      expect(gait.amount).toBeLessThanOrEqual(1);
      const before = gait.amount;
      stepRunnerGait(gait, 0, DT);
      expect(gait.amount).toBeCloseTo(before * Math.exp(-AMOUNT_EASE_DOWN * DT), 12);
      for (let i = 0; i < 600; i++) {
         stepRunnerGait(gait, RUNNER.speed, DT);
         expect(gait.phase).toBeGreaterThanOrEqual(0);
         expect(gait.phase).toBeLessThan(TAU);
      }
      expect(gaitFrameDt({ phase: "playing", frameMs: 16 }, 0.03)).toBeCloseTo(0.016, 12);
      expect(gaitFrameDt({ phase: "over", frameMs: 0 }, 0.016)).toBe(0.016);
      expect(gaitFrameDt({ phase: "paused", frameMs: 16 }, 0)).toBe(0);
   });

   it("the planted foot stays put: under 6 % net ankle travel per stance at steady speeds up to 2.6 m/s, and less than the old gait from rest", () => {
      const gaitStep: Step = (g, v, dt) => stepRunnerGait(g, v, dt);
      // (about 1.4 m/s, amount 0.53-0.55, is walkPose's walk-to-run switch: about 18 % there with any
      // stride, a core walkPose matter, and a speed passed through, not held)
      for (const v of [0.4, 0.8, 1.2, 1.6, 1.8, 2.2, RUNNER.speed]) {
         expect(stanceSlide(gaitStep, () => v, 2, 1), `v ${v}`).toBeLessThan(0.06);
      }
      for (const top of [1.8, RUNNER.speed]) {
         const fromRest = (t: number) => Math.min(top, RUNNER.accel * (t + PROBE_DT));
         const now = stanceSlide(gaitStep, fromRest, 1.5);
         expect(now, `to ${top}`).toBeLessThan(0.1);
         expect(now, `to ${top}`).toBeLessThan(stanceSlide(OLD_GAIT, fromRest, 1.5));
      }
   });

   it("the old Scene gait (plain walkStride, eased amount) skidded at the 2.6 m/s run: over 25 %", () => {
      expect(stanceSlide(OLD_GAIT, () => RUNNER.speed, 2, 1)).toBeGreaterThan(0.25);
   });
});
