// Procedural poses for the humanoid auto-rig (core/rig/humanoid.ts). Owned by Claude. Pure: no
// three.js, no React, and no allocation in any builder (each one writes into `out` and returns it),
// so a game may rebuild its pose every frame.
//
//    const pose = createPose();
//    walkPose(phase, amount, pose);                 // legs, arms and torso of one stride
//    carryPose(1, scratch);                         // both arms up, holding something overhead
//    blendPoses(pose, scratch, k, pose, POSE_MASK.arms);
//
// Conventions (the character faces +z, L = its left = +x; rotations in radians):
// - `q` holds one quaternion (x, y, z, w) per bone in HUMANOID_BONES order: the bone's rotation in
//   its parent's frame. Every bone's bind pose is the T-pose, unrotated.
// - The upper arms are special: the rig first lowers each arm by `dropL` / `dropR` (0 = straight out
//   as modelled, 1 = hanging at the character's own armSpread, clear of its body), then applies the
//   upper arm's `q` in the chest's frame. So arm angles are measured from the hanging arm and one
//   pose fits every body. The lower arms rotate in the upper arm's (T-pose) frame.
// - The clavicles are the rig's: resolvePose shrugs each one by a share of its arm's elevation above
//   level (whatever the pose holds there) and keeps the arm's direction, so a raised arm lifts its
//   shoulder instead of crushing it.
// - The feet rotate in the lower legs' frame; levelFoot() keeps a sole flat on the floor.
// - The body's height: core/rig/gait.ts bodyLift(pose, landmarks) = `ground` x the rise that puts the
//   lower sole on the floor (0 = in the air, 1 = standing or walking) + `lift` x the hip height
//   (a run's flight, a hop; never needed to keep the feet out of the floor).
// - Helpers below speak in body terms: forward (+z) swings, outward (away from the body) swings,
//   elbow and knee bends (positive = the natural way), twist (positive = turn left), lean.
import { BONE, BONE_COUNT, BONE_MIRROR } from "./humanoid";
import { mulQuat, rotateVec } from "./quat";

export interface HumanoidPose {
   /** one quaternion (x, y, z, w) per bone, HUMANOID_BONES order */
   q: Float32Array;
   /** 0 = the left arm straight out (T-pose), 1 = hanging at the character's armSpread */
   dropL: number;
   /** the same for the right arm */
   dropR: number;
   /** extra rise of the body over its ground contact, as a fraction of the hip height (>= 0 keeps the feet out of the floor) */
   lift: number;
   /**
    * 1 = the lower sole is kept on the floor (standing, walking), 0 = in the air (a jump); in
    * between the body keeps that share of its ground contact (a run lets go with its legs apart).
    * Any value in 0..1 keeps the feet out of the floor.
    */
   ground: number;
}

/** Per-bone factors for blendPoses (HUMANOID_BONES order): 1 = take the other pose, 0 = keep. */
export type PoseMask = readonly number[];

const mask = (bones: number[]): PoseMask => Array.from({ length: BONE_COUNT }, (_v, i) => (bones.includes(i) ? 1 : 0));

/** Common masks: arms (both arms, and the arm drops), legs (legs and feet, the lift and the ground contact), upper body. */
export const POSE_MASK = {
   all: mask([...Array(BONE_COUNT).keys()]),
   arms: mask([BONE.clavicleL, BONE.upperArmL, BONE.lowerArmL, BONE.clavicleR, BONE.upperArmR, BONE.lowerArmR]),
   legs: mask([BONE.hips, BONE.upperLegL, BONE.lowerLegL, BONE.footL, BONE.upperLegR, BONE.lowerLegR, BONE.footR]),
   upper: mask([
      BONE.spine,
      BONE.chest,
      BONE.neck,
      BONE.head,
      BONE.clavicleL,
      BONE.upperArmL,
      BONE.lowerArmL,
      BONE.clavicleR,
      BONE.upperArmR,
      BONE.lowerArmR,
   ]),
} as const;

