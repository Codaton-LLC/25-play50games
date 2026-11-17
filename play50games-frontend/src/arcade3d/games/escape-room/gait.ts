// The runner's walk cycle (looks only) on the core auto-rig: walkPose's amount from the speed and how
// far its phase advances per frame. Pure, no three.js, so Scene.tsx and gait.test.ts share it.
//
// The planted foot stays put at every speed the rules allow (up to RUNNER.speed, 2.6 m/s), in
// straight-line travel:
// - The phase advances by the distance over the stride (core gaitPhaseStep). At a walk (amount up to
//   0.53, about 1.4 m/s) the stride is the walk's own, core walkStride x RUNNER_SCALE. From about 0.54
//   the walk becomes a run with a flight: a foot touches the floor only around mid-stance (39 % of the
//   cycle at 0.55, 9 % at 1), where the ankle sweeps back faster than walkStride's average, so the
//   stride that keeps it still is longer: RUN_STRIDE (x1.14 at 0.55, x1.41 at 1, measured on
//   RUNNER_LANDMARKS; gait.test.ts recomputes it). Plain walkStride made the planted foot skid at the
//   run (the 1.8 m/s runner already ran at amount 1).
// - The amount eases towards the speed (fast up, slower down). Following it up at once (as clean-city
//   does) skidded the planted foot while speeding up through the walk-to-run switch (about 1.4 m/s),
//   where walkPose changes shape quickly with the amount.
// - While playing, the phase steps by the play time the rules moved the runner (core playedFrameDt),
//   not the animation clock's, so on a long frame the legs cover exactly the ground the body did.
// The same approach as clean-city's gait.ts (its cleaner), with the shared runner's own measurements.
import { playedFrameDt } from "@/arcade3d/core/frameLoop";
import { gaitPhaseStep, wrapPhase } from "@/arcade3d/core/rig";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { RUNNER_SCALE } from "./assets";
import { RUNNER } from "./rules";

/** The shortest stride (m): the walk's own from about 0.05 m/s (standing still the stride is 0). */
export const RUNNER_MIN_STRIDE = 0.005;
/** How fast the amount eases up towards the speed (1/s): fast, but a jump straight to the target changed the pose under a planted foot through the walk-to-run switch (gait.test.ts). */
export const AMOUNT_EASE_UP = 30;
/** How fast the amount eases down when the runner slows or stops (1/s). */
export const AMOUNT_EASE_DOWN = 12;

/**
 * walkPose's amount -> the stride that keeps the planted foot still while it touches the floor, over
 * walkStride (RUNNER_LANDMARKS; linear in between). 1 for the walk. gait.test.ts measures each entry.
 */
export const RUN_STRIDE: ReadonlyArray<readonly [amount: number, factor: number]> = [
   [0.53, 1],
   [0.54, 1.019],
   [0.545, 1.098],
   [0.55, 1.144],
   [0.56, 1.179],
   [0.58, 1.208],
   [0.6, 1.226],
   [0.65, 1.262],
   [0.7, 1.298],
   [0.75, 1.334],
   [0.8, 1.365],
   [0.85, 1.388],
   [0.9, 1.4],
   [0.95, 1.404],
   [1, 1.41],
];

/** RUN_STRIDE at `amount` (1 below the table, its last entry above). */
export function runStrideFactor(amount: number): number {
   if (amount <= RUN_STRIDE[0][0]) return RUN_STRIDE[0][1];
   for (let i = 1; i < RUN_STRIDE.length; i++) {
      const [a1, f1] = RUN_STRIDE[i];
      if (amount <= a1) {
         const [a0, f0] = RUN_STRIDE[i - 1];
         return f0 + ((f1 - f0) * (amount - a0)) / (a1 - a0);
      }
   }
   return RUN_STRIDE[RUN_STRIDE.length - 1][1];
}

export interface RunnerGait {
   /** walkPose's phase (rad, wrapped) */
   phase: number;
   /** walkPose's amount: 0 standing, 1 the run at top speed */
   amount: number;
}

export function createRunnerGait(): RunnerGait {
   return { phase: 0, amount: 0 };
}

/** The phase step (rad) for walkPose's `amount` at `speed` (m/s) over `dt` (s): 0 standing still. */
export function runnerPhaseStep(amount: number, speed: number, dt: number): number {
   return gaitPhaseStep(amount, RUNNER_LANDMARKS, RUNNER_SCALE * runStrideFactor(amount), speed, dt, Infinity, RUNNER_MIN_STRIDE);
}

/** While playing the play time the run clock counted (what the rules moved the runner by), else `animDelta`. */
export function gaitFrameDt(state: Parameters<typeof playedFrameDt>[0], animDelta: number): number {
   return state.phase === "playing" ? playedFrameDt(state) : animDelta;
}

/** One frame of the gait at the runner's speed `speed` (m/s) over `dt` (s). Allocation-free. */
export function stepRunnerGait(gait: RunnerGait, speed: number, dt: number): RunnerGait {
   const target = Math.min(1, Math.max(0, speed) / RUNNER.speed);
   const rate = target >= gait.amount ? AMOUNT_EASE_UP : AMOUNT_EASE_DOWN;
   gait.amount += (target - gait.amount) * (1 - Math.exp(-rate * dt));
   gait.phase = wrapPhase(gait.phase + runnerPhaseStep(gait.amount, speed, dt));
   return gait;
}
