// The Color Roll Heroes' animation set on the core auto-rig (core/rig): every pose the hero animator
// blends. Pure (no three.js, no React) and allocation-free: each builder writes into `out` and returns
// it, like core/rig/poses.ts, whose conventions it follows (faces +z, L = +x, arm angles from the
// hanging arm, `ground` 1 = the lower sole on the floor, 0 = in the air).
//
//    heroRunPose(theta, amount, landmarks, pose);   // a run with a flight phase, feet planted
//    phase += (speed * dt) / (heroStride(amount, landmarks) * scale) * 2π;
//
// The run: the core walkPose plants each foot for half of the cycle, so its stride (walkStride) is
// short for these short-legged heroes (8 strides a second at a full run). A real run plants each
// foot for less (the duty factor, RUN_DUTY at a sprint) and flies in between: heroRunPose time-warps
// each leg's own phase so its stance takes `duty` of the cycle, and heroStride is walkStride / (2 x
// duty). The planted foot then still sweeps back exactly as far as the body travels (no slide), at
// about five strides a second.
import { BONE, type HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import {
   aimArm,
   armsDownPose,
   cheerPose,
   createPose,
   idlePose,
   jumpPose,
   levelFoot,
   setBoneEuler,
   turnBone,
   walkPose,
   wrapPhase,
   type HumanoidPose,
} from "@/arcade3d/core/rig/poses";
import { footPoint, groundLift, walkStride } from "@/arcade3d/core/rig/gait";

const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth01 = (v: number) => {
   const t = clamp01(v);
   return t * t * (3 - 2 * t);
};

// side: +1 = L (+x), -1 = R (-x); the same helpers as core/rig/poses.ts (private there)
const upperArm = (side: number) => (side > 0 ? BONE.upperArmL : BONE.upperArmR);
const lowerArm = (side: number) => (side > 0 ? BONE.lowerArmL : BONE.lowerArmR);
const upperLeg = (side: number) => (side > 0 ? BONE.upperLegL : BONE.upperLegR);
const lowerLeg = (side: number) => (side > 0 ? BONE.lowerLegL : BONE.lowerLegR);
const footBone = (side: number) => (side > 0 ? BONE.footL : BONE.footR);

/** The upper arm from hanging: `forward` swings the hand forward (+z), `outward` away from the body. */
function setArm(out: HumanoidPose, side: number, forward: number, outward: number): void {
   setBoneEuler(out.q, upperArm(side), -forward, 0, side * outward);
}
/** The elbow: `bend` > 0 brings the hand forward. */
function setElbow(out: HumanoidPose, side: number, bend: number): void {
   setBoneEuler(out.q, lowerArm(side), 0, -side * bend, 0);
}
/** The thigh: `forward` swings the foot forward, `outward` away from the other leg. */
function setLeg(out: HumanoidPose, side: number, forward: number, outward = 0): void {
   setBoneEuler(out.q, upperLeg(side), -forward, 0, side * outward);
}
/** The knee: `bend` > 0 folds the foot back. */
function setKnee(out: HumanoidPose, side: number, bend: number): void {
   setBoneEuler(out.q, lowerLeg(side), bend, 0, 0);
}
/** A trunk bone: `lean` tips it forward, `twist` turns it left, `tilt` tips it to its right. */
function setTrunk(out: HumanoidPose, bone: number, lean: number, twist = 0, tilt = 0): void {
   setBoneEuler(out.q, bone, lean, twist, tilt);
}

function copyBone(from: HumanoidPose, to: HumanoidPose, bone: number): void {
   const o = bone * 4;
   to.q[o] = from.q[o];
   to.q[o + 1] = from.q[o + 1];
   to.q[o + 2] = from.q[o + 2];
   to.q[o + 3] = from.q[o + 3];
}

// ---------- the run ----------

/** The share of the cycle each foot is planted at a full run (a walk: 0.5, both feet share the ground). */
export const RUN_DUTY = 0.3;
/** The flight's rise at a full run, as a fraction of the hip height. */
export const RUN_HOP = 0.035;
/** The soft edge of a foot's contact (rad of its own phase). */
const CONTACT_EDGE = 0.1;

/** How much of the cycle each foot is planted at `amount` (0.5 up to a walk, RUN_DUTY at a full run). */
export function runDuty(amount: number): number {
   return lerp(0.5, RUN_DUTY, smooth01((clamp01(amount) - 0.5) / 0.5));
}

/** u: the leg's phase since its touchdown (0 .. 2π), from its uniform own phase. */
const sinceTouchdown = (theta: number) => wrapPhase(theta - Math.PI / 2);

/**
 * The time warp of one leg: its uniform own phase `theta` (the left leg's own phase is the cycle's,
 * the right one's is + π) -> the walk phase whose leg angles it takes. The stance (walk phase π/2 ..
 * 3π/2) takes `duty` of the cycle, the swing the rest. The identity at duty 0.5.
 */
export function legPhase(theta: number, duty: number): number {
   const u = sinceTouchdown(theta);
   const stance = TAU * duty;
   const m = u < stance ? (u / stance) * Math.PI : Math.PI + ((u - stance) / (TAU - stance)) * Math.PI;
   return Math.PI / 2 + m;
}

/** 0..1: how much this leg (uniform own phase `theta`) is planted, with soft edges. */
export function legContact(theta: number, duty: number): number {
   const u = sinceTouchdown(theta);
   const stance = TAU * duty;
   const inside = u <= stance ? Math.min(u, stance - u) : -Math.min(u - stance, TAU - u);
   return smooth01(0.5 + inside / (2 * CONTACT_EDGE));
}

const LEG_SCRATCH = createPose();
const END_POSE = createPose();
const ANKLE = new Float64Array(4);

/** walkPose at `theta`, with each leg's angles from its warped phase (its foot levelled on the new hips). */
function composeRun(theta: number, a: number, duty: number, out: HumanoidPose): HumanoidPose {
   walkPose(theta, a, out);
   if (duty >= 0.5 - 1e-9) return out;
   // the left leg at its own warped phase
   walkPose(legPhase(theta, duty), a, LEG_SCRATCH);
   copyBone(LEG_SCRATCH, out, BONE.upperLegL);
   copyBone(LEG_SCRATCH, out, BONE.lowerLegL);
   levelFoot(out, 1);
   // the right leg: own phase theta + π, and walkPose(p) holds the right leg at its own phase p + π
   walkPose(legPhase(theta + Math.PI, duty) - Math.PI, a, LEG_SCRATCH);
   copyBone(LEG_SCRATCH, out, BONE.upperLegR);
   copyBone(LEG_SCRATCH, out, BONE.lowerLegR);
   levelFoot(out, -1);
   return out;
}

/** The stance's two ends for one amount: the planted (left) ankle's z and the body's ground lift there. */
interface StanceEnds {
   duty: number;
   /** the ankle's z at touchdown (the leg forward) and at take-off (back), GLB units */
   zDown: number;
   zOff: number;
   liftDown: number;
   liftOff: number;
}
const ENDS: StanceEnds = { duty: 0.5, zDown: 0, zOff: 0, liftDown: 0, liftOff: 0 };

function stanceEnds(a: number, l: HumanoidLandmarks): StanceEnds {
   const duty = runDuty(a);
   ENDS.duty = duty;
   // the left foot touches down at theta π/2 and leaves `duty` of a cycle later
   composeRun(Math.PI / 2, a, duty, END_POSE);
   ENDS.zDown = footPoint(END_POSE, l, 1, ANKLE)[2];
   ENDS.liftDown = groundLift(END_POSE, l);
   composeRun(Math.PI / 2 + TAU * duty, a, duty, END_POSE);
   ENDS.zOff = footPoint(END_POSE, l, 1, ANKLE)[2];
   ENDS.liftOff = groundLift(END_POSE, l);
   return ENDS;
}

/**
 * The stride (GLB units, one cycle of the phase = two steps) at which heroRunPose's planted foot does
 * not slide: the planted ankle's sweep from touchdown to take-off over the duty. walkStride at a walk
 * (duty 0.5); longer at a run, where the hero flies between its steps. 0 standing (clamp it before
 * dividing). Pure and allocation-free.
 */
export function heroStride(amount: number, l: HumanoidLandmarks): number {
   const a = clamp01(amount);
   if (runDuty(a) >= 0.5 - 1e-9) return walkStride(a, l);
   const e = stanceEnds(a, l);
   return (e.zDown - e.zOff) / e.duty;
}

/** What heroRunPose gives besides the pose. */
export interface RunExtras {
   /**
    * The body's shift along its facing (GLB units, + = forward) that keeps the planted foot exactly
    * where it touched down (the leg's sweep is not quite even): a few centimetres, 0 at each touchdown
    * and take-off and in the flight. The animator adds it to the drawn body, never to the hero's point.
    */
   surge: number;
}

/** One leg's surge while planted (0 off the ground): what puts its ankle back on the even sweep from zDown to zOff. */
function legSurge(pose: HumanoidPose, l: HumanoidLandmarks, side: 1 | -1, theta: number, e: StanceEnds): number {
   const u = sinceTouchdown(theta);
   const stance = TAU * e.duty;
   if (u > stance) return 0;
   const k = u / stance;
   const z = footPoint(pose, l, side, ANKLE)[2];
   return e.zDown - z - k * (e.zDown - e.zOff);
}

/**
 * The hero's walk and run: `theta` the cycle's phase (rad, advance it by distance / heroStride x 2π),
 * `amount` 0..1 as walkPose's (0 = arms down, 0.5 walk, 1 run). Up to a walk the pose is walkPose
 * exactly. Faster, each leg's stance shortens to runDuty: between the stances the body flies on a
 * small arc from its take-off height to the next touchdown's, and while a foot is planted the lower
 * sole is on the floor. The height is carried in `lift` (ground 0), so bodyLift(pose, l) is the
 * body's height as for any pose. `extras.surge` keeps the planted foot put (RunExtras).
 */
export function heroRunPose(theta: number, amount: number, l: HumanoidLandmarks, out: HumanoidPose, extras?: RunExtras): HumanoidPose {
   const a = clamp01(amount);
   const duty = runDuty(a);
   if (extras) extras.surge = 0;
   if (a === 0) return walkPose(theta, 0, out);
   const e = stanceEnds(a, l);
   composeRun(theta, a, duty, out);
   const cL = legContact(theta, duty);
   const cR = legContact(theta + Math.PI, duty);
   if (extras) {
      // each planted leg's own (0 at its touchdown and take-off, so the hand-over is smooth); at a
      // walk both share the ground only at the hand-over, where both are 0
      extras.surge = legSurge(out, l, 1, theta, e) + legSurge(out, l, -1, theta + Math.PI, e);
   }
   if (duty >= 0.5 - 1e-9) return out;
   const contact = clamp01(cL + cR);
   const stanceLift = groundLift(out, l);
   let body = stanceLift;
   if (contact < 1) {
      // in a stance's soft edge the flight height is that end's (touchdown or take-off); in the
      // flight itself, from the last take-off's height to the next touchdown's, on a small arc
      const stance = TAU * duty;
      const uL = sinceTouchdown(theta);
      const uR = sinceTouchdown(theta + Math.PI);
      let flying: number;
      if (uL <= stance) flying = uL < stance / 2 ? e.liftDown : e.liftOff;
      else if (uR <= stance) flying = uR < stance / 2 ? e.liftDown : e.liftOff;
      else {
         const after = uL < Math.PI ? uL - stance : uR - stance;
         const f = clamp01(after / (Math.PI - stance));
         const hop = RUN_HOP * l.hipY * smooth01((a - 0.5) / 0.5) * Math.sin(Math.PI * f);
         flying = lerp(e.liftOff, e.liftDown, f) + hop;
      }
      body = contact * stanceLift + (1 - contact) * flying;
   }
   out.ground = 0;
   out.lift = body / l.hipY;
   // a swinging toe near the soft edges of a stance never dips under the floor
   return clearFloor(out, l);
}

/**
 * Raises the body (its `lift`) just enough that no sole is below the floor: for the air poses (a
 * dangling toe would dip under the hero's feet point next to the ground) and for any blend. A pose
 * whose soles are already on or over the floor is left as it is. Returns `out`.
 */
export function clearFloor(out: HumanoidPose, l: HumanoidLandmarks): HumanoidPose {
   const need = groundLift(out, l);
   const have = out.ground * need + out.lift * l.hipY;
   if (have < need) out.lift += (need - have) / l.hipY;
   return out;
}

// ---------- idle ----------

/** The look-around: the head's turn (rad, + = left) at `t` s, on a 7 s loop of glances and holds. */
export function lookAround(t: number): number {
   const u = ((t % 7) + 7) % 7;
   // centre .. left (hold) .. right (hold) .. centre
   if (u < 1.6) return 0;
   if (u < 2.1) return 0.55 * smooth01((u - 1.6) / 0.5);
   if (u < 3.3) return 0.55;
   if (u < 4.0) return lerp(0.55, -0.45, smooth01((u - 3.3) / 0.7));
   if (u < 5.2) return -0.45;
   if (u < 5.8) return -0.45 * (1 - smooth01((u - 5.2) / 0.6));
   return 0;
}

/**
 * Standing: the core idle (breathing, sway) with a deeper breath in the chest and the shoulders, a
 * slow weight shift, and the look-around (neck and head share the turn; the head tips a little with it).
 */
export function heroIdlePose(t: number, out: HumanoidPose): HumanoidPose {
   idlePose(t, out);
   const breath = Math.sin(t * 2.2);
   turnBone(out, BONE.chest, -0.02 * breath, 0, 0);
   const look = lookAround(t);
   turnBone(out, BONE.neck, 0, 0.4 * look, 0);
   turnBone(out, BONE.head, 0.04 * Math.abs(look), 0.6 * look, -0.05 * look);
   // the hands open a little on each breath in
   for (let side = 1; side >= -1; side -= 2) setArm(out, side, 0.03 * Math.sin(t * 1.3 + side), 0.05 + 0.025 * breath);
   return out;
}

// ---------- the jump ----------

/**
 * The take-off (in the air, `k` 1 = the moment the feet leave, fading to 0): the push leg stretched
 * back, the other knee driven up, both arms swung up and forward, the chest up.
 */
export function takeoffPose(k: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   out.ground = 0;
   const s = clamp01(k);
   setLeg(out, 1, -0.3 * s, 0.03);
   setKnee(out, 1, 0.25 * s);
   setLeg(out, -1, 0.95 * s, 0.05);
   setKnee(out, -1, 1.25 * s);
   for (let side = 1; side >= -1; side -= 2) {
      setArm(out, side, 2.0 * s, 0.3 * s);
      setElbow(out, side, 0.2 + 0.3 * s);
   }
   setTrunk(out, BONE.spine, -0.06 * s);
   setTrunk(out, BONE.head, -0.12 * s);
   return out;
}

/** The rise: the core jumpPose, tucking towards the apex (`tuck` 0..1). */
export function risePose(tuck: number, out: HumanoidPose): HumanoidPose {
   return jumpPose(tuck, out);
}

/**
 * Falling (`t` s for a small flutter, `reach` 0..1 = how near the floor): the legs reach down and a
 * little forward for the landing, the arms up and out for balance.
 */
export function fallPose(t: number, reach: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   out.ground = 0;
   const r = clamp01(reach);
   for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const f = 0.06 * Math.sin(t * 11 + i * 1.7);
      setLeg(out, side, 0.32 - 0.15 * r + f * side, 0.06);
      setKnee(out, side, 0.5 - 0.25 * r);
      const v = 1.0 + f;
      aimArm(out, side, Math.sin(v), Math.cos(v) * 0.6, 0.15, Math.sin(v + 0.3), Math.cos(v + 0.3) * 0.4, 0.3);
   }
   setTrunk(out, BONE.spine, 0.08);
   setTrunk(out, BONE.head, -0.12);
   return out;
}