const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth01 = (v: number) => {
   const t = clamp01(v);
   return t * t * (3 - 2 * t);
};

// ---------- quaternions in place ----------

/** Bone `bone`'s rotation from Euler angles, applied z first, then y, then x (three.js "XYZ"). */
export function setBoneEuler(q: Float32Array, bone: number, x: number, y: number, z: number): void {
   const c1 = Math.cos(x / 2);
   const c2 = Math.cos(y / 2);
   const c3 = Math.cos(z / 2);
   const s1 = Math.sin(x / 2);
   const s2 = Math.sin(y / 2);
   const s3 = Math.sin(z / 2);
   const o = bone * 4;
   q[o] = s1 * c2 * c3 + c1 * s2 * s3;
   q[o + 1] = c1 * s2 * c3 - s1 * c2 * s3;
   q[o + 2] = c1 * c2 * s3 + s1 * s2 * c3;
   q[o + 3] = c1 * c2 * c3 - s1 * s2 * s3;
}

const TURN_Q = new Float32Array(4);

/**
 * Turns bone `bone` further, on top of whatever the pose already holds for it: Euler angles
 * (x, y, z, three.js "XYZ") applied in the bone's parent frame, so a lean (x) tips the bone and all
 * its children about the parent's axes. `turnBone(p, BONE.spine, lean, 0, 0)` leans a walking spine
 * further into the run without redoing the walk's own twist. Zero angles change nothing.
 */
export function turnBone(out: HumanoidPose, bone: number, x: number, y: number, z: number): HumanoidPose {
   if (x === 0 && y === 0 && z === 0) return out;
   setBoneEuler(TURN_Q, 0, x, y, z);
   mulQuat(TURN_Q, 0, out.q, bone * 4, out.q, bone * 4);
   return out;
}

// side: +1 = L (+x), -1 = R (-x)
const clavicle = (side: number) => (side > 0 ? BONE.clavicleL : BONE.clavicleR);
const upperArm = (side: number) => (side > 0 ? BONE.upperArmL : BONE.upperArmR);
const lowerArm = (side: number) => (side > 0 ? BONE.lowerArmL : BONE.lowerArmR);
const upperLeg = (side: number) => (side > 0 ? BONE.upperLegL : BONE.upperLegR);
const lowerLeg = (side: number) => (side > 0 ? BONE.lowerLegL : BONE.lowerLegR);
const foot = (side: number) => (side > 0 ? BONE.footL : BONE.footR);

/** The upper arm, from hanging: `forward` swings the hand forward (+z), `outward` away from the body. */
function setArm(out: HumanoidPose, side: number, forward: number, outward: number): void {
   setBoneEuler(out.q, upperArm(side), -forward, 0, side * outward);
}

/** The lower arm: `bend` > 0 brings the hand towards the front of the upper arm (a hanging arm: forward). */
function setElbow(out: HumanoidPose, side: number, bend: number): void {
   setBoneEuler(out.q, lowerArm(side), 0, -side * bend, 0);
}

/** The upper leg: `forward` swings the foot forward (+z), `outward` away from the other leg. */
function setLeg(out: HumanoidPose, side: number, forward: number, outward = 0): void {
   setBoneEuler(out.q, upperLeg(side), -forward, 0, side * outward);
}

/** The lower leg: `bend` > 0 folds the foot back (a knee bends one way). */
function setKnee(out: HumanoidPose, side: number, bend: number): void {
   setBoneEuler(out.q, lowerLeg(side), bend, 0, 0);
}

const LEG_Q = new Float64Array(8);

/**
 * Turns a foot so its sole stays flat on the floor whatever the hips, the thigh and the knee do
 * (only the hips' turn about the vertical is kept, so the foot still points where the body does).
 * `k` 0..1 blends from rigid on the shin (0) to flat (1). Call it after the leg's own rotations.
 */
