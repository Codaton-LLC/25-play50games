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
import { BONE, POSE_MASK, blendPoses, contactStride, createPose, footPoint, idlePose, levelFoot, turnBone, walkPose, wrapPhase, type HumanoidPose } from "@/arcade3d/core/rig";
import { ASSETS, STRIKER_LANDMARKS } from "./assets";
import { BACKSWING_FROM, RUNUP, strikerPlacement } from "./layout";
import { KICK_CONTACT, KICK_SIDE, kickPose, plantLeg } from "./poses";
import { HOLD_MS, RUNUP_MS, SHOTS, type RunState } from "./rules";

/** The striker's lean into the run-up (rad): the stand-in's whole body, the GLB's spine. */
export const RUNUP_LEAN = 0.22;
/** The kick's extra lean (rad) over the flight's first KICK_LEAN_MS. */
export const KICK_LEAN = 0.12;
const KICK_LEAN_MS = 200;
/**
 * The GLB striker's run-up: a walk (walkPose, its amount from 0.35 to 0.54: the run-up is 0.72 m in
 * 0.7 s, a walking pace) until the kick's backswing in its last quarter (layout.ts BACKSWING_FROM).
 * Its phase is the ground the group has covered over the walk's stride (core contactStride) from
 * RUNUP_START_PHASE, and the stance foot is pinned where it landed, so the planted foot stays put
 * however the run-up eases in and out (a timed stride slid the boots 31 cm, the backswing 15 more).
 */
export const runupAmount = (u: number) => 0.35 + 0.25 * u;
/** The run-up's legs grow out of the idle's over this share of it (the stance foot pinned meanwhile). */
const RUNUP_INTO_WALK = 0.15;
/**
 * walkPose's phase as the run-up starts: the left foot under the hip (mid-stance, where the idle has
 * it), the right leg swinging first. About 0.7 strides later the backswing starts with the left foot
 * landing in front and the kicking leg lifting behind, as kickPose(0) holds them (runupScale).
 */
export const RUNUP_START_PHASE = Math.PI;
/** The run-up's walk from `from` to the ball (m): the group's move (layout.ts RUNUP). */
const RUNUP_LENGTH = Math.hypot(RUNUP.x, RUNUP.z);
const RUNUP_SAMPLES = 24;
/**
 * The run-up's walk draws its legs exactly (no easing: an eased leg lags its spot), from its start
 * (it grows out of the idle's legs) or, when it starts during a walk back (legs mid-step), from this
 * share on.
 */
export const RUNUP_EXACT_FROM = 0.2;
/**
 * The run-up's heading (the group's yaw that faces along it, rad): the group turns only from 0 to
 * RUNUP.yaw (towards the goal) while it moves towards the ball 25° to its right, so the walk turns
 * its hips along the run-up (the chest turned back to the group's facing): the legs step the way the
 * body goes, or the planted foot would slide sideways (about 40 % of the ground covered).
 */
export const RUNUP_HEADING = Math.atan2(-RUNUP.x, -RUNUP.z);
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

/** The strides the run-up's walk has taken by progress `u` from `from`: its ground (the smoothstep's speed) over the walk's stride at each moment's amount (midpoint rule). */
function runupStrides(u: number, from: number): number {
   const to = Math.max(0, Math.min(u, BACKSWING_FROM));
   const h = to / RUNUP_SAMPLES;
   let strides = 0;
   for (let i = 0; i < RUNUP_SAMPLES; i++) {
      const w = (i + 0.5) * h;
      // the group's speed in run-up progress: d/dw lerp(from, 1, smooth(w)) x the run-up's length
      const ground = RUNUP_LENGTH * (1 - from) * 6 * w * (1 - w) * h;
      strides += ground / (contactStride(runupAmount(w), L) * SCALE);
   }
   return strides;
}

let scaleFrom = NaN;
let scaleOf = 1;
let landsOf = false;

/**
 * The run-up's stride count scaled so the walk ends (at BACKSWING_FROM) with the plant foot landing
 * in front (phase π/2 + 2πk), and whether it does: a full run-up walks about 0.7 strides from
 * RUNUP_START_PHASE, so it lands after 0.75 (the steps 7 % shorter). A short one (started during a
 * walk back) keeps its own strides and does not land there.
 */
function runupScale(from: number): number {
   if (from === scaleFrom) return scaleOf;
   const natural = Math.PI * 2 * runupStrides(BACKSWING_FROM, from);
   // the plant foot (the striker's left: KICK_SIDE is its right) lands in front at phase π/2 + 2πk
   const down = KICK_SIDE > 0 ? (3 * Math.PI) / 2 : Math.PI / 2;
   const land = down + Math.PI * 2 * Math.round((RUNUP_START_PHASE + natural - down) / (Math.PI * 2)) - RUNUP_START_PHASE;
   landsOf = natural > 0 && land > Math.PI / 2 && Math.abs(land / natural - 1) < 0.25;
   scaleOf = landsOf ? land / natural : 1;
   scaleFrom = from;
   return scaleOf;
}