/**
 * The landing crouch (`k` 0..1, 1 = the deepest): the knees and hips bend with the feet flat on the
 * floor (ground 1, so bodyLift lowers the body), the back leans in and the arms swing forward.
 */
export function landPose(k: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   const s = clamp01(k);
   for (let side = 1; side >= -1; side -= 2) {
      setLeg(out, side, 0.6 * s, 0.07 * s);
      setKnee(out, side, 1.05 * s);
      levelFoot(out, side);
      setArm(out, side, 0.7 * s, 0.25 * s);
      setElbow(out, side, 0.15 + 0.35 * s);
   }
   setTrunk(out, BONE.spine, 0.3 * s);
   setTrunk(out, BONE.head, -0.2 * s);
   return out;
}

/** The double jump's somersault: a tight tuck (the animator's group turns the body about its middle). */
export function flipPose(out: HumanoidPose): HumanoidPose {
   jumpPose(1, out);
   for (let side = 1; side >= -1; side -= 2) {
      setLeg(out, side, 1.25, 0.08);
      setKnee(out, side, 1.9);
      setArm(out, side, 1.05, 0.12);
      setElbow(out, side, 1.35);
   }
   setTrunk(out, BONE.spine, 0.4);
   setTrunk(out, BONE.chest, 0.15);
   setTrunk(out, BONE.head, 0.25);
   return out;
}

