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
// - `lift` is a vertical offset of the whole body as a fraction of the hip height (-0.03 = a 3 % dip):
//   the walk's bob, a crouch.
// - Helpers below speak in body terms: forward (+z) swings, outward (away from the body) swings,
//   elbow and knee bends (positive = the natural way), twist (positive = turn left), lean.
import { BONE, BONE_COUNT, BONE_MIRROR } from "./humanoid";

export interface HumanoidPose {
   /** one quaternion (x, y, z, w) per bone, HUMANOID_BONES order */
   q: Float32Array;
   /** 0 = the left arm straight out (T-pose), 1 = hanging at the character's armSpread */
   dropL: number;
   /** the same for the right arm */
   dropR: number;
   /** vertical offset of the body, as a fraction of the hip height */
   lift: number;
}

/** Per-bone factors for blendPoses (HUMANOID_BONES order): 1 = take the other pose, 0 = keep. */
export type PoseMask = readonly number[];

const mask = (bones: number[]): PoseMask => Array.from({ length: BONE_COUNT }, (_v, i) => (bones.includes(i) ? 1 : 0));

/** Common masks: arms (both arms, and the arm drops), legs (both legs, and the lift), upper body. */
export const POSE_MASK = {
   all: mask([...Array(BONE_COUNT).keys()]),
   arms: mask([BONE.upperArmL, BONE.lowerArmL, BONE.upperArmR, BONE.lowerArmR]),
   legs: mask([BONE.hips, BONE.upperLegL, BONE.lowerLegL, BONE.upperLegR, BONE.lowerLegR]),
   upper: mask([BONE.spine, BONE.chest, BONE.neck, BONE.head, BONE.upperArmL, BONE.lowerArmL, BONE.upperArmR, BONE.lowerArmR]),
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

// side: +1 = L (+x), -1 = R (-x)
const upperArm = (side: number) => (side > 0 ? BONE.upperArmL : BONE.upperArmR);
const lowerArm = (side: number) => (side > 0 ? BONE.lowerArmL : BONE.lowerArmR);
const upperLeg = (side: number) => (side > 0 ? BONE.upperLegL : BONE.upperLegR);
const lowerLeg = (side: number) => (side > 0 ? BONE.lowerLegL : BONE.lowerLegR);

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

/**
 * Points an arm exactly, from the T-pose (its drop becomes 0): the upper arm along (ux, uy, uz), the
 * forearm along (fx, fy, fz), both in the chest's frame and written for the left arm (+x = away
 * from the body); the right arm mirrors x. The upper arm turns about its own axis so the elbow
 * bends in the plane of the two directions. Directions need not be unit length. `roll` turns the
 * forearm and hand about their own axis (rad, the same for both sides): a flat hand bent in towards
 * the head lies across it, π/2 turns it edge-on.
 */
export function aimArm(out: HumanoidPose, side: 1 | -1, ux: number, uy: number, uz: number, fx: number, fy: number, fz: number, roll = 0): void {
   ux *= side;
   fx *= side;
   let len = Math.hypot(ux, uy, uz) || 1;
   ux /= len;
   uy /= len;
   uz /= len;
   const along = fx * ux + fy * uy + fz * uz;
   // the bend direction: the forearm's part across the upper arm (forward when the arm is straight)
   let bx = fx - along * ux;
   let by = fy - along * uy;
   let bz = fz - along * uz;
   const across = Math.hypot(bx, by, bz);
   if (across < 1e-6) {
      // straight arm: any bend plane; keep the T-pose front (+z) as far as it goes (else up)
      const front = Math.abs(uz) < 0.999;
      bx = front ? -uz * ux : -uy * ux;
      by = front ? -uz * uy : 1 - uy * uy;
      bz = front ? 1 - uz * uz : -uy * uz;
   }
   len = Math.hypot(bx, by, bz) || 1;
   bx /= len;
   by /= len;
   bz /= len;
   // rotation columns: local x -> the arm's way out (u for L, -u for R), local z -> b, local y = z cross x
   const xx = side * ux;
   const xy = side * uy;
   const xz = side * uz;
   const yx = by * xz - bz * xy;
   const yy = bz * xx - bx * xz;
   const yz = bx * xy - by * xx;
   setBoneMatrix(out.q, upperArm(side), xx, yx, bx, xy, yy, by, xz, yz, bz);
   if (side > 0) out.dropL = 0;
   else out.dropR = 0;
   // the lower arm: rolled about its own axis (x) first, then bent about y like setElbow
   const half = (-side * Math.atan2(across, along)) / 2;
   const sy = Math.sin(half);
   const cy = Math.cos(half);
   const sx = Math.sin(roll / 2);
   const cx = Math.cos(roll / 2);
   const o = lowerArm(side) * 4;
   out.q[o] = cy * sx;
   out.q[o + 1] = sy * cx;
   out.q[o + 2] = -sy * sx;
   out.q[o + 3] = cy * cx;
}

/** Bone `bone`'s rotation from a rotation matrix (row-major m11..m33). */
function setBoneMatrix(q: Float32Array, bone: number, m11: number, m12: number, m13: number, m21: number, m22: number, m23: number, m31: number, m32: number, m33: number): void {
   const o = bone * 4;
   const trace = m11 + m22 + m33;
   if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1);
      q[o + 3] = 0.25 / s;
      q[o] = (m32 - m23) * s;
      q[o + 1] = (m13 - m31) * s;
      q[o + 2] = (m21 - m12) * s;
   } else if (m11 > m22 && m11 > m33) {
      const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
      q[o + 3] = (m32 - m23) / s;
      q[o] = 0.25 * s;
      q[o + 1] = (m12 + m21) / s;
      q[o + 2] = (m13 + m31) / s;
   } else if (m22 > m33) {
      const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
      q[o + 3] = (m13 - m31) / s;
      q[o] = (m12 + m21) / s;
      q[o + 1] = 0.25 * s;
      q[o + 2] = (m23 + m32) / s;
   } else {
      const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
      q[o + 3] = (m21 - m12) / s;
      q[o] = (m13 + m31) / s;
      q[o + 1] = (m23 + m32) / s;
      q[o + 2] = 0.25 * s;
   }
}