export function levelFoot(out: HumanoidPose, side: number, k = 1): HumanoidPose {
   const q = out.q;
   const h = BONE.hips * 4;
   // the lower leg's rotation from the root: hips * thigh * shin
   mulQuat(q, h, q, upperLeg(side) * 4, LEG_Q, 0);
   mulQuat(LEG_Q, 0, q, lowerLeg(side) * 4, LEG_Q, 0);
   // the hips' twist about y (the swing-twist split of its rotation)
   let ty = q[h + 1];
   let tw = q[h + 3];
   const tl = Math.hypot(ty, tw) || 1;
   ty /= tl;
   tw /= tl;
   // foot = (hips * thigh * shin)^-1 * twist
   LEG_Q[0] = -LEG_Q[0];
   LEG_Q[1] = -LEG_Q[1];
   LEG_Q[2] = -LEG_Q[2];
   LEG_Q[4] = 0;
   LEG_Q[5] = ty;
   LEG_Q[6] = 0;
   LEG_Q[7] = tw;
   mulQuat(LEG_Q, 0, LEG_Q, 4, LEG_Q, 0);
   // nlerp from the identity (rigid on the shin) by k, the shorter way
   const sign = LEG_Q[3] < 0 ? -1 : 1;
   const x = sign * LEG_Q[0] * k;
   const y = sign * LEG_Q[1] * k;
   const z = sign * LEG_Q[2] * k;
   const w = 1 - k + sign * LEG_Q[3] * k;
   const len = Math.hypot(x, y, z, w) || 1;
   const o = foot(side) * 4;
   q[o] = x / len;
   q[o + 1] = y / len;
   q[o + 2] = z / len;
   q[o + 3] = w / len;
   return out;
}

const ARM_Q = new Float64Array(4);
const ARM_V = new Float64Array(3);

/** Bone `bone`'s rotation = the shortest turn from the arm's rest axis (side, 0, 0) to (dx, dy, dz) (unit). */
function setShortestTurn(q: Float32Array | Float64Array, o: number, side: number, dx: number, dy: number, dz: number): void {
   // (side, 0, 0) x d and 1 + (side, 0, 0) . d, normalised (the half-way quaternion)
   let x = 0;
   let y = -side * dz;
   let z = side * dy;
   let w = 1 + side * dx;
   if (w < 1e-6) {
      // straight back along the arm: half a turn about the vertical
      x = 0;
      y = 1;
      z = 0;
      w = 0;
   }
   const len = Math.hypot(x, y, z, w);
   q[o] = x / len;
   q[o + 1] = y / len;
   q[o + 2] = z / len;
   q[o + 3] = w / len;
}

/**
 * Points an arm exactly, from the T-pose (its drop becomes 0): the upper arm along (ux, uy, uz), the
 * forearm along (fx, fy, fz), both in the chest's frame and written for the left arm (+x = away
 * from the body); the right arm mirrors x. Directions need not be unit length. Each segment takes
 * the shortest turn there, so neither wrings about its own axis (a wrung upper arm crushes the
 * shoulder in linear blend skinning): the elbow bends in whatever plane the two directions span.
 * `roll` then turns the forearm and hand about their own axis (rad, the same for both sides).
 */
export function aimArm(out: HumanoidPose, side: 1 | -1, ux: number, uy: number, uz: number, fx: number, fy: number, fz: number, roll = 0): void {
   let len = Math.hypot(ux, uy, uz) || 1;
   const o = upperArm(side) * 4;
   setShortestTurn(out.q, o, side, (side * ux) / len, uy / len, uz / len);
   if (side > 0) out.dropL = 0;
   else out.dropR = 0;
   // the forearm's direction in the upper arm's frame (the inverse turn), then its own shortest turn
   ARM_Q[0] = -out.q[o];
   ARM_Q[1] = -out.q[o + 1];
   ARM_Q[2] = -out.q[o + 2];
   ARM_Q[3] = out.q[o + 3];
   len = Math.hypot(fx, fy, fz) || 1;
   rotateVec(ARM_Q, 0, (side * fx) / len, fy / len, fz / len, ARM_V, 0);
   setShortestTurn(ARM_Q, 0, side, ARM_V[0], ARM_V[1], ARM_V[2]);
   // then the roll about the forearm's own axis (local x): turn * rotX(roll)
   const sx = Math.sin(roll / 2);
   const cx = Math.cos(roll / 2);
   const qx = ARM_Q[0];
   const qy = ARM_Q[1];
   const qz = ARM_Q[2];
   const qw = ARM_Q[3];
   const f = lowerArm(side) * 4;
   out.q[f] = qw * sx + qx * cx;
   out.q[f + 1] = qy * cx + qz * sx;
   out.q[f + 2] = qz * cx - qy * sx;
   out.q[f + 3] = qw * cx - qx * sx;
}

