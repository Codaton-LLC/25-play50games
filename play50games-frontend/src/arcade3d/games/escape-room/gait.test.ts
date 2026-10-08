// The runner's walk cycle (gait.ts): a jog at the room's 1.8 m/s (the run only at 2.7), the stride
// the contact stride at every speed; on the real runner.glb the planted sole stays put (the old
// full-run pose on walkStride slid it 31-45 % from 1.2 m/s).
import { beforeAll, describe, expect, it } from "vitest";
import { contactStride, walkStride } from "@/arcade3d/core/rig";
import { rigCharacter } from "@/arcade3d/core/rig/characterChecks";
import { gaitSlide, meshFeet, type FeetOf } from "@/arcade3d/core/rig/stanceSlide";
import { RUNNER_LANDMARKS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";
import { RUNNER_SCALE } from "./assets";
import { RUN_SPEED, RUNNER_MIN_STRIDE, runnerPhaseStep, walkAmount } from "./gait";
import { RUNNER } from "./rules";

const TAU = Math.PI * 2;
const DT = 1 / 60;
const L = RUNNER_LANDMARKS;

describe("escape-room runner gait (gait.ts)", () => {
   it("still when still; a jog (amount 0.67) at the room's 1.8 m/s top speed", () => {
      expect(runnerPhaseStep(0.5, 0, DT)).toBe(0);
      expect(RUNNER.speed).toBe(1.8);
      expect(RUN_SPEED).toBe(2.7);
      expect(walkAmount(RUNNER.speed)).toBeCloseTo(2 / 3, 9);
      expect(walkAmount(9)).toBe(1);
   });

   it("the stride is the contact stride from 0.05 m/s to the top speed: 1.7-2.0 strides a second from a walk to the top (the full run there would be 1.1)", () => {
      for (let v = 0.05; v <= RUNNER.speed + 1e-9; v += 0.05) {
         const a = walkAmount(v);
         const own = contactStride(a, L) * RUNNER_SCALE;
         expect(own, `v ${v.toFixed(2)}`).toBeGreaterThan(RUNNER_MIN_STRIDE);
         const cadence = runnerPhaseStep(a, v, DT) / TAU / DT;
         expect((v * DT * TAU) / runnerPhaseStep(a, v, DT)).toBeCloseTo(own, 9);
         if (v >= 0.6) expect(cadence, `v ${v.toFixed(2)}`).toBeGreaterThan(1.6);
         expect(cadence, `v ${v.toFixed(2)}`).toBeLessThan(2.05);
      }
      expect(RUNNER.speed / (contactStride(1, L) * RUNNER_SCALE)).toBeLessThan(1.2);
   });
});

describe("escape-room: the planted foot (runner.glb's soles)", () => {
   let feet: FeetOf;
   beforeAll(async () => {
      feet = meshFeet(await rigCharacter(SHARED_ASSETS.runner));
   });

   it("from 0.6 m/s to the 1.8 m/s top speed its net travel per stance is under 5 % of the body's (the old gait: over 25 % from 1.2 m/s)", () => {
      for (const v of [0.6, 1.2, RUNNER.speed]) {
         const g = { phase: 0, amount: 0 };
         const r = gaitSlide(L, RUNNER_SCALE, feet, (dt) => {
            g.amount += (walkAmount(v) - g.amount) * (1 - Math.exp(-12 * dt));
            g.phase += runnerPhaseStep(g.amount, v, dt);
            return { phase: g.phase, amount: g.amount, speed: v };
         }, 4);
         expect(r.stances, `v ${v}`).toBeGreaterThan(4);
         expect(r.net, `v ${v}`).toBeLessThan(0.05);
         // the old drive: the amount speed / 1.8, the phase over walkStride
         const o = { phase: 0, amount: 0 };
         const old = gaitSlide(L, RUNNER_SCALE, feet, (dt) => {
            o.amount += (Math.min(1, v / RUNNER.speed) - o.amount) * (1 - Math.exp(-12 * dt));
            o.phase += ((v * dt) / Math.max(0.1, walkStride(o.amount, L) * RUNNER_SCALE)) * TAU;
            return { phase: o.phase, amount: o.amount, speed: v };
         }, 4);
         if (v >= 1.2) expect(old.net, `old v ${v}`).toBeGreaterThan(0.25);
      }
   });
});