/** A trunk bone: `lean` > 0 tips its top forward, `twist` > 0 turns it left, `tilt` > 0 tips it to its right. */
function setTrunk(out: HumanoidPose, bone: number, lean: number, twist = 0, tilt = 0): void {
   setBoneEuler(out.q, bone, lean, twist, tilt);
}

// ---------- the basics ----------

/** A new pose object: the rest pose (T-pose). */
export function createPose(): HumanoidPose {
   return restPose({ q: new Float32Array(BONE_COUNT * 4), dropL: 0, dropR: 0, lift: 0 });
}

/** The T-pose as modelled (every bone unrotated, arms straight out). */
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
   return out;
}

/**
 * a -> b by k (0 = a, 1 = b), per bone (normalised lerp along the shorter way), into `out` (may be
 * `a` or `b`). With a mask, bone i blends by k * mask[i]; the arm drops follow the upper arms' mask
 * and the lift the hips'.
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
   return out;
}

// ---------- motion ----------

/** Standing still and breathing: armsDown with a slow breath, a small sway and a glance. `t` in seconds. */
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
   out.lift = 0.004 * breath;
   return out;
}

/**
 * One stride of a walk or a run. `phase` (rad) goes once round per stride (two steps): the left
 * leg is fully forward at π/2, the right one at 3π/2, and phase + π is the mirror image. Advance it
 * with the distance walked (phase += distance / strideLength * 2π) so the feet do not slide.
 * `amount` 0..1: 0 = armsDownPose exactly, about 0.5 = a walk, 1 = a run (wider swings, knees and
 * elbows bent further, a forward lean, a bigger bob). The legs swing about x and the knee folds as
 * the leg comes back and forward again; the arms swing opposite to the legs with bent elbows; the
 * chest counter-twists against the hips; `lift` bobs twice per stride (lowest at the long stride of
 * a walk, highest in a run's flight).
 */