/**
 * walkPose's phase over the run-up at progress `u` (0..BACKSWING_FROM) from run-up progress `from`:
 * RUNUP_START_PHASE plus 2π x the strides the group has walked (runupScale's). So the phase advances
 * by the ground covered over the stride and the stance foot is where the walk would keep it (it is
 * pinned there too: pinRunupStance). Pure (a memo of the last `from`), allocation-free.
 */
export function runupPhase(u: number, from: number): number {
   return RUNUP_START_PHASE + Math.PI * 2 * runupScale(from) * runupStrides(u, from);
}

/** Does the run-up from `from` end with the plant foot landing as the backswing starts (runupScale)? */
export function runupLands(from: number): boolean {
   runupScale(from);
   return landsOf;
}
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

// ---------- the run-up's planted foot ----------

const RUNUP_POSE = createPose();
const RUNUP_NOW = { x: 0, z: 0, yaw: 0 };
const RUNUP_PLACE = { x: 0, z: 0, yaw: 0 };
const LOCK = new Float64Array(2);
const ANKLE = new Float64Array(4);
/** The hips' pivot (z, GLB units): core humanoidJoints puts the hips joint at (0, hipY, spineZ). */
const HIPS_Z = L.spineZ;

/** The run-up's walk at progress `u` into `out`, the group's placement into `place`: walkPose with the hips along the run-up (the chest turned back to the group's facing). */
function runupWalk(u: number, from: number, out: HumanoidPose, place: { x: number; z: number; yaw: number }): HumanoidPose {
   strikerPlacement(lerp(from, 1, smooth(u)), place);
   walkPose(runupPhase(u, from), runupAmount(u), out);
   const across = RUNUP_HEADING - place.yaw;
   turnBone(out, BONE.hips, 0, across, 0);
   turnBone(out, BONE.spine, 0, -across, 0);
   return out;
}

/** The run-up progress (0..u) at which walkPose's phase reaches `phase` (runupPhase grows with u): bisection. */
function runupProgressAt(phase: number, u: number, from: number): number {
   let lo = 0;
   let hi = u;
   for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (runupPhase(mid, from) < phase) lo = mid;
      else hi = mid;
   }
   return hi;
}

/**
 * The run-up walk's stance foot (the left from phase π/2 to 3π/2 of each stride, the right in the
 * other half) pinned where it touched down (or where it stood as the run-up started): two-bone IK
 * in the turned hips' frame, its height the walk's own. With the phase advanced by the walk's own
 * stride the walk would keep it there by itself; the pin also holds it while the stride grows out of
 * standing and the group turns.
 */
function pinRunupStance(u: number, from: number, out: HumanoidPose, place: { x: number; z: number; yaw: number }): void {
   const phase = runupPhase(u, from);
   const w = wrapPhase(phase);
   const side = w >= Math.PI / 2 && w < (3 * Math.PI) / 2 ? 1 : -1;
   const down = phase - wrapPhase(phase - (side > 0 ? Math.PI / 2 : (3 * Math.PI) / 2));
   const at = down <= RUNUP_START_PHASE ? 0 : runupProgressAt(down, u, from);
   runupWalk(at, from, RUNUP_POSE, RUNUP_PLACE);
   footPoint(RUNUP_POSE, L, side, ANKLE);
   toWorld(lerp(from, 1, smooth(at)), ANKLE[0], ANKLE[2], LOCK);
   pinLeg(out, side, LOCK[0], LOCK[1], footPoint(out, L, side, ANKLE)[1], place);
}

/**
 * One leg of `out` reaching for the world point (x, z) (m) with its ankle at height `y` (GLB units,
 * unlifted), for the group at `place`, its sole level: two-bone IK in the hips' frame, which may be
 * turned about y (the run-up's walk turns them along it).
 */
