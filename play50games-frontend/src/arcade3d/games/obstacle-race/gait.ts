// The GLB runner's run cycle (looks only) on the core auto-rig: walkPose's amount from the speed and
// how far its phase advances with the ground covered on foot. Pure, no three.js, so Scene.tsx and
// gait.test.ts share it; the stand-in reads the same phase.
//
// The phase used to be the ground covered over a fixed 1.7 m stride: right for the full run at
// 6 m/s (the runner's contact stride is 1.71 m there), but the amount follows the speed and at a
// slower run or a walk the stride is shorter (0.73 m at amount 0.5), so the planted foot slid
// 23-56 % below 4.5 m/s. Now the phase advances by the ground covered over the contact stride for
// the amount (core gaitPhaseStep): the legs beat at most 4.13 strides a second (at 3 m/s, the end
// of the walk), so the planted foot stays put at every speed.
import { gaitPhaseStep } from "@/arcade3d/core/rig";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS } from "./assets";

/** The runner's scale here (its stride and its height over its feet are in GLB units x this). */
export const RUNNER_SCALE = ASSETS.runner.scale ?? 1;
/** walkPose's amount at full speed (the run) and its least while running (a walk). */
export const RUN_AMOUNT = { full: 1, least: 0.5 } as const;
/** A safety cap (strides a second) above the 4.13 the gait needs at most: it never binds at a steady speed. */
export const RUNNER_MAX_CADENCE = 5;
/** The shortest stride (m): the runner's own is longer at every running amount. */
export const RUNNER_MIN_STRIDE = 0.1;

/** walkPose's amount while running at `speed01` of V_RUN (the Scene eases towards it). */
export function runAmount(speed01: number): number {
   return RUN_AMOUNT.full * Math.max(RUN_AMOUNT.least, Math.min(1, speed01));
}

/** The phase step (rad) for `moved` m covered on foot this frame of `dt` s at walkPose's `amount`. */
export function runnerPhaseStep(amount: number, moved: number, dt: number): number {
   if (!(moved > 0)) return 0;
   // (a frame with no animation time but ground covered still steps, as if it took 1/60 s)
   const t = dt > 0 ? dt : 1 / 60;
   return gaitPhaseStep(amount, RUNNER_LANDMARKS, RUNNER_SCALE, moved / t, t, RUNNER_MAX_CADENCE, RUNNER_MIN_STRIDE);
}
