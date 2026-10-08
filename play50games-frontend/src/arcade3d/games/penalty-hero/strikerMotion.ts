// The striker's whole motion, from the run's phases: where its group stands and turns, its lean,
// and the pose its GLB is driven to (Scene.tsx draws it, strikerMotion.test.ts walks it frame by
// frame on the real mesh). Looks only: rules.ts owns every shot. Pure, no three.js, no allocation
// per frame.
//
// - aim: the idle, on its spot (the start, or as far as its walk back has got);
// - run-up: from where it stands to the ball (layout.ts strikerPlacement), one timed stride of the
//   walk, the kick's backswing in its last quarter;
// - flight: the kick's follow-through at the ball;
// - the hold, and on into the next aim: the walk back. The kick leg comes down, then the striker
//   steps back to its spot, every foot planted where it landed: each frame both legs reach for
//   their spots in the world (two-bone IK, poses.ts plantLeg), so a planted boot stays put however
//   the group moves and turns, and the swing foot is carried from one spot to the next in an arc.
//   After the last shot it only lands the kick leg and brings the other foot alongside (the run
//   ends in that hold). A shot during the walk back starts the run-up from where the striker is.
import { BONE, POSE_MASK, blendPoses, createPose, footPoint, idlePose, levelFoot, turnBone, walkPose, type HumanoidPose } from "@/arcade3d/core/rig";
import { ASSETS, STRIKER_LANDMARKS } from "./assets";
import { BACKSWING_FROM, strikerPlacement } from "./layout";
import { KICK_CONTACT, KICK_SIDE, kickPose, plantLeg } from "./poses";
import { HOLD_MS, RUNUP_MS, SHOTS, type RunState } from "./rules";

/** The striker's lean into the run-up (rad): the stand-in's whole body, the GLB's spine. */
export const RUNUP_LEAN = 0.22;
/** The kick's extra lean (rad) over the flight's first KICK_LEAN_MS. */
export const KICK_LEAN = 0.12;
const KICK_LEAN_MS = 200;
/** The GLB striker's run-up: one stride of walkPose over the 700 ms, the kick's backswing in its last quarter (layout.ts BACKSWING_FROM)... */
const RUNUP_STRIDES = 1;
/** ...contact at poses.ts KICK_CONTACT as the flight starts, the follow-through over this long. */
const KICK_MS = 150;
/** Scene.tsx eases the drawn pose towards strikerPose's target at this rate (1/s), so a phase change never pops (the planted legs excepted). */
export const POSE_EASE = 25;

/**
 * The walk back (ms from the hold's start; metres): the kick leg lands over `landMs`, then `steps`
 * steps of `stepMs` each, starting with the planted foot; the group moves back to its spot over all
 * but the last one (that one brings the trailing foot alongside), at an even pace after a ramp of
 * `ramp` of the move at each end. The swing foot lifts `lift`, the body walks `dip` lower (GLB
 * units: the planted leg's reach). After the last shot: the landing and one closing step of
 * `closeMs`, inside the hold.
 */
export const STRIKER_RETURN = { landMs: 220, stepMs: 250, steps: 4, ramp: 0.25, lift: 0.07, dip: 0.04, closeMs: 160 } as const;

