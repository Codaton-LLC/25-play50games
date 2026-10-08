// The GLB robot's walk cycle (gait.ts): the amount is the run's from 4 m/s (a long stride for this
// small robot's speed), follows the speed up at once and eases down; the stride is the contact
// stride at every speed (the cadence cap never binds); on the real robot.glb the planted sole stays
// put at every speed, carrying or not, and from rest.
import { beforeAll, describe, expect, it } from "vitest";
import { contactStride, walkStride } from "@/arcade3d/core/rig";
import { rigCharacter } from "@/arcade3d/core/rig/characterChecks";
import { gaitSlide, meshFeet, type FeetOf } from "@/arcade3d/core/rig/stanceSlide";
import { ROBOT_LANDMARKS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";
import {
   AMOUNT_EASE_DOWN,
   WAREHOUSE_MAX_CADENCE,
   WAREHOUSE_MIN_STRIDE,
   WAREHOUSE_RUN_SPEED,
   WAREHOUSE_SCALE,
   warehouseAmount,
   warehousePhaseStep,
} from "./gait";
import { ROBOT } from "./rules";

const TAU = Math.PI * 2;
const DT = 1 / 60;
const amountAt = (v: number) => Math.min(1, v / WAREHOUSE_RUN_SPEED);
const strideOf = (amount: number, v: number) => (v * DT * TAU) / warehousePhaseStep(amount, v, DT);

describe("warehouse-rush robot gait", () => {
   it("does not advance while stopped or when the frame has no time; a still pose steps on the 2 cm minimum", () => {
      expect(warehousePhaseStep(0, 0, DT)).toBe(0);
      expect(warehousePhaseStep(0.4, 0, DT)).toBe(0);
      expect(warehousePhaseStep(0.4, 2, 0)).toBe(0);
      expect(WAREHOUSE_MIN_STRIDE).toBe(0.02);
      expect(strideOf(0, 0.01)).toBeCloseTo(WAREHOUSE_MIN_STRIDE, 9);
   });

   it("the amount follows the speed up at once (the run from 4 m/s) and eases down", () => {
      expect(WAREHOUSE_SCALE).toBe(0.7);
      expect(WAREHOUSE_RUN_SPEED).toBe(4);
      expect(warehouseAmount(0, 2, DT)).toBe(0.5);
      expect(warehouseAmount(0.3, ROBOT.speed, DT)).toBe(1);
      expect(warehouseAmount(1, 0, DT)).toBeCloseTo(Math.exp(-AMOUNT_EASE_DOWN * DT), 12);
   });

   it("at every speed up to 6 m/s the stride is the contact stride x 0.7: at most 4.54 strides a second (at the top), under the cap; with the old speed / 6 amount the walk would need 5.3", () => {
      let peak = 0;
      for (let v = 0.1; v <= ROBOT.speed + 1e-9; v += 0.05) {
         const a = amountAt(v);
         const own = contactStride(a, ROBOT_LANDMARKS) * WAREHOUSE_SCALE;
         expect(strideOf(a, v), `v ${v.toFixed(2)}`).toBeCloseTo(own, 9);
         peak = Math.max(peak, v / own);
         if (v < ROBOT.carrySpeed) expect(v / own, `v ${v.toFixed(2)}`).toBeLessThan(4);
      }
      expect(peak).toBeCloseTo(4.54, 1);
      expect(WAREHOUSE_MAX_CADENCE).toBeGreaterThan(peak);
      // the old mapping's walk: 3 m/s at amount 0.5 on walkStride
      expect(3 / (walkStride(0.5, ROBOT_LANDMARKS) * WAREHOUSE_SCALE)).toBeGreaterThan(5.2);
   });
});

describe("warehouse-rush: the planted foot stays put (robot.glb's soles)", () => {
   let feet: FeetOf;
   beforeAll(async () => {
      feet = meshFeet(await rigCharacter(SHARED_ASSETS.robot));
   });

   const drive = (speedAt: (t: number) => number) => {
      const g = { phase: 0, amount: 0 };
      return (dt: number, t: number) => {
         const v = speedAt(t);
         g.amount = warehouseAmount(g.amount, v, dt);
         g.phase += warehousePhaseStep(g.amount, v, dt);
         return { phase: g.phase, amount: g.amount, speed: v };
      };
   };

   it("at steady speeds from 1 to 6 m/s (the 5 m/s carry included) its net travel per stance is under 3 % of the body's (the old cap of 4 slid it 10-23 %)", () => {
      for (const v of [1, 2.5, 4, ROBOT.carrySpeed, ROBOT.speed]) {
         const r = gaitSlide(ROBOT_LANDMARKS, WAREHOUSE_SCALE, feet, drive(() => v));
         expect(r.stances, `v ${v}`).toBeGreaterThan(4);
         expect(r.net, `v ${v}`).toBeLessThan(0.03);
      }
   });

   it("speeding up from rest at the rules' 30 m/s² to 6 m/s, under 10 % (the stride's swing grows within the first stances)", () => {
      const r = gaitSlide(ROBOT_LANDMARKS, WAREHOUSE_SCALE, feet, drive((t) => Math.min(ROBOT.speed, ROBOT.accel * t)), 0.8, 0);
      expect(r.stances).toBeGreaterThan(2);
      expect(r.net).toBeLessThan(0.1);
   });
});