/** A trunk bone: `lean` > 0 tips its top forward, `twist` > 0 turns it left, `tilt` > 0 tips it to its right. */
function setTrunk(out: HumanoidPose, bone: number, lean: number, twist = 0, tilt = 0): void {
   setBoneEuler(out.q, bone, lean, twist, tilt);
}

// ---------- the basics ----------

/** A new pose object: the rest pose (T-pose). */
export function createPose(): HumanoidPose {
   return restPose({ q: new Float32Array(BONE_COUNT * 4), dropL: 0, dropR: 0, lift: 0, ground: 1 });
}

/** The T-pose as modelled (every bone unrotated, arms straight out), standing on the floor. */
export function restPose(out: HumanoidPose): HumanoidPose {
   for (let b = 0; b < BONE_COUNT; b++) {
      const o = b * 4;
      out.q[o] = 0;
      out.q[o + 1] = 0;
      out.q[o + 2] = 0;
      out.q[o + 3] = 1;
   }
   out.dropL = 0;
   out.dropR = 0;
   out.lift = 0;
   out.ground = 1;
   return out;
}

/** Standing: arms hanging by the sides (at the character's armSpread), elbows a little bent. */
export function armsDownPose(out: HumanoidPose): HumanoidPose {
   restPose(out);
   out.dropL = 1;
   out.dropR = 1;
   setElbow(out, 1, ARMS_DOWN_ELBOW);
   setElbow(out, -1, ARMS_DOWN_ELBOW);
   return out;
}

const ARMS_DOWN_ELBOW = 0.12;

export function copyPose(source: HumanoidPose, out: HumanoidPose): HumanoidPose {
   if (source !== out) out.q.set(source.q);
   out.dropL = source.dropL;
   out.dropR = source.dropR;
   out.lift = source.lift;
   out.ground = source.ground;
   return out;
}

/**
 * a -> b by k (0 = a, 1 = b), per bone (normalised lerp along the shorter way), into `out` (may be
 * `a` or `b`). With a mask, bone i blends by k * mask[i]; the arm drops follow the upper arms' mask,
 * the lift and the ground contact the hips'.
 */
export function blendPoses(a: HumanoidPose, b: HumanoidPose, k: number, out: HumanoidPose, bones: PoseMask = POSE_MASK.all): HumanoidPose {
   for (let bone = 0; bone < BONE_COUNT; bone++) {
      const t = k * bones[bone];
      const o = bone * 4;
      const ax = a.q[o];
      const ay = a.q[o + 1];
      const az = a.q[o + 2];
      const aw = a.q[o + 3];
      let bx = b.q[o];
      let by = b.q[o + 1];
      let bz = b.q[o + 2];
      let bw = b.q[o + 3];
      if (ax * bx + ay * by + az * bz + aw * bw < 0) {
         bx = -bx;
         by = -by;
         bz = -bz;
         bw = -bw;
      }
      const x = lerp(ax, bx, t);
      const y = lerp(ay, by, t);
      const z = lerp(az, bz, t);
      const w = lerp(aw, bw, t);
      const len = Math.hypot(x, y, z, w) || 1;
      out.q[o] = x / len;
      out.q[o + 1] = y / len;
      out.q[o + 2] = z / len;
      out.q[o + 3] = w / len;
   }
   out.dropL = lerp(a.dropL, b.dropL, k * bones[BONE.upperArmL]);
   out.dropR = lerp(a.dropR, b.dropR, k * bones[BONE.upperArmR]);
   out.lift = lerp(a.lift, b.lift, k * bones[BONE.hips]);
   out.ground = lerp(a.ground, b.ground, k * bones[BONE.hips]);
   return out;
}