/** The walk back's end (ms from the hold's start): to the start spot, or (`stay`) at the ball after the last shot. */
export function returnEndMs(stay: boolean): number {
   const r = STRIKER_RETURN;
   return r.landMs + (stay ? r.closeMs : r.steps * r.stepMs);
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
   const t = clamp01(v);
   return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** The group's move back (0 -> 1) over `x` 0..1: an even pace between two ramps (a trapezoid of speeds, C1). */
function movedBack(x: number): number {
   const r = STRIKER_RETURN.ramp;
   const t = clamp01(x);
   const top = 1 / (1 - r);
   if (t < r) return (top * t * t) / (2 * r);
   if (t > 1 - r) return 1 - (top * (1 - t) * (1 - t)) / (2 * r);
   return top * (t - r / 2);
}

/** The run-up progress (0 = the start spot, 1 = at the ball) of the walk back `tau` ms into the hold. */
export function returnProgress(tau: number, stay: boolean): number {
   if (stay) return 1;
   const r = STRIKER_RETURN;
   const moveMs = (r.steps - 1) * r.stepMs;
   return 1 - movedBack((tau - r.landMs) / moveMs);
}

export interface StrikerFrame {
   /** the group's place (m) and turn (rad) */
   x: number;
   z: number;
   yaw: number;
   /** the run-up's lean share 0..1 (RUNUP_LEAN) and the kick's 0..1 (KICK_LEAN) */
   lean: number;
   kick: number;
   /** the stand-in's bob share 0..1 (its stride, its steps back) */
   bob: number;
   /** "idle" on a spot, "runup", "flight", or "return" (the walk back, `tau` ms into the hold; `stay`: after the last shot) */
   mode: "idle" | "runup" | "flight" | "return";
   tau: number;
   stay: boolean;
   /** where the run-up started (0 = the start spot) */
   from: number;
}

export function createStrikerFrame(): StrikerFrame {
   return { x: 0, z: 0, yaw: 0, lean: 0, kick: 0, bob: 0, mode: "idle", tau: 0, stay: false, from: 0 };
}

/** The walk back of the previous shot is under way through this aim (and the run-up after it): ms into its hold, or -1. */
function previousReturnMs(run: RunState): number {
   if (run.shotsDone === 0 || run.lastResult === "timeout" || run.lastResult === "none") return -1;
   // run.aimMs: this aim's time so far (rules.ts resets it as the aim starts, never in the run-up)
   return HOLD_MS + run.aimMs;
}

/** The striker's frame from the run: its mode, place, turn, lean and bob, into `out`. */
export function strikerFrame(run: RunState, out: StrikerFrame): StrikerFrame {
   const shot = run.pending.kind === "shot";
   let e = 0;
   out.lean = 0;
   out.kick = 0;
   out.bob = 0;
   out.stay = false;
   out.tau = 0;
   out.from = 0;
   if (shot && (run.phase === "runup" || run.phase === "flight")) {
      const back = previousReturnMs(run);
      out.from = back >= 0 ? returnProgress(back, false) : 0;
   }
   if (shot && run.phase === "runup") {
      const u = run.phaseMs / RUNUP_MS;
      out.mode = "runup";
      e = lerp(out.from, 1, smooth(u));
      out.lean = smooth(u);
      out.bob = Math.abs(Math.sin(u * Math.PI * 3));
   } else if (shot && run.phase === "flight") {
      out.mode = "flight";
      e = 1;
      out.lean = 1;
      out.kick = Math.sin(Math.PI * clamp01(run.phaseMs / KICK_LEAN_MS));
   } else {
      // the walk back: through this shot's hold, or the previous shot's on into this aim
      let tau = -1;
      if (shot && run.phase === "hold") {
         tau = run.phaseMs;
         // the hold of the last shot (rules.ts counts it done as the hold ends): the run ends there
         out.stay = run.shotsDone >= SHOTS - 1;
      } else if (run.phase === "aim") tau = previousReturnMs(run);
      if (tau >= 0 && tau < returnEndMs(out.stay)) {
         out.mode = "return";
         out.tau = tau;
         e = returnProgress(tau, out.stay);
         out.lean = 1 - smooth(tau / HOLD_MS);
         const r = STRIKER_RETURN;
         if (tau > r.landMs) out.bob = Math.abs(Math.sin((Math.PI * (tau - r.landMs)) / (out.stay ? r.closeMs : r.stepMs)));
      } else {
         out.mode = "idle";
         e = tau >= 0 && out.stay ? 1 : 0;
      }
   }
   strikerPlacement(e, out);
   return out;
}

// ---------- the walk back's feet ----------

const L = STRIKER_LANDMARKS;
const SCALE = ASSETS.striker.scale;
const TURN = ASSETS.striker.rotationY;
const PLANT_SIDE: 1 | -1 = KICK_SIDE > 0 ? -1 : 1;
const THIGH = L.hipY - L.kneeY;
const SHIN = L.kneeY - L.ankleY;

/** The kick's end (kickPose 1, at the ball): its feet in the striker's frame, unlifted (GLB units). */
interface KickEnd {
   /** the planted foot's ankle (x, z), the kicking foot's ankle (x, z) */
   plantX: number;
   plantZ: number;
   kickX: number;
   kickZ: number;
   /** the planted sole's height (the body's lowering), the kicking ankle's height over the planted one */
   dip: number;
   air: number;
}

let kickEnd: KickEnd | null = null;

function kickEndOf(): KickEnd {
   if (kickEnd) return kickEnd;
   const pose = kickPose(1, createPose());
   const plant = footPoint(pose, L, PLANT_SIDE);
   const kick = footPoint(pose, L, KICK_SIDE);
   kickEnd = { plantX: plant[0], plantZ: plant[2], kickX: kick[0], kickZ: kick[2], dip: plant[3], air: kick[1] - plant[1] };
   return kickEnd;
}

const PLACE = { x: 0, z: 0, yaw: 0 };

/** A point of the striker's frame (GLB units) at run-up progress `e`, in the world (m), into `out` [x, z]. */
function toWorld(e: number, lx: number, lz: number, out: Float64Array, at = 0): void {
   strikerPlacement(e, PLACE);
   const turn = TURN + PLACE.yaw;
   const c = Math.cos(turn);
   const s = Math.sin(turn);
   out[at] = PLACE.x + SCALE * (lx * c + lz * s);
   out[at + 1] = PLACE.z + SCALE * (-lx * s + lz * c);
}

/** A foot's place under its hip (the idle's) at run-up progress `e`, in the world. */
function homeOf(side: number, e: number, out: Float64Array, at = 0): void {
   toWorld(e, side * L.hipX, L.hipZ, out, at);
}

// the step under way: where its swing foot took off (FROM) and lands (SPOT), where the other foot stands (STILL); world m
const FROM = new Float64Array(2);
const SPOT = new Float64Array(2);
const STILL = new Float64Array(2);
const FOOT = new Float64Array(2);

/** The side that swings in step `k` (0: the kick leg lands; then the planted foot first). */
const sideOf = (k: number) => (k % 2 === 0 ? KICK_SIDE : PLANT_SIDE);

/** Step `k`'s end (ms into the hold). */
function stepEnd(k: number, stay: boolean): number {
   const r = STRIKER_RETURN;
   if (k === 0) return r.landMs;
   return r.landMs + (stay ? r.closeMs : k * r.stepMs);
}

/** Where step `k` lands (world m), into `out`: its foot under its hip as it will be in the middle of its time on the ground. */
function landingOf(k: number, stay: boolean, out: Float64Array, at = 0): void {
   const r = STRIKER_RETURN;
   const end = stepEnd(k, stay);
   homeOf(sideOf(k), returnProgress(end + r.stepMs / 2, stay), out, at);
}

/** Where step `k`'s foot stood before it (world m), into `out`. */
function takeOffOf(k: number, stay: boolean, out: Float64Array, at = 0): void {
   if (k >= 2) return landingOf(k - 2, stay, out, at);
   const kick = kickEndOf();
   if (k === 1) toWorld(1, kick.plantX, kick.plantZ, out, at);
   else toWorld(1, kick.kickX, kick.kickZ, out, at);
}

/** One leg reaching for the world point (x, z) at height `y` over the floor (GLB units, unlifted), its foot level by `level`. */
function reach(out: HumanoidPose, side: number, x: number, z: number, y: number, level: number, place: { x: number; z: number; yaw: number }): void {
   const turn = TURN + place.yaw;
   const c = Math.cos(turn);
   const s = Math.sin(turn);
   const dx = x - place.x;
   const dz = z - place.z;
   const lx = (dx * c - dz * s) / SCALE;
   const lz = (dx * s + dz * c) / SCALE;
   plantLeg(out, side, lx - side * L.hipX, y - L.hipY, lz - L.hipZ, THIGH, SHIN);
   levelFoot(out, side, level);
}

/**
 * The walk back's legs `tau` ms into the hold (`stay`: after the last shot), for the group at `place`
 * (strikerFrame's): both legs reach for their feet's spots, the body `dip` lower so the planted leg
 * reaches; standing on the lower sole (ground 1). The rest of `out` is kept.
 */
export function returnLegs(tau: number, stay: boolean, place: { x: number; z: number; yaw: number }, out: HumanoidPose): HumanoidPose {
   const r = STRIKER_RETURN;
   const kick = kickEndOf();
   const last = stay ? 1 : r.steps;
   // the step under way (the last one's end holds the feet where they finished)
   let k = 0;
   while (k < last && tau >= stepEnd(k, stay)) k++;
   const start = k === 0 ? 0 : stepEnd(k - 1, stay);
   const s = clamp01((tau - start) / (stepEnd(k, stay) - start));
   const e = smooth(s);
   // the body's lowering: from the kick's into the walk's, and out of it as the feet come together
   let dip: number = r.dip;
   if (k === 0) dip = lerp(kick.dip, r.dip, e);
   else if (k === last) dip = lerp(r.dip, 0, e);
   takeOffOf(k, stay, FROM);
   landingOf(k, stay, SPOT);
   if (k === 0) toWorld(1, kick.plantX, kick.plantZ, STILL);
   else landingOf(k - 1, stay, STILL);
   const swing = sideOf(k);
   // the swing foot: the kick leg comes down from its follow-through, a step lifts in an arc
   const height = k === 0 ? kick.air * (1 - e) : (r.lift / SCALE) * Math.sin(Math.PI * s);
   FOOT[0] = lerp(FROM[0], SPOT[0], e);
   FOOT[1] = lerp(FROM[1], SPOT[1], e);
   reach(out, swing, FOOT[0], FOOT[1], L.ankleY + dip + height, k === 0 ? lerp(0.7, 1, e) : 1, place);
   reach(out, -swing, STILL[0], STILL[1], L.ankleY + dip, 1, place);
   out.ground = 1;
   out.lift = 0;
   return out;
}

/**
 * The striker's pose target for `frame` (strikerFrame's) at game time `now` (s), into `out`
 * (`scratch`: a second pose). Returns true when its legs are planted (the walk back, the idle):
 * Scene.tsx then draws them exactly, never eased, so a planted foot never lags its spot.
 */
export function strikerPose(run: RunState, frame: StrikerFrame, now: number, out: HumanoidPose, scratch: HumanoidPose): boolean {
   let planted = true;
   if (frame.mode === "runup") {
      const u = run.phaseMs / RUNUP_MS;
      if (u < BACKSWING_FROM) walkPose(u * RUNUP_STRIDES * Math.PI * 2, 0.35 + 0.6 * u, out);
      else kickPose((KICK_CONTACT * (u - BACKSWING_FROM)) / (1 - BACKSWING_FROM), out);
      planted = false;
   } else if (frame.mode === "flight") {
      kickPose(KICK_CONTACT + (1 - KICK_CONTACT) * clamp01(run.phaseMs / KICK_MS), out);
      planted = false;
   } else if (frame.mode === "return") {
      // the kick's follow-through into the idle over the hold, the legs walking back
      if (frame.tau < HOLD_MS) blendPoses(kickPose(1, out), idlePose(now, scratch), smooth(frame.tau / HOLD_MS), out);
      else idlePose(now, out);
      returnLegs(frame.tau, frame.stay, frame, out);
   } else {
      idlePose(now, out);
   }
   // the run-up's lean (and the kick's) is the spine's: a whole-body lean would tip the soles into the grass
   turnBone(out, BONE.spine, RUNUP_LEAN * frame.lean + KICK_LEAN * frame.kick, 0, 0);
   return planted;
}

/**
 * The drawn pose, every frame (Scene.tsx): `pose` eased towards strikerPose's `target` at POSE_EASE
 * over `delta` s, so a phase change never pops, and its legs set to the target's when `planted` (an
 * eased leg would lag its spot and slide the boot).
 */
export function drawStrikerPose(pose: HumanoidPose, target: HumanoidPose, planted: boolean, delta: number): HumanoidPose {
   blendPoses(pose, target, 1 - Math.exp(-POSE_EASE * delta), pose);
   if (planted) blendPoses(pose, target, 1, pose, POSE_MASK.legs);
   return pose;
}
