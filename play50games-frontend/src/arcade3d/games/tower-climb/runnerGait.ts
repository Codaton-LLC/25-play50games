// The runner's gait on the core auto-rig (looks only, never physics): the walk amount eased towards
// the runner's own ground speed, the walk phase advanced by its own ground motion over the walk's
// stride (so a moving slab's carry or pushing against the x bound does not run it in place), and the
// airborne blend, tuck, checkpoint cheer and facing, all eased. Pure, no three.js: Scene.tsx calls it
// once per frame from its useHumanoidPose driver, runnerGait.test.ts drives it with real rules state.
import { gaitPhaseStep, wrapPhase } from "@/arcade3d/core/rig";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { RUNNER_SCALE } from "./assets";
import { MOVING, NONE, V_RUN, slabX, type TowerRun } from "./rules";

/**
 * The walk's own stride at a full run (core walkStride, 1.53 GLB units x 0.2916 = 0.446 m: the v2
 * runner's short legs) takes 6.73 strides a second at V_RUN; while the amount eases up from a stand
 * the stride would be shorter, so the legs never beat faster than this (the feet slide for those few
 * frames instead).
 */
export const RUNNER_MAX_CADENCE = 7;
/** The arms-up cheer on a new checkpoint (run ms; a sine envelope, arms only). */
export const CHEER_MS = 600;

export interface RunnerGait {
   /** walkPose phase (rad) and amount (0 standing .. 1 running) */
   phase: number;
   amount: number;
   /** jumpPose weight (0 grounded .. 1 airborne) and its tuck */
   air: number;
   tuck: number;
   /** cheerPose weight on the arms */
   cheer: number;
   /** model yaw (rad): +pi/2 faces +x, -pi/2 faces -x, 0 the camera */
   heading: number;
   facing: number;
   /** the body's height over its lower sole this frame (m): core bodyLift x RUNNER_SCALE (Scene sets it) */
   lift: number;
   /** last frame's rules state, for the runner's own motion */
   lastX: number;
   lastMs: number;
   grounded: boolean;
}

export function createRunnerGait(): RunnerGait {
   return { phase: 0, amount: 0, air: 0, tuck: 0, cheer: 0, heading: 0, facing: 0, lift: 0, lastX: 0, lastMs: 0, grounded: true };
}

/** How far the runner's support moved it since `fromMs` (rules `carry`: a moving slab it stands on alone). */
function supportCarry(run: TowerRun, fromMs: number): number {
   if (run.contactA < 0 || run.contactB >= 0 || run.contactA % 2 !== 0) return 0;
   const slot = run.slabs[(run.contactA / 2) % 32];
   return slot.kind === MOVING ? slabX(slot, run.timeMs) - slabX(slot, fromMs) : 0;
}

const ease = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/**
 * One frame. `playing`: the run phase is "playing" (false in the countdown and after the end);
 * `dt`: this frame's visual seconds (useGameTime delta); `checkpointMs`: the run ms of the last new
 * checkpoint (NONE before the first).
 */
export function stepRunnerGait(g: RunnerGait, run: TowerRun, playing: boolean, dt: number, checkpointMs: number): void {
   const p = run.player;
   const live = playing && !run.pendingLose;
   const airborne = !p.grounded || run.pendingLose;
   // its own motion on the ground this frame: x minus the carry; 0 on the landing frame and at the bound
   const own = live && p.grounded && g.grounded ? p.x - g.lastX - supportCarry(run, g.lastMs) : 0;
   const seconds = live ? run.stepMs / 1000 : 0;
   const speed = seconds > 0 ? Math.abs(own) / seconds : 0;
   // the amount keeps its value in the air, so a runner lands running
   if (!airborne || !live) g.amount += (Math.min(1, speed / V_RUN) - g.amount) * ease(12, dt);
   g.phase = wrapPhase(g.phase + gaitPhaseStep(g.amount, RUNNER_LANDMARKS, RUNNER_SCALE, speed, seconds, RUNNER_MAX_CADENCE));
   g.air += ((airborne ? 1 : 0) - g.air) * ease(18, dt);
   // stretched at the launch and the landing, tucked near the apex; a walk-off eases into it
   const tuck = !airborne ? 0 : run.pendingLose ? 0.3 : Math.max(0, 1 - Math.abs(p.vy) / 4);
   g.tuck += (tuck - g.tuck) * ease(10, dt);
   const age = checkpointMs === NONE ? -1 : run.timeMs - checkpointMs;
   g.cheer = !airborne && age >= 0 && age < CHEER_MS ? Math.sin(age / CHEER_MS * Math.PI) : 0;
   if (live && p.vx !== 0) g.facing = p.vx > 0 ? Math.PI / 2 : -Math.PI / 2;
   // a turn swings through facing the camera
   g.heading += (g.facing - g.heading) * ease(20, dt);
   g.lastX = p.x; g.lastMs = run.timeMs; g.grounded = p.grounded;
}