/** The pose seen in a mirror at x = 0: left and right swapped (into `out`, which may be `source`). */
export function mirrorPose(source: HumanoidPose, out: HumanoidPose): HumanoidPose {
   // reflecting x -> -x keeps a rotation's x and negates its y and z
   for (let bone = 0; bone < BONE_COUNT; bone++) {
      const other = BONE_MIRROR[bone];
      if (other < bone) continue;
      const o = bone * 4;
      const m = other * 4;
      const x = source.q[o];
      const y = source.q[o + 1];
      const z = source.q[o + 2];
      const w = source.q[o + 3];
      out.q[o] = source.q[m];
      out.q[o + 1] = -source.q[m + 1];
      out.q[o + 2] = -source.q[m + 2];
      out.q[o + 3] = source.q[m + 3];
      out.q[m] = x;
      out.q[m + 1] = -y;
      out.q[m + 2] = -z;
      out.q[m + 3] = w;
   }
   const dropL = source.dropL;
   out.dropL = source.dropR;
   out.dropR = dropL;
   out.lift = source.lift;
   out.ground = source.ground;
   return out;
}

// ---------- motion ----------

/**
 * Standing still and breathing: armsDown with a slow breath (in the chest, so the feet stay put),
 * a small sway and a glance. `t` in seconds.
 */
export function idlePose(t: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   const breath = Math.sin(t * 2.2);
   setTrunk(out, BONE.chest, -0.015 * breath);
   setTrunk(out, BONE.spine, 0, 0.025 * Math.sin(t * 0.6), 0.012 * Math.sin(t * 0.9));
   setTrunk(out, BONE.head, 0.02 * Math.sin(t * 1.1), 0.08 * Math.sin(t * 0.7));
   for (let side = 1; side >= -1; side -= 2) {
      setArm(out, side, 0.02 * Math.sin(t * 1.3 + side), 0.02 + 0.015 * breath);
      setElbow(out, side, ARMS_DOWN_ELBOW + 0.03 * breath);
   }
   return out;
}

/** The walk's legs: swing (rad) per unit of amount, ... */
export const WALK_LEG_SWING = 0.72;
/** ...the thigh lifts by this share of its knee's fold (the folded leg passes under the body, clear of the floor). */
const HIP_FLEX = 0.5;
/**
 * A slow walk still lifts its feet: the swing knee folds at least this much (rad), reached by amount
 * SLOW_FOLD_RAMP (smoothly from 0, so amount 0 stays armsDownPose), where the walk's own fold
 * (amount x (0.6 + 0.9 amount)) would barely bend it and the feet would shuffle along the floor.
 */
export const SLOW_FOLD = 0.7;
const SLOW_FOLD_RAMP = 0.2;
/** A run's flight: the body rises by this fraction of the hip height, legs apart. */
const RUN_FLIGHT = 0.02;
/** A run bends the forward leg's knee by this much (rad) at full reach. */
const RUN_REACH_BEND = 0.5;

/**
 * walkPose's leg angles for one side at a stride phase: out[0] = the thigh's forward swing,
 * out[1] = the knee's bend (rad). `side` 1 = L, -1 = R.
 */
