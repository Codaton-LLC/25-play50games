// The cleaner's walk cycle (looks only) on the core auto-rig: walkPose's amount from the speed and
// how far its phase advances per frame. Pure, no three.js, so Scene.tsx and gait.test.ts /
// cleaner.test.ts share it.
//
// The planted foot stays put at every speed the rules allow, in straight-line travel (README "The cleaner"):
// - The phase advances by the distance over the stride (core gaitPhaseStep), core contactStride with
//   the cleaner's landmarks x its scale. At a walk (amount up to 0.54) that is the walk's own stride
//   (walkStride): the foot is planted from its forward reach to its backward reach, half the cycle.
//   From 0.55 the walk becomes a run with a flight: a foot touches the floor only around mid-stance
//   (37 % of the cycle at 0.55, 9 % at 1), where the ankle sweeps back faster than walkStride's
//   average, so the stride that keeps it still there is longer (x1.15 at 0.55, x1.42 at 1;
//   gait.test.ts recomputes it from core footPoint + bodyLift). Plain walkStride would make the
//   planted foot skid backwards at a run (27-47 % of the ground covered, 3-5 u/s). (This game's own
//   RUN_STRIDE table measured that first; core contactStride replaced it on 2026-10-08.)
// - The amount follows the speed up at once (min(1, v / RUNNER.speed): the rules' acceleration,
//   24 u/s², already eases the speed, at most 0.08 of amount a 60 fps frame) and eases down (a stop
//   against a bench takes one frame). So the stride is never shorter than the one for that speed,
//   and neither clamp of gaitPhaseStep bites: the legs beat at most about 5 strides a second
//   (4.24 at 5 u/s), under CLEANER_MAX_CADENCE, and the stride is the walk's own from 0.05 u/s
//   (CLEANER_MIN_STRIDE), where the legs barely move.
// - While playing, the phase steps by the play time the rules moved the runner (gaitFrameDt: core
//   playedFrameDt, at most 1/20 s), not the animation clock's (up to 0.1 s): on a long frame the
//   legs cover exactly the ground the body did.
// Measured on the real soles (cleaner.test.ts), straight-line travel: the planted sole's net travel
// from touch-down to lift-off is 3-6 % of the ground the body covers in a stance, at every speed
// and from rest. At a walk it is not still within the stance: it rocks about 1-1.5 cm forward and
// then 1.5-2.5 cm back (the walk's thigh sweeps unevenly, under 1 CSS px at the game camera); at a
// run it moves under 3 mm. While the cleaner turns the planted foot swings with the body about its
// centre (README "The cleaner"). The runner it replaced stepped at most 4 times a second over
// walkStride: its planted sole slid 23-24 % at a walk, 11-12 % at a run and 33-38 % while speeding up.
import { playedFrameDt } from "@/arcade3d/core/frameLoop";
import { gaitPhaseStep, wrapPhase } from "@/arcade3d/core/rig";
import { ASSETS, CLEANER_LANDMARKS } from "./assets";
import { RUNNER } from "./rules";

/** The cleaner's scale here (its stride and its lift over its feet are in GLB units x this). */
export const CLEANER_SCALE = ASSETS.cleaner.scale ?? 1;
/** A safety cap (strides a second) above the 5.02 the gait needs at most (2.7 u/s): it never binds (gait.test.ts). */
export const CLEANER_MAX_CADENCE = 5.5;
/** The shortest stride (m): the walk's own from 0.05 u/s (standing still the stride is 0). */
export const CLEANER_MIN_STRIDE = 0.005;
/** How fast the amount eases down when the cleaner slows or stops (1/s). */
export const AMOUNT_EASE_DOWN = 12;

export interface CleanerGait {
   /** walkPose's phase (rad, wrapped) */
   phase: number;
   /** walkPose's amount: 0 standing, 1 the run at top speed */
   amount: number;
   /** bodyLift x scale of the last pose (world units): what Scene raises the cleaner's group by */
   lift: number;
}

export function createCleanerGait(): CleanerGait {
   return { phase: 0, amount: 0, lift: 0 };
}

/** The phase step (rad) for walkPose's `amount` at `speed` (u/s) over `dt` (s): 0 standing still. */
export function cleanerPhaseStep(amount: number, speed: number, dt: number): number {
   return gaitPhaseStep(amount, CLEANER_LANDMARKS, CLEANER_SCALE, speed, dt, CLEANER_MAX_CADENCE, CLEANER_MIN_STRIDE);
}

/**
 * The time (s) the gait steps by this frame. While playing: the play time the run clock counted
 * (core playedFrameDt, what useRunFrame handed the rules, at most 1/20 s), so the phase advances by
 * the ground the rules really moved the runner. Otherwise the animation clock's `animDelta`
 * (useGameTime's delta: 0 while paused), so the amount still eases down after the end.
 */
export function gaitFrameDt(state: Parameters<typeof playedFrameDt>[0], animDelta: number): number {
   return state.phase === "playing" ? playedFrameDt(state) : animDelta;
}

/** One frame of the gait at the cleaner's speed `speed` (u/s, this frame's) over `dt` (s). Allocation-free. */
export function stepCleanerGait(gait: CleanerGait, speed: number, dt: number): CleanerGait {
   const target = Math.min(1, Math.max(0, speed) / RUNNER.speed);
   gait.amount = target >= gait.amount ? target : gait.amount + (target - gait.amount) * (1 - Math.exp(-AMOUNT_EASE_DOWN * dt));
   gait.phase = wrapPhase(gait.phase + cleanerPhaseStep(gait.amount, speed, dt));
   return gait;
}
