// The runner's run cycle (gait.ts): the amount from the speed (a walk at least), the phase advanced
// by the ground covered on foot over the contact stride (the cadence cap never binds at a steady
// speed); on the real runner.glb the planted sole stays put at every speed (the fixed 1.7 m stride
// slid it 23-56 % below 4.5 m/s).
import { beforeAll, describe, expect, it } from "vitest";
import { contactStride } from "@/arcade3d/core/rig";
import { rigCharacter } from "@/arcade3d/core/rig/characterChecks";
import { gaitSlide, meshFeet, type FeetOf } from "@/arcade3d/core/rig/stanceSlide";
import { RUNNER_LANDMARKS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";
import { RUNNER_MAX_CADENCE, RUNNER_MIN_STRIDE, RUNNER_SCALE, runAmount, runnerPhaseStep } from "./gait";
import { V_RUN } from "./rules";

const TAU = Math.PI * 2;
const DT = 1 / 60;
const L = RUNNER_LANDMARKS;

describe("obstacle-race runner gait (gait.ts)", () => {
   it("no ground covered, no step; the amount is a walk at least and the run at V_RUN", () => {
      expect(runnerPhaseStep(0.8, 0, DT)).toBe(0);
      expect(runnerPhaseStep(0.8, -0.1, DT)).toBe(0);
      expect(runAmount(0.1)).toBe(0.5);
      expect(runAmount(0.75)).toBe(0.75);
      expect(runAmount(2)).toBe(1);
   });

   it("at every speed up to V_RUN the stride is the contact stride for the amount (the full run's 1.71 m at 6 m/s): at most 4.13 strides a second, under the cap", () => {
      expect(V_RUN).toBe(6);
      let peak = 0;
      for (let v = 0.3; v <= V_RUN + 1e-9; v += 0.05) {
         const a = runAmount(v / V_RUN);
         const step = runnerPhaseStep(a, v * DT, DT);
         const own = contactStride(a, L) * RUNNER_SCALE;
         expect(own).toBeGreaterThan(RUNNER_MIN_STRIDE);
         expect((v * DT * TAU) / step, `v ${v.toFixed(2)}`).toBeCloseTo(own, 9);
         peak = Math.max(peak, step / TAU / DT);
      }
      expect(contactStride(1, L) * RUNNER_SCALE).toBeCloseTo(1.71, 2);
      expect(peak).toBeCloseTo(4.13, 1);
      expect(RUNNER_MAX_CADENCE).toBeGreaterThan(peak);
   });
});

describe("obstacle-race: the planted foot (runner.glb's soles)", () => {
   let feet: FeetOf;
   beforeAll(async () => {
      feet = meshFeet(await rigCharacter(SHARED_ASSETS.runner));
   });

   /** The Scene's drive at a steady `v`: the amount eased at 10/s towards runAmount, the phase by the ground covered. */
   const drive = (v: number) => {
      const g = { phase: 0, amount: 0 };
      return (dt: number) => {
         g.amount += (runAmount(v / V_RUN) - g.amount) * (1 - Math.exp(-10 * dt));
         g.phase += runnerPhaseStep(g.amount, v * dt, dt);
         return { phase: g.phase, amount: g.amount, speed: v };
      };
   };
   /** The old drive: the ground covered over a fixed 1.7 m. */
   const old = (v: number) => {
      const g = { phase: 0, amount: 0 };
      return (dt: number) => {
         g.amount += (runAmount(v / V_RUN) - g.amount) * (1 - Math.exp(-10 * dt));
         g.phase += ((v * dt) / 1.7) * TAU;
         return { phase: g.phase, amount: g.amount, speed: v };
      };
   };

   it("at steady speeds from 2 to 6 m/s its net travel per stance is under 6 % of the body's (the fixed 1.7 m stride: over 20 % below 4.5 m/s)", () => {
      for (const v of [2, 3, 4.5, 6]) {
         const r = gaitSlide(L, RUNNER_SCALE, feet, drive(v));
         expect(r.stances, `v ${v}`).toBeGreaterThan(3);
         expect(r.net, `v ${v}`).toBeLessThan(0.06);
         if (v < 5) expect(gaitSlide(L, RUNNER_SCALE, feet, old(v)).net, `old v ${v}`).toBeGreaterThan(0.2);
      }
   });
});
