// The GLB robot's walk cycle (looks only) on the core auto-rig: walkPose's amount from the speed and
// how far its phase advances per frame. Pure, no three.js, so Scene.tsx and gait.test.ts share it.
import { gaitPhaseStep } from "@/arcade3d/core/rig";
import { ROBOT_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS } from "./assets";
import { ROBOT } from "./rules";

/** The robot's scale here (its stride and its height over its feet are in GLB units x this). */
export const ROBOT_SCALE = ASSETS.robot.scale ?? 1;
/**
 * The phase never advances by more than a stride this short (m): standing still, the stride is 0.
 * The robot's own stride is longer from 0.08 m/s, so the planted foot stays put down to a creep.
 */
export const ROBOT_MIN_STRIDE = 0.02;
/**
 * The stride is the one the planted foot needs while it touches the floor (core contactStride: the
 * walk's own, 1.55 m at the full run for this 1.4 m robot), so the legs beat at most 3.8 strides a
 * second at any steady speed (at 2.5 m/s, the end of the walk; 3.2 at the 5 m/s top). This cap is a
 * safety above that: it never binds at a steady speed (gait.test.ts).
 */
export const ROBOT_MAX_CADENCE = 4;
/** How fast the amount eases down when the robot slows or stops (1/s). */
export const AMOUNT_EASE_DOWN = 12;

/**
 * walkPose's amount for this frame: up at once to speed / ROBOT.maxSpeed (the rules' 24 m/s²
 * already eases the speed, so the stride is never shorter than the speed's and the cadence cap never
 * bites while speeding up), eased down at AMOUNT_EASE_DOWN (a stop against a wall is one frame).
 */
export function robotAmount(amount: number, speed: number, dt: number): number {
   const target = Math.min(1, Math.max(0, speed) / ROBOT.maxSpeed);
   return target >= amount ? target : amount + (target - amount) * (1 - Math.exp(-AMOUNT_EASE_DOWN * dt));
}

/** The phase step (rad) for walkPose's `amount` at `speed` (m/s) over `dt` (s): 0 standing still. */
export function robotPhaseStep(amount: number, speed: number, dt: number): number {
   return gaitPhaseStep(amount, ROBOT_LANDMARKS, ROBOT_SCALE, speed, dt, ROBOT_MAX_CADENCE, ROBOT_MIN_STRIDE);
}