export function walkLegAngles(phase: number, amount: number, side: number, out: Float64Array): Float64Array {
   const a = clamp01(amount);
   const ls = side * Math.sin(phase);
   // the swing through the air: 0 = lift-off behind (phase -π/2 for the left leg) .. 1 = landing in
   // front (π/2); on the ground (the other half) the leg stays straight. Both legs are straight at
   // the long stride, so the planted foot hands over to the other exactly there, while neither
   // moves under the body.
   const w = wrapPhase(phase + (side > 0 ? 0 : Math.PI) + Math.PI / 2);
   let knee = 0;
   let flex = 0;
   if (w < Math.PI) {
      const u = w / Math.PI;
      const fold = Math.max(a * (0.6 + 0.9 * a), SLOW_FOLD * smooth01(a / SLOW_FOLD_RAMP));
      // the knee folds early in the swing and is straight again before the thigh comes back from
      // its lift (most at 2/3 of the swing), so the foot stays clear of the floor until it lands
      const k = Math.sin(Math.PI * Math.min(1, u / KNEE_END));
      const f = Math.sin(Math.PI * u) * u;
      knee = fold * k * k;
      flex = HIP_FLEX * fold * f * f * FLEX_PEAK;
   }
   // a run reaches forward with the knee bent, its shin nearly upright (the foot lands under the knee)
   const reach = Math.max(0, ls);
   // the thigh sweeps at a nearly even pace (an even sweep keeps the planted foot from sliding)
   out[0] = WALK_LEG_SWING * a * (Math.asin(SWEEP * ls) / SWEEP_TOP) + flex;
   // (no bend on the ground: a bent knee would lower the leg in front and lift the one behind)
   out[1] = knee + RUN_REACH_BEND * runOf(a) * reach * reach;
   return out;
}

/** The swing's knee fold is over by this share of the swing. */
const KNEE_END = 0.8;
/** 1 / the peak of (u sin πu)² on 0..1 (at u ≈ 0.646), so the thigh's lift peaks at HIP_FLEX x the fold. */
const FLEX_PEAK = 1 / 0.3347;
/** The thigh's sweep: asin(SWEEP sin φ) / asin(SWEEP), between a sine (0) and an even sweep (1). */
const SWEEP = 0.95;
const SWEEP_TOP = Math.asin(SWEEP);

/** The walk turns into a run from amount 0.5 to 0.9. */
const runOf = (a: number) => smooth01((a - 0.5) / 0.4);

const LEGS = new Float64Array(2);

/**
 * One stride of a walk or a run. `phase` (rad) goes once round per stride (two steps): the left
 * leg is fully forward at π/2, the right one at 3π/2, and phase + π is the mirror image. Advance it
 * with the distance walked (phase += distance / stride * 2π, the stride from gait.ts contactStride) so
 * the feet do not slide. `amount` 0..1: 0 = armsDownPose exactly, about 0.5 = a walk, 1 = a run
 * (wider swings, knees and elbows bent further, a forward lean). The legs swing about x, straight
 * on the ground; the knee folds only while the leg swings forward through the air, and its thigh
 * lifts with it; the feet stay flat (levelFoot). The arms swing opposite to the legs with bent
 * elbows; the chest counter-twists against the hips. The body's bob comes from the ground contact
 * (bodyLift in gait.ts: lowest at the long stride of a walk); a run lets go of the ground with its
 * legs apart (`ground` < 1) and adds a small flight (`lift`), so it does not dip at its long strides.
 */
export function walkPose(phase: number, amount: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   const a = clamp01(amount);
   if (a === 0) return out;
   const s = Math.sin(phase);
   const armSwing = a * (0.45 + 0.45 * a);
   const elbow = ARMS_DOWN_ELBOW + a * (0.25 + 1.0 * a);

   setTrunk(out, BONE.hips, 0, -0.12 * a * s);
   for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      // the right leg is half a stride behind the left
      walkLegAngles(phase, a, side, LEGS);
      setLeg(out, side, LEGS[0], 0.03 * a);
      setKnee(out, side, LEGS[1]);
      levelFoot(out, side);
      // the arm goes the other way, its elbow bends a little more on the way forward
      const ls = side * s;
      setArm(out, side, -armSwing * ls, 0.05 * a);
      setElbow(out, side, elbow + 0.2 * a * Math.max(0, -ls));
   }
   setTrunk(out, BONE.spine, 0.06 * a, 0.06 * a * s);
   setTrunk(out, BONE.chest, 0.02 * a, 0.14 * a * s);
   setTrunk(out, BONE.neck, -0.04 * a);
   setTrunk(out, BONE.head, -0.02 * a, -0.08 * a * s);

   // a run flies with its legs apart: the ground contact lets go there (it would drag the body down
   // by the long stride) and the body rises a little, so the stance foot touches near mid-stance only
   const run = runOf(a);
   out.ground = 1 - run * s * s;
   out.lift = run * RUN_FLIGHT * s * s;
   return out;
}

