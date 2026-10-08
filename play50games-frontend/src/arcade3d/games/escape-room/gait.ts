// The runner's walk cycle (looks only) on the core auto-rig: walkPose's amount from the speed and
// how far its phase advances per frame. Pure, no three.js, so Scene.tsx and gait.test.ts share it.
//
// The runner (1.40 m) walks the room at up to 1.8 m/s. It used to take the full run's pose there
// (amount = speed / 1.8) on the walk's own stride (walkStride, 1.14 m at amount 1), but a run only
// touches the floor around mid-stance, where it needs a 1.6 m stride: the planted foot slid 31-45 %
// from 1.2 m/s. A full run's planted stride at 1.8 m/s would be a slow-motion sprint (1.1 strides a
// second), so the amount now reaches the run only at RUN_SPEED: at the room's 1.8 m/s it is 0.67, a
// light jog, and the phase advances by the distance over the contact stride (core gaitPhaseStep):
// about 2 strides a second at a walk, 1.7 at the top speed, the planted foot put.
import { gaitPhaseStep } from "@/arcade3d/core/rig";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { RUNNER_SCALE } from "./assets";

/** The speed (m/s) of walkPose's full run (amount 1); slower, the amount is the speed over it. */
export const RUN_SPEED = 2.7;
/** The shortest stride (m): the runner's own is longer from 0.05 m/s. */
export const RUNNER_MIN_STRIDE = 0.02;

/** walkPose's amount the Scene eases towards at `speed` (m/s). */
export function walkAmount(speed: number): number {
   return Math.min(1, Math.max(0, speed) / RUN_SPEED);
}

/** The phase step (rad) for walkPose's `amount` at `speed` (m/s) over `dt` (s): 0 standing still. */
export function runnerPhaseStep(amount: number, speed: number, dt: number): number {
   return gaitPhaseStep(amount, RUNNER_LANDMARKS, RUNNER_SCALE, speed, dt, Infinity, RUNNER_MIN_STRIDE);
}
