// The GLB robot's walk cycle (looks only) on the core auto-rig: how far walkPose's phase advances
// per frame. Pure, no three.js, so Scene.tsx and gait.test.ts share it (like robot-collector's).
import { gaitPhaseStep } from "@/arcade3d/core/rig";
import { ROBOT_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS } from "./assets";

/** The robot's scale here (its stride and its height over its feet are in GLB units x this). */
export const WAREHOUSE_SCALE = ASSETS.robot.scale ?? 1;
/** The phase never advances by more than a stride this short (m): standing still, the stride is 0. */
export const WAREHOUSE_MIN_STRIDE = 0.1;
/**
 * The walk's own stride (core/rig walkStride x 0.7: 0.56 m at a walk, 0.94 m at full speed) keeps
 * the planted foot still, but this 1.2 m robot drives at up to 6 m/s: at the scene's walk amount
 * (speed / 6) its legs would beat 5 to 6.4 times a second. It steps at most this often (strides a
 * second); the stride stretches and the feet slide a quarter to a third of a step (README).
 */
export const WAREHOUSE_MAX_CADENCE = 4;

/** The phase step (rad) for walkPose's `amount` at `speed` (m/s) over `dt` (s): 0 standing still. */
export function warehousePhaseStep(amount: number, speed: number, dt: number): number {
   return gaitPhaseStep(amount, ROBOT_LANDMARKS, WAREHOUSE_SCALE, speed, dt, WAREHOUSE_MAX_CADENCE, WAREHOUSE_MIN_STRIDE);
}