/**
 * Curled into the ball (`k` 0..1): the whole body tipped forward from the hips, the knees pulled up
 * to the chest, the arms wrapped round the shins, the back rounded and the head tucked, in the air.
 * (The most compact curl of the five meshes: about 1.5 x 1.7 GLB units with the tail; the shell,
 * HeroBall, closes round it.)
 */
export function curlPose(k: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   out.ground = 0;
   const s = clamp01(k);
   setTrunk(out, BONE.hips, 1.0 * s);
   for (let side = 1; side >= -1; side -= 2) {
      setLeg(out, side, 2.1 * s, 0.1 * s);
      setKnee(out, side, 2.3 * s);
      setArm(out, side, 0.8 * s, 0.1 * s);
      setElbow(out, side, 0.12 + 1.58 * s);
   }
   setTrunk(out, BONE.spine, 0.5 * s);
   setTrunk(out, BONE.chest, 0.4 * s);
   setTrunk(out, BONE.neck, 0.4 * s);
   setTrunk(out, BONE.head, 0.5 * s);
   return out;
}

/**
 * The dash (`t` s): a hard forward lean, the arms swept back, one leg trailing and the other driven
 * forward, the head up to look ahead. In the air: the game moves the hero, the streak follows it.
 */
export function dashPose(t: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   out.ground = 0;
   const f = 0.05 * Math.sin(t * 30);
   for (let side = 1; side >= -1; side -= 2) {
      setArm(out, side, -0.95 + f * side, 0.35);
      setElbow(out, side, 0.3);
   }
   setLeg(out, 1, 0.55 + f, 0.04);
   setKnee(out, 1, 1.15);
   setLeg(out, -1, -0.55 - f, 0.04);
   setKnee(out, -1, 0.7);
   setTrunk(out, BONE.spine, 0.45);
   setTrunk(out, BONE.chest, 0.12);
   setTrunk(out, BONE.neck, -0.2);
   setTrunk(out, BONE.head, -0.3);
   return out;
}