export function walkPose(phase: number, amount: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   const a = clamp01(amount);
   if (a === 0) return out;
   const s = Math.sin(phase);
   const c = Math.cos(phase);
   const legSwing = 0.72 * a;
   const kneeFold = a * (0.6 + 0.9 * a);
   const armSwing = a * (0.45 + 0.45 * a);
   const elbow = ARMS_DOWN_ELBOW + a * (0.25 + 1.0 * a);

   for (let side = 1; side >= -1; side -= 2) {
      // the right leg is half a stride behind the left
      const ls = side * s;
      setLeg(out, side, legSwing * ls, 0.03 * a);
      // folds most between push-off (leg back) and mid-swing (leg passing under the body): at
      // phase -π/4 for the left leg, half a stride later for the right
      const fold = (1 + side * Math.cos(phase + Math.PI / 4)) / 2;
      setKnee(out, side, 0.08 * a + kneeFold * fold * fold);
      // the arm goes the other way, its elbow bends a little more on the way forward
      const forward = -armSwing * ls;
      setArm(out, side, forward, 0.05 * a);
      setElbow(out, side, elbow + 0.2 * a * Math.max(0, -ls));
   }
   setTrunk(out, BONE.hips, 0, -0.12 * a * s);
   setTrunk(out, BONE.spine, 0.06 * a, 0.06 * a * s);
   setTrunk(out, BONE.chest, 0.02 * a, 0.14 * a * s);
   setTrunk(out, BONE.neck, -0.04 * a);
   setTrunk(out, BONE.head, -0.02 * a, -0.08 * a * s);

   const run = smooth01((a - 0.5) / 0.4);
   const walkBob = -(1 - Math.abs(c));
   const runBob = -(1 - Math.abs(s));
   out.lift = 0.045 * a * lerp(walkBob, runBob, run);
   return out;
}

/**
 * Both arms holding something: `height` 0 = forearms forward at the chest (a box in front),
 * 1 = arms up overhead (a box over the head), smooth in between. Legs as in armsDownPose.
 */
export function carryPose(height: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   const h = smooth01(height);
   // aimed exactly (from the T-pose): upper arms down-forward -> up and out past the head,
   // forearms level and forward -> straight up beside it, hands edge-on (rolled), under the load's edges
   const ux = lerp(0.1, 0.75, h);
   const uy = lerp(-0.8, 0.65, h);
   const uz = lerp(0.45, 0.1, h);
   const fx = lerp(-0.15, 0.04, h);
   const fy = lerp(0.15, 1, h);
   const fz = lerp(1, 0.08, h);
   const roll = (Math.PI / 2) * h;
   aimArm(out, 1, ux, uy, uz, fx, fy, fz, roll);
   aimArm(out, -1, ux, uy, uz, fx, fy, fz, roll);
   setTrunk(out, BONE.spine, -0.04 * h);
   setTrunk(out, BONE.head, 0.06 * h);
   return out;
}

/**
 * One arm reaching out to its side: `side` 1 = the left (+x), -1 = the right; `height` 0 = out
 * level (straight out, as in the T-pose), 1 = straight up. The other arm hangs; the body leans a
 * little towards the reach.
 */
export function reachPose(side: 1 | -1, height: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   const h = clamp01(height);
   // the reaching arm from the T-pose (drop 0), so level and straight up are exact for every body
   if (side > 0) out.dropL = 0;
   else out.dropR = 0;
   setBoneEuler(out.q, upperArm(side), 0, 0, side * h * (Math.PI / 2));
   setElbow(out, side, 0.08);
   setArm(out, -side, 0, 0.06);
   setTrunk(out, BONE.spine, 0, 0, -side * 0.06);
   setTrunk(out, BONE.head, 0, side * 0.15, 0);
   return out;
}

/** A win: both arms up in a V, waving, the head back a little. `t` in seconds. */
export function cheerPose(t: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   for (let side = 1; side >= -1; side -= 2) {
      setArm(out, side, 0.25, 2.25 + 0.18 * Math.sin(t * 9 + (side > 0 ? 0 : Math.PI)));
      setElbow(out, side, 0.35);
   }
   setTrunk(out, BONE.spine, -0.06);
   setTrunk(out, BONE.head, -0.15);
   return out;
}

/** In the air: `tuck` 0..1 pulls the knees up and the arms up and forward. */
export function jumpPose(tuck: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
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

/** Wraps a phase into [0, 2π). */
export function wrapPhase(phase: number): number {
   const p = phase % TAU;
   return p < 0 ? p + TAU : p;
}

// ---------- what the rig applies ----------

/**
 * The final local rotation of every bone (into `out`, 4 numbers per bone): the pose's `q`, with each
 * upper arm first lowered by its drop (to `armSpread` rad from straight down at drop 1). This is
 * what the skinned model's bones get; pure, so tests can check it.
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
      const x = pose.q[o];
      const y = pose.q[o + 1];
      const z = pose.q[o + 2];
      const w = pose.q[o + 3];
      // (x, y, z, w) * (0, 0, hz, hw)
      out[o] = x * hw + y * hz;
      out[o + 1] = y * hw - x * hz;
      out[o + 2] = z * hw + w * hz;
      out[o + 3] = w * hw - z * hz;
   }
   return out;
}
