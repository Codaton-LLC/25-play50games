// The runner's run cycle (gait.ts): the phase advances by the ground covered over the contact stride
// at the full run, at most RUNNER_MAX_CADENCE strides a second; on the real runner.glb the planted
// sole stays put up to 12.4 m/s and slides less than the old fixed 2.4 m stride above it.
import { beforeAll, describe, expect, it } from "vitest";
import { contactStride } from "@/arcade3d/core/rig";
import { rigCharacter } from "@/arcade3d/core/rig/characterChecks";
import { gaitSlide, meshFeet, type FeetOf } from "@/arcade3d/core/rig/stanceSlide";
import { RUNNER_LANDMARKS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";
import { RUNNER_MAX_CADENCE, RUNNER_SCALE, RUN_AMOUNT, createRunnerGait, stepRunnerGait } from "./gait";
import { MAX_SPEED, SPEED } from "./rules";

const TAU = Math.PI * 2;
const DT = 1 / 60;
const L = RUNNER_LANDMARKS;

/** The gait at a steady `v` (m/s) after `seconds`, and the strides a second of the last frame. */
function settle(v: number, seconds = 1): { cadence: number; amount: number } {
   const g = createRunnerGait();
   let distance = 0;
   let before = 0;
   for (let t = 0; t < seconds; t += DT) {
      before = g.phase;
      distance += v * DT * 1000;
      stepRunnerGait(g, distance, true, DT);
   }
   return { cadence: (((g.phase - before) % TAU) + TAU) % TAU / TAU / DT, amount: g.amount };
}

describe("office-escape runner gait (gait.ts)", () => {
   it("no ground covered, no step; a new run (the distance back to 0) steps nothing; the amount eases to the full run while moving and back to 0", () => {
      const g = createRunnerGait();
      stepRunnerGait(g, 0, false, DT);
      expect(g.phase).toBe(0);
      stepRunnerGait(g, 5000, true, DT);
      const phase = g.phase;
      stepRunnerGait(g, 5000, true, DT);
      expect(g.phase).toBe(phase);
      stepRunnerGait(g, 0, true, DT);
      expect(g.phase).toBe(phase);
      expect(RUN_AMOUNT).toBe(1);
      expect(settle(8).amount).toBeGreaterThan(0.9999);
      for (let i = 0; i < 120; i++) stepRunnerGait(g, 0, false, DT);
      expect(g.amount).toBeLessThan(1e-4);
   });

   it("from the 8 m/s start to 12 m/s the stride is the full run's contact stride (1.78 m: 4.5-6.7 strides a second); faster, at most RUNNER_MAX_CADENCE (7)", () => {
      expect(SPEED.start).toBe(8);
      expect(MAX_SPEED).toBe(16);
      const own = contactStride(1, L) * RUNNER_SCALE;
      expect(own).toBeCloseTo(1.78, 2);
      for (const v of [8, 9, 10, 11, 12]) expect(settle(v, 2).cadence, `v ${v}`).toBeCloseTo(v / own, 4);
      expect(own * RUNNER_MAX_CADENCE).toBeGreaterThan(12.4);
      for (const v of [13, 14, 16]) expect(settle(v).cadence, `v ${v}`).toBeCloseTo(RUNNER_MAX_CADENCE, 6);
   });
});

describe("office-escape: the planted foot (runner.glb's soles)", () => {
   let feet: FeetOf;
   beforeAll(async () => {
      feet = meshFeet(await rigCharacter(SHARED_ASSETS.runner));
   });

   const drive = (v: number) => {
      const g = createRunnerGait();
      let distance = 0;
      return (dt: number) => {
         distance += v * dt * 1000;
         stepRunnerGait(g, distance, true, dt);
         return { phase: g.phase, amount: g.amount, speed: v };
      };
   };
   /** The stand-in's old phase: distance / 2.4 m, the amount 0.85 -> 1 with the speed. */
   const old = (v: number) => {
      let distance = 0;
      let amount = 0;
      return (dt: number) => {
         distance += v * dt;
         amount += (0.85 + 0.15 * Math.min(1, (v - 8) / 8) - amount) * (1 - Math.exp(-10 * dt));
         return { phase: (distance / 2.4) * TAU, amount, speed: v };
      };
   };

   it("from 8 to 12 m/s its net travel per stance is under 6 % of the body's (the run touches the floor for 9 % of its cycle, the sole turning with the hips; the fixed 2.4 m stride slid it 30-36 %)", () => {
      for (const v of [8, 10, 12]) {
         const r = gaitSlide(L, RUNNER_SCALE, feet, drive(v));
         expect(r.stances, `v ${v}`).toBeGreaterThan(4);
         expect(r.net, `v ${v}`).toBeLessThan(0.06);
         expect(gaitSlide(L, RUNNER_SCALE, feet, old(v)).net, `old v ${v}`).toBeGreaterThan(0.28);
      }
   });

   it("at 14 and 16 m/s the cadence cap stretches the stride: under 25 %, less than the old stride's", () => {
      for (const v of [14, 16]) {
         const now = gaitSlide(L, RUNNER_SCALE, feet, drive(v)).net;
         expect(now, `v ${v}`).toBeLessThan(0.25);
         expect(now, `v ${v}`).toBeLessThan(gaitSlide(L, RUNNER_SCALE, feet, old(v)).net);
      }
   });
});