function pinLeg(out: HumanoidPose, side: number, x: number, z: number, y: number, place: { x: number; z: number; yaw: number }): void {
   // the spot in the striker's frame, then in the hips' unturned frame (they turn about y only)
   const turn = TURN + place.yaw;
   const c = Math.cos(turn);
   const s = Math.sin(turn);
   const dx = x - place.x;
   const dz = z - place.z;
   const lx = (dx * c - dz * s) / SCALE;
   const lz = (dx * s + dz * c) / SCALE - HIPS_Z;
   const o = BONE.hips * 4;
   const hips = 2 * Math.atan2(out.q[o + 1], out.q[o + 3]);
   const hc = Math.cos(hips);
   const hs = Math.sin(hips);
   const tx = lx * hc - lz * hs - side * L.hipX;
   const tz = lx * hs + lz * hc + HIPS_Z - L.hipZ;
   // a spot beyond the leg's reach at that height: the ankle higher in the body's frame (the body
   // sinks onto it, bodyLift keeps the lower sole on the floor), the knee kept a little bent
   let ty = y - L.hipY;
   const leg = THIGH + SHIN;
   if (tx * tx + ty * ty + tz * tz > leg * leg) ty = Math.max(ty, -Math.sqrt(Math.max(0, (PIN_REACH * leg) ** 2 - tx * tx - tz * tz)));
   plantLeg(out, side, tx, ty, tz, THIGH, SHIN);
   levelFoot(out, side);
}

/** A pinned leg reaches at most this share of its length (its knee never locks straight). */
const PIN_REACH = 0.985;

const PLANT_SPOT = new Float64Array(2);
const LANDING = new Float64Array(2);
const OWN = new Float64Array(2);
/** The backswing grows out of the walk's last pose over this share of it (the plant foot already on its spot). */
const RUNUP_INTO_KICK = 0.35;

/** Where the kick plants its foot (world m), into PLANT_SPOT: kickPose's own at the ball (run-up progress 1). */
function plantSpot(): Float64Array {
   const kick = kickEndOf();
   toWorld(1, kick.plantX, kick.plantZ, PLANT_SPOT);
   return PLANT_SPOT;
}

/**
 * The plant foot's last swing of the run-up (it lands as the backswing starts, runupLands) carried
 * onto the kick's plant spot: its own swing shifted by the gap between where the walk would land it
 * and the spot, more as it nears the ground. Then the backswing keeps it there, so it never slides.
 */
function placePlantFoot(u: number, from: number, out: HumanoidPose, place: { x: number; z: number; yaw: number }): void {
   const end = runupPhase(BACKSWING_FROM, from);
   const phase = runupPhase(u, from);
   if (!(phase > end - Math.PI)) return;
   const p = smooth((phase - (end - Math.PI)) / Math.PI);
   runupWalk(BACKSWING_FROM, from, RUNUP_POSE, RUNUP_PLACE);
   footPoint(RUNUP_POSE, L, PLANT_SIDE, ANKLE);
   toWorld(lerp(from, 1, smooth(BACKSWING_FROM)), ANKLE[0], ANKLE[2], LANDING);
   footPoint(out, L, PLANT_SIDE, ANKLE);
   toWorld(lerp(from, 1, smooth(u)), ANKLE[0], ANKLE[2], OWN);
   plantSpot();
   pinLeg(out, PLANT_SIDE, OWN[0] + (PLANT_SPOT[0] - LANDING[0]) * p, OWN[1] + (PLANT_SPOT[1] - LANDING[1]) * p, ANKLE[1], place);
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
      const lands = runupLands(frame.from);
      if (u < BACKSWING_FROM) {
         // the legs along the run-up (the chest kept to the group's facing), the stance foot pinned,
         // the plant foot's last swing carried onto the kick's plant spot
         runupWalk(u, frame.from, out, RUNUP_NOW);
         // the legs (and the hips' turn) grow out of the idle's: the swing leg lifts, the stance foot stays
         if (u < RUNUP_INTO_WALK) blendPoses(out, idlePose(now, scratch), 1 - smooth(u / RUNUP_INTO_WALK), out, POSE_MASK.legs);
         pinRunupStance(u, frame.from, out, frame);
         if (lands) placePlantFoot(u, frame.from, out, frame);
      } else {
         const k = (u - BACKSWING_FROM) / (1 - BACKSWING_FROM);
         kickPose(KICK_CONTACT * k, out);
         if (lands) {
            // out of the walk's last pose into the backswing, the plant foot kept on its spot
            const w = smooth(k / RUNUP_INTO_KICK);
            if (w < 1) blendPoses(runupWalk(BACKSWING_FROM, frame.from, RUNUP_POSE, RUNUP_PLACE), out, w, out);
            plantSpot();
            pinLeg(out, PLANT_SIDE, PLANT_SPOT[0], PLANT_SPOT[1], footPoint(out, L, PLANT_SIDE, ANKLE)[1], frame);
         }
      }
      // the legs exact (an eased leg lags its spot) once the ease from the idle is done; a run-up
      // that starts during a walk back (legs mid-step) eases in, and if its plant foot does not land
      // as the backswing starts, into the backswing too
      planted = (frame.from === 0 || u >= RUNUP_EXACT_FROM) && (lands || u < BACKSWING_FROM);
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
