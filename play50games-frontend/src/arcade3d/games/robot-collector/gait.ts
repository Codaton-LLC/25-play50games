// The GLB robot's walk cycle (looks only) on the core auto-rig: how far walkPose's phase advances
// per frame. Pure, no three.js, so Scene.tsx and gait.test.ts share it.
import { gaitPhaseStep } from "@/arcade3d/core/rig";
import { ROBOT_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS } from "./assets";

/** The robot's scale here (its stride and its height over its feet are in GLB units x this). */
export const ROBOT_SCALE = ASSETS.robot.scale ?? 1;
/** The phase never advances by more than a stride this short (m): standing still, the stride is 0. */
export const ROBOT_MIN_STRIDE = 0.1;
/**
 * The walk's own stride (core/rig walkStride, 1.1 m at full speed for this 1.4 m robot) keeps the
 * planted foot still, but at 5 m/s its legs would beat 4.5 times a second: it steps at most this
 * often (strides a second); faster, the stride stretches and the feet slide a little (README).
 */
export const ROBOT_MAX_CADENCE = 4;

/** The phase step (rad) for walkPose's `amount` at `speed` (m/s) over `dt` (s): 0 standing still. */
export function robotPhaseStep(amount: number, speed: number, dt: number): number {
   return gaitPhaseStep(amount, ROBOT_LANDMARKS, ROBOT_SCALE, speed, dt, ROBOT_MAX_CADENCE, ROBOT_MIN_STRIDE);
}
