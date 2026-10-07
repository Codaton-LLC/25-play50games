// Warehouse Rush's GLB robot gait: delegate its phase step to the shared, measured auto-rig helper.
import { gaitPhaseStep } from "@/arcade3d/core/rig";
import { ROBOT_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS } from "./assets";

/** The robot's measured stride and height are in GLB units times this scale. */
export const WAREHOUSE_SCALE = ASSETS.robot.scale ?? 1;
/** The shortest allowed stride, in metres, when the robot pose is nearly still. */
export const WAREHOUSE_MIN_STRIDE = 0.1;
/** Maximum gait cycles per second; faster movement stretches the stride and permits some foot slide. */
export const WAREHOUSE_MAX_CADENCE = 4;

/** Phase step (radians) for this pose, speed (m/s), and frame duration (s). */
export function warehousePhaseStep(amount: number, speed: number, dt: number): number {
   return gaitPhaseStep(amount, ROBOT_LANDMARKS, WAREHOUSE_SCALE, speed, dt, WAREHOUSE_MAX_CADENCE, WAREHOUSE_MIN_STRIDE);
}
