// The GLB robot's walk cycle (looks only) on the core auto-rig: walkPose's amount from the speed and
// how far its phase advances per frame. Pure, no three.js, so Scene.tsx and gait.test.ts share it
// (like robot-collector's).
import { gaitPhaseStep } from "@/arcade3d/core/rig";
import { ROBOT_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS } from "./assets";

/** The robot's scale here (its stride and its height over its feet are in GLB units x this). */
export const WAREHOUSE_SCALE = ASSETS.robot.scale ?? 1;
/**
 * The phase never advances by more than a stride this short (m): standing still, the stride is 0.
 * The robot's own stride is longer from 0.07 m/s, so the planted foot stays put down to a creep.
 */
export const WAREHOUSE_MIN_STRIDE = 0.02;
/**
 * The speed (m/s) of walkPose's full run (amount 1); slower, the amount is the speed over it. This
 * 1.2 m robot drives at up to 6 m/s: with the amount at speed / 6 (the old mapping) its short walk
 * stride needs 5.3 strides a second at 1-3 m/s. A longer stride for the speed (the run from 4 m/s)
 * keeps that at 3.0-3.8 below 5 m/s; the full run's contact stride (1.32 m) takes 4.54 strides a
 * second at the 6 m/s top, the most at any steady speed (gait.test.ts).
 */
export const WAREHOUSE_RUN_SPEED = 4;
/** A safety cap (strides a second) just above the 4.54 the gait needs at 6 m/s: it never binds at a steady speed. */
export const WAREHOUSE_MAX_CADENCE = 4.6;
/** How fast the amount eases down when the robot slows or stops (1/s). */
export const AMOUNT_EASE_DOWN = 12;

/**
 * walkPose's amount for this frame: up at once to speed / WAREHOUSE_RUN_SPEED (the rules' 30 m/s²
 * already eases the speed, so the stride is never shorter than the speed's and the cadence cap
 * never bites while speeding up), eased down at AMOUNT_EASE_DOWN.
 */
export function warehouseAmount(amount: number, speed: number, dt: number): number {
   const target = Math.min(1, Math.max(0, speed) / WAREHOUSE_RUN_SPEED);
   return target >= amount ? target : amount + (target - amount) * (1 - Math.exp(-AMOUNT_EASE_DOWN * dt));
}

/** The phase step (rad) for walkPose's `amount` at `speed` (m/s) over `dt` (s): 0 standing still. */
export function warehousePhaseStep(amount: number, speed: number, dt: number): number {
   return gaitPhaseStep(amount, ROBOT_LANDMARKS, WAREHOUSE_SCALE, speed, dt, WAREHOUSE_MAX_CADENCE, WAREHOUSE_MIN_STRIDE);
}
