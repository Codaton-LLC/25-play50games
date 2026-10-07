// The GLB robot's walk cycle (gait.ts): the walk's own stride x 0.7 when it is the longest, at most
// WAREHOUSE_MAX_CADENCE strides a second (the cap binds at every steady speed here), still when still.
import { describe, expect, it } from "vitest";
import { walkStride } from "@/arcade3d/core/rig";
import { ROBOT_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { WAREHOUSE_MAX_CADENCE, WAREHOUSE_MIN_STRIDE, WAREHOUSE_SCALE, warehousePhaseStep } from "./gait";
import { ROBOT } from "./rules";

const TAU = Math.PI * 2;
const DT = 1 / 60;
/** Scene.tsx eases walkPose's amount towards speed / ROBOT.speed (carrying too): the steady state. */
const amountAt = (v: number) => Math.min(1, v / ROBOT.speed);
const ownStride = (amount: number) => walkStride(amount, ROBOT_LANDMARKS) * WAREHOUSE_SCALE;
const strideOf = (amount: number, v: number) => (v * DT * TAU) / warehousePhaseStep(amount, v, DT);

describe("warehouse-rush robot gait", () => {
   it("does not advance while stopped or when the frame has no time", () => {
      expect(warehousePhaseStep(0, 0, DT)).toBe(0);
      expect(warehousePhaseStep(0.4, 0, DT)).toBe(0);
      expect(warehousePhaseStep(0.4, 2, 0)).toBe(0);
   });

   it("uses the walk's own stride x the robot's scale whenever it is the longest (the planted foot stays put)", () => {
      expect(WAREHOUSE_SCALE).toBe(0.7);
      for (const v of [0.5, 1, 2, 3]) {
         expect(ownStride(1)).toBeGreaterThan(Math.max(WAREHOUSE_MIN_STRIDE, v / WAREHOUSE_MAX_CADENCE));
         expect(strideOf(1, v), `v ${v}`).toBeCloseTo(ownStride(1), 9);
      }
   });

   it("clamps a zero-pose stride and caps the top-speed cadence", () => {
      expect(walkStride(0, ROBOT_LANDMARKS)).toBe(0);
      expect(WAREHOUSE_MIN_STRIDE).toBe(0.1);
      expect(warehousePhaseStep(0, 0.01, DT)).toBeGreaterThan(0);
      expect(strideOf(0, 0.01)).toBeCloseTo(WAREHOUSE_MIN_STRIDE, 9);

      expect(ROBOT.speed).toBe(6);
      expect(WAREHOUSE_MAX_CADENCE).toBe(4);
      expect(ROBOT.speed / ownStride(1)).toBeGreaterThan(5);
      const cappedCadence = warehousePhaseStep(1, ROBOT.speed, DT) / TAU / DT;
      expect(cappedCadence).toBeCloseTo(WAREHOUSE_MAX_CADENCE, 9);
   });

   it("at the scene's steady amount the cap binds at every speed, the carry speed included: 4 strides a second, the stride at most 1.6x the walk's own", () => {
      expect(ROBOT.carrySpeed).toBe(5);
      for (const v of [0.5, 1, 2, 3, 4, ROBOT.carrySpeed, ROBOT.speed]) {
         const own = ownStride(amountAt(v));
         expect(v / own, `own cadence at v ${v}`).toBeGreaterThan(WAREHOUSE_MAX_CADENCE);
         const stride = strideOf(amountAt(v), v);
         expect(v / stride, `cadence at v ${v}`).toBeCloseTo(WAREHOUSE_MAX_CADENCE, 9);
         expect(stride / own, `stretch at v ${v}`).toBeLessThan(1.6);
      }
   });
});
