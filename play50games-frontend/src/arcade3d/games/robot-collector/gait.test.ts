// The GLB robot's walk cycle (gait.ts): the walk's own stride at walking speeds (the planted foot
// stays put), at most ROBOT_MAX_CADENCE strides a second at the 5 m/s top speed, still when still.
import { describe, expect, it } from "vitest";
import { walkStride } from "@/arcade3d/core/rig";
import { ROBOT_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ROBOT_MAX_CADENCE, ROBOT_SCALE, robotPhaseStep } from "./gait";
import { ROBOT } from "./rules";

const TAU = Math.PI * 2;
const DT = 1 / 60;
/** Scene.tsx eases walkPose's amount towards speed / ROBOT.maxSpeed: the steady state. */
const amountAt = (v: number) => Math.min(1, v / ROBOT.maxSpeed);

describe("robot-collector robotPhaseStep", () => {
   it("standing still (or for no time) the phase does not advance", () => {
      expect(robotPhaseStep(0, 0, DT)).toBe(0);
      expect(robotPhaseStep(0.4, 0, DT)).toBe(0);
      expect(robotPhaseStep(0.4, 2, 0)).toBe(0);
   });

   it("at walking speeds (up to 2.5 m/s) the stride is the walk's own x the robot's scale, so the planted foot stays put", () => {
      for (const v of [0.5, 1, 1.5, 2, 2.5]) {
         const stride = (v * DT * TAU) / robotPhaseStep(amountAt(v), v, DT);
         expect(stride, `v ${v}`).toBeCloseTo(walkStride(amountAt(v), ROBOT_LANDMARKS) * ROBOT_SCALE, 9);
      }
   });

   it("at the 5 m/s top speed the legs beat at most ROBOT_MAX_CADENCE (4) strides a second, not the 4.5 the walk's own stride would need", () => {
      expect(ROBOT.maxSpeed).toBe(5);
      expect(ROBOT_MAX_CADENCE).toBe(4);
      const own = ROBOT.maxSpeed / (walkStride(1, ROBOT_LANDMARKS) * ROBOT_SCALE);
      expect(own).toBeGreaterThan(4.3);
      const cadence = robotPhaseStep(1, ROBOT.maxSpeed, DT) / TAU / DT;
      expect(cadence).toBeCloseTo(ROBOT_MAX_CADENCE, 9);
   });
});