/**
 * Both arms holding something: `height` 0 = forearms forward at the chest (a box in front),
 * 1 = arms up overhead (a box over the head), smooth in between. Legs as in armsDownPose.
 */
export function carryPose(height: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   const h = smooth01(height);
   // aimed exactly (from the T-pose, each segment its shortest turn, so the shoulders do not wring):
   // upper arms down-forward -> up and out past the head, forearms level and forward -> straight up
   // beside it, the hands' flat sides facing forward (edge-on to the head), under the load's edges
   const ux = lerp(0.1, 0.75, h);
   const uy = lerp(-0.8, 0.65, h);
   const uz = lerp(0.45, 0.1, h);
   const fx = lerp(-0.15, 0.04, h);
   const fy = lerp(0.15, 1, h);
   const fz = lerp(1, 0.08, h);
   aimArm(out, 1, ux, uy, uz, fx, fy, fz);
   aimArm(out, -1, ux, uy, uz, fx, fy, fz);
   setTrunk(out, BONE.spine, -0.04 * h);
   setTrunk(out, BONE.head, 0.06 * h);
   return out;
}

/** reachPose's top: the arm about 60° above level, well out from vertical, so it clears a head as wide as the robot's. */
export const REACH_TOP = 0.33 * Math.PI;

/**
 * One arm reaching out to its side: `side` 1 = the left (+x), -1 = the right; `height` 0 = out
 * level (straight out, as in the T-pose), 1 = high up beside the head (REACH_TOP above level, out
 * from vertical so the arm passes a wide head). The other arm hangs; the body leans a little
 * towards the reach.
 */
export function reachPose(side: 1 | -1, height: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   const h = clamp01(height);
   // the reaching arm from the T-pose (drop 0), so the angles are exact for every body
   if (side > 0) out.dropL = 0;
   else out.dropR = 0;
   setBoneEuler(out.q, upperArm(side), 0, 0, side * h * REACH_TOP);
   setElbow(out, side, 0.08);
   setArm(out, -side, 0, 0.06);
   setTrunk(out, BONE.spine, 0, 0, -side * 0.06);
   setTrunk(out, BONE.head, 0, side * 0.15, 0);
   return out;
}

/** A win: both arms up in a V, waving, the head back a little. `t` in seconds. */
export function cheerPose(t: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      // the upper arm this far out from straight up (never closer than 0.55 rad: a wide head), waving;
      // the forearm a little more upright
      const v = 0.7 + 0.15 * Math.sin(t * 9 + i * Math.PI);
      aimArm(out, side, Math.sin(v), Math.cos(v), 0.15, Math.sin(v - 0.35), Math.cos(v - 0.35), 0.25);
   }
   setTrunk(out, BONE.spine, -0.06);
   setTrunk(out, BONE.head, -0.15);
   return out;
}

/** In the air (no ground contact): `tuck` 0..1 pulls the knees up and the arms up and forward. */
export function jumpPose(tuck: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   out.ground = 0;
   const k = clamp01(tuck);
   for (let side = 1; side >= -1; side -= 2) {
      setLeg(out, side, 0.75 * k, 0.04 * k);
      setKnee(out, side, 1.3 * k);
      setArm(out, side, 1.1 * k, 0.25 * k);
      setElbow(out, side, ARMS_DOWN_ELBOW + 0.5 * k);
   }
   setTrunk(out, BONE.spine, 0.12 * k);
   return out;
}