/**
 * Hurt (`t` s since the hit, 0..~0.5): a recoil, the back and the head thrown back, the arms flung
 * out in front, one leg up, a quick head shake; the feet stay on the floor (ground 1). The
 * animator's group adds the knockback's tilt and hop.
 */
export function hurtPose(t: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   const k = Math.exp(-t * 4);
   const shake = Math.sin(t * 38) * Math.exp(-t * 6);
   for (const side of [1, -1] as const) {
      aimArm(out, side, lerp(0.3, 0.75, k), lerp(-0.9, 0.2, k), lerp(0.2, 0.65, k), 0.25, lerp(-0.6, 0.5, k), 0.8);
   }
   setLeg(out, 1, 0.45 * k, 0.06);
   setKnee(out, 1, 0.2 + 0.5 * k);
   levelFoot(out, 1);
   setLeg(out, -1, -0.12 * k, 0.04);
   setKnee(out, -1, 0.12);
   levelFoot(out, -1);
   setTrunk(out, BONE.spine, -0.35 * k);
   setTrunk(out, BONE.chest, -0.15 * k);
   setTrunk(out, BONE.head, -0.3 * k, 0.35 * shake);
   return out;
}

/** The celebration: the core cheer (arms up in a V, waving) with a pumping chest; the animator hops it. */
export function heroCheerPose(t: number, out: HumanoidPose): HumanoidPose {
   cheerPose(t, out);
   turnBone(out, BONE.chest, -0.05 * Math.abs(Math.sin(t * 5)), 0.12 * Math.sin(t * 2.5), 0);
   return out;
}

/**
 * Defeat (`t` s since it began): the hero sinks into a squat, the back rounded, the head down with a
 * slow shake, the arms hanging between the knees. The feet stay flat on the floor (ground 1).
 */
export function defeatPose(t: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   const k = smooth01(t / 0.6);
   for (let side = 1; side >= -1; side -= 2) {
      setLeg(out, side, 1.15 * k, 0.16 * k);
      setKnee(out, side, 1.8 * k);
      levelFoot(out, side);
      setArm(out, side, 0.55 * k, 0.04);
      setElbow(out, side, 0.12 + 0.25 * k);
   }
   setTrunk(out, BONE.spine, 0.5 * k);
   setTrunk(out, BONE.chest, 0.2 * k);
   setTrunk(out, BONE.neck, 0.3 * k);
   setTrunk(out, BONE.head, 0.25 * k, 0.18 * Math.sin(t * 1.6) * k);
   return out;
}

