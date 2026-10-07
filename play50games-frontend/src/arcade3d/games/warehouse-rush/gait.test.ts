import { describe, expect, it } from "vitest";
import { walkStride } from "@/arcade3d/core/rig";
import { ROBOT_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { WAREHOUSE_MAX_CADENCE, WAREHOUSE_MIN_STRIDE, WAREHOUSE_SCALE, warehousePhaseStep } from "./gait";
import { ROBOT } from "./rules";

const TAU = Math.PI * 2;
const DT = 1 / 60;

describe("warehouse-rush robot gait", () => {
   it("does not advance while stopped or when the frame has no time", () => {
      expect(warehousePhaseStep(0, 0, DT)).toBe(0);
      expect(warehousePhaseStep(0.4, 0, DT)).toBe(0);
      expect(warehousePhaseStep(0.4, 2, 0)).toBe(0);
   });

   it("uses the measured robot stride whenever it is longer than the cadence minimum", () => {
      for (const speed of [0.5, 1, 2, 3]) {
         const step = warehousePhaseStep(1, speed, DT);
         const measuredStride = walkStride(1, ROBOT_LANDMARKS) * WAREHOUSE_SCALE;
         expect(measuredStride).toBeGreaterThan(Math.max(WAREHOUSE_MIN_STRIDE, speed / WAREHOUSE_MAX_CADENCE));
         const stride = (speed * DT * TAU) / step;
         expect(stride, `speed ${speed}`).toBeCloseTo(measuredStride, 9);
      }
   });

   it("clamps a zero-pose stride and caps the top-speed cadence", () => {
      expect(walkStride(0, ROBOT_LANDMARKS)).toBe(0);
      expect(WAREHOUSE_MIN_STRIDE).toBe(0.1);
      const shortStep = warehousePhaseStep(0, 0.01, DT);
      expect(shortStep).toBeGreaterThan(0);
      expect((0.01 * DT * TAU) / shortStep).toBeCloseTo(WAREHOUSE_MIN_STRIDE, 9);

      expect(ROBOT.speed).toBe(6);
      expect(WAREHOUSE_MAX_CADENCE).toBe(4);
      const ownCadence = ROBOT.speed / (walkStride(1, ROBOT_LANDMARKS) * WAREHOUSE_SCALE);
      expect(ownCadence).toBeGreaterThan(5);
      const cappedCadence = warehousePhaseStep(1, ROBOT.speed, DT) / TAU / DT;
      expect(cappedCadence).toBeCloseTo(WAREHOUSE_MAX_CADENCE, 9);
   });
});