/**
 * Knocked off its feet (a crash, a fall): both arms up and out, waving, the legs bent and apart,
 * the head shaking, in the air (`ground` 0: the game's group carries the tumble). `t` in seconds.
 */
export function flailPose(t: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   out.ground = 0;
   for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const f = Math.sin(t * 22 + i * 2.1);
      // the upper arm this far out from straight up (never closer than 0.65 rad: a wide head), waving,
      // the forearm bent further up and forward
      const v = 0.85 + 0.2 * f;
      aimArm(out, side, Math.sin(v), Math.cos(v), 0.35, Math.sin(v - 0.6), Math.cos(v - 0.6), 0.55);
      setLeg(out, side, 0.45 + 0.35 * f * side, 0.3);
      setKnee(out, side, 0.9 - 0.3 * f * side);
   }
   setTrunk(out, BONE.spine, 0.15);
   setTrunk(out, BONE.head, -0.2, 0.3 * Math.sin(t * 13));
   return out;
}

/** Wraps a phase into [0, 2π). */
export function wrapPhase(phase: number): number {
   const p = phase % TAU;
   return p < 0 ? p + TAU : p;
}

// ---------- what the rig applies ----------

/** A raised arm's clavicle turns by this share of the arm's elevation above level (a shrug). */
export const CLAVICLE_SHARE = 0.55;
/** ...of the elevation up to this (rad, 46° above level): higher, the shoulder rises no further (it would push the arm into a wide head). */
export const SHRUG_TOP = 0.8;

/**
 * The final local rotation of every bone (into `out`, 4 numbers per bone): the pose's `q`, with each
 * upper arm first lowered by its drop (to `armSpread` rad from straight down at drop 1), then its
 * clavicle shrugged by CLAVICLE_SHARE of the arm's elevation above level (0 for an arm at or below
 * level) while the arm keeps its direction in the chest's frame. This is what the skinned model's
 * bones get; pure, so tests can check it.
 */
export function resolvePose(pose: HumanoidPose, armSpread: number, out: Float32Array): Float32Array {
   if (out !== pose.q) out.set(pose.q);
   const hang = Math.PI / 2 - armSpread;
   for (let side = 1; side >= -1; side -= 2) {
      const bone = upperArm(side);
      // q_pose * rotZ(angle): the L arm turns down by -angle about z, the R arm by +angle
      const angle = -side * hang * (side > 0 ? pose.dropL : pose.dropR);
      const hz = Math.sin(angle / 2);
      const hw = Math.cos(angle / 2);
      const o = bone * 4;
      const qx = pose.q[o];
      const qy = pose.q[o + 1];
      const qz = pose.q[o + 2];
      const qw = pose.q[o + 3];
      // the arm in the chest's frame: (x, y, z, w) * (0, 0, hz, hw)
      const x = qx * hw + qy * hz;
      const y = qy * hw - qx * hz;
      const z = qz * hw + qw * hz;
      const w = qw * hw - qz * hz;
      // its elevation: the height of its outward axis (±x) after the rotation
      const up = side * 2 * (x * y + w * z);
      const elevation = Math.asin(up > 1 ? 1 : up < -1 ? -1 : up);
      const shrug = side * CLAVICLE_SHARE * (elevation < 0 ? 0 : elevation > SHRUG_TOP ? SHRUG_TOP : elevation);
      const cz = Math.sin(shrug / 2);
      const cw = Math.cos(shrug / 2);
      const c = clavicle(side) * 4;
      out[c] = 0;
      out[c + 1] = 0;
      out[c + 2] = cz;
      out[c + 3] = cw;
      // the arm under the clavicle: (0, 0, -cz, cw) * (x, y, z, w)
      out[o] = cw * x + cz * y;
      out[o + 1] = cw * y - cz * x;
      out[o + 2] = cw * z - cz * w;
      out[o + 3] = cw * w + cz * z;
   }
   return out;
}
