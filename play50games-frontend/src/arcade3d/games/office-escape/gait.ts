// The GLB runner's run cycle (looks only) on the core auto-rig: walkPose's amount and how far its
// phase advances with the ground covered. Pure, no three.js, so Scene.tsx and gait.test.ts share it.
//
// The stand-in used to set the phase from a fixed 2.4 m stride (distance / 2.4 m), against the
// runner's own contact stride of 1.6-1.78 m (core contactStride x 0.825 at amount 0.85-1): its
// planted foot slid 24-36 % of the ground covered. Now the phase advances by the ground covered
// over the contact stride (core gaitPhaseStep), so the planted foot stays put; the stand-in reads
// the same phase.
// - The amount is the full run's (1) at every running speed, the longest stride walkPose has: at
//   the 8 m/s start it takes 4.5 strides a second.
// - The run speeds up to 16 m/s, where even that stride would need 9 strides a second, a blur of
//   legs. The legs beat at most RUNNER_MAX_CADENCE: planted up to 12.4 m/s (the first 100 s of a
//   run), above that the stride stretches and the foot slides up to 22 % at 16 m/s (it slid 24-36 %
//   everywhere before). The chase camera looks along the run, where a slide shows least.
import { gaitPhaseStep, wrapPhase } from "@/arcade3d/core/rig";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS } from "./assets";

/** The runner's scale here (its stride and its height over its feet are in GLB units x this). */
export const RUNNER_SCALE = ASSETS.runner.scale ?? 1;
/** walkPose's amount while running: the full run, the longest stride. */
export const RUN_AMOUNT = 1;
/** The legs beat at most this often (strides a second): the stride stretches above 12.4 m/s. */
export const RUNNER_MAX_CADENCE = 7;
/** How fast the amount eases towards the run or the stand (1/s). */
export const AMOUNT_EASE = 10;

export interface RunnerGait {
   /** walkPose's phase (rad, wrapped) and amount */
   phase: number;
   amount: number;
   /** the run's distance (mm) at the last step */
   distance: number;
}

export function createRunnerGait(): RunnerGait {
   return { phase: 0, amount: 0, distance: 0 };
}

/**
 * One frame: the amount eases towards the run while `moving` (towards standing otherwise) over
 * `dt` s, and the phase advances by the ground covered since the last frame (`distance`, the run's
 * mm, which only grows) over the contact stride. A new run (the distance back to 0) steps nothing.
 */
export function stepRunnerGait(g: RunnerGait, distance: number, moving: boolean, dt: number): RunnerGait {
   g.amount += ((moving ? RUN_AMOUNT : 0) - g.amount) * (1 - Math.exp(-AMOUNT_EASE * dt));
   const metres = Math.max(0, distance - g.distance) / 1000;
   g.distance = distance;
   // (a frame with no animation time but ground covered still steps, as if it took 1/60 s)
   const t = dt > 0 ? dt : 1 / 60;
   if (metres > 0) g.phase = wrapPhase(g.phase + gaitPhaseStep(g.amount, RUNNER_LANDMARKS, RUNNER_SCALE, metres / t, t, RUNNER_MAX_CADENCE));
   return g;
}
