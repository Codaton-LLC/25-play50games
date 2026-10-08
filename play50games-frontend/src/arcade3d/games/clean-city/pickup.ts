// The cleaner's pickup (looks only): for the pickup window after each piece (poseWeights.ts
// reachWeight) the cleaner bends down towards it and reaches for it with the nearer hand. Pure, no
// three.js, no allocation (module scratch arrays), so Scene.tsx (Cleaner) rebuilds it every frame
// and pickup.test.ts / cleaner.test.ts check it on the core rig and on the real mesh.
//
// pickupPose(out, k, side, lx, lz, scratch) works on top of whatever `out` holds (the walk, the idle):
// - The stoop, by weight k: the pelvis tips forward at the hips, both thighs swing forward and both
//   knees bend (core turnBone, the feet kept flat with levelFoot), the spine and the chest lean
//   further and tip a little towards the reaching side, the trunk turns towards the piece. The
//   ground contact goes to 1 (a run's flight
//   lets go of the floor; a crouch keeps the lower sole on it), so bodyLift lowers the body over its
//   soles: the stoop lowers the cleaner, its feet stay on the floor.
// - The reach: the nearer arm (`side`, fixed at the pickup: 1 = its left, +x) points from its
//   shoulder (forward kinematics of the stooped trunk) to the piece's foot, never further out than a
//   hand's reach and never behind the shoulder or across the body, so it always reaches down and
//   forward (at least REACH_DOWN below level: never out level like the T-pose). The other arm hangs
//   straight down, its hand over the knee. Both with core aimArm (each segment its shortest turn: no
//   roll), blended in by k over the walk's arms.
// (lx, lz) is the piece's offset from the cleaner's centre in its own frame (world units, +z ahead,
// +x its left; localOffset). Scene.tsx recomputes it every frame from where the piece lay, so the hand
// follows it while the cleaner walks on over it.
import { BONE, POSE_MASK, aimArm, blendPoses, bodyLift, copyPose, humanoidJoints, levelFoot, turnBone, type HumanoidLandmarks, type HumanoidPose } from "@/arcade3d/core/rig";
import { mulQuat, rotateVec } from "@/arcade3d/core/rig/quat";
import { CLEANER_LANDMARKS } from "./assets";
import { CLEANER_SCALE } from "./gait";

/**
 * The stoop at weight 1 (rad): the pelvis tipped forward at the hips, the thighs forward (of
 * the upright: they take the pelvis's tip back), the knees bent, the spine and the chest further
 * forward, a tip towards the reaching side, the trunk's most turn towards the piece, the head up a little.
 */
export const STOOP = { hips: 0.4, thigh: 0.6, knee: 1.2, spine: 0.4, chest: 0.25, tilt: 0.16, turn: 0.45, head: -0.2 } as const;
/** The hand aims at this height over the floor at the piece (world units): low on it. */
export const REACH_Y = 0.15;
/** ...but never further out (horizontally, world units) from the shoulder than this... */
export const REACH_OUT = 0.36;
/** ...and never less than this far below level (rad): the reaching arm points down, never out level. */
export const REACH_DOWN = 0.9;
/** The hand may come in this far (world units) past its own shoulder towards the body's middle. */
export const REACH_IN = 0.07;
/** ...and stays at least this far ahead of the shoulder (world units). */
export const REACH_AHEAD = 0.04;

export interface LocalOffset {
   /** the piece's offset towards the cleaner's left (+x, world units) */
   x: number;
   /** ...and ahead of it (+z) */
   z: number;
}

/**
 * The world offset (dx, dz) from the cleaner to a piece in the cleaner's own frame, its group turned
 * by `heading` about +y (rules.ts RunnerState.heading: 0 = facing +z). Writes `out`.
 */
export function localOffset(dx: number, dz: number, heading: number, out: LocalOffset): LocalOffset {
   const c = Math.cos(heading);
   const s = Math.sin(heading);
   out.x = dx * c - dz * s;
   out.z = dx * s + dz * c;
   return out;
}

/** The hand that reaches for a piece at the cleaner's local x: the left (1) for a piece on its left or straight ahead. */
export function pickupSide(lx: number): 1 | -1 {
   return lx >= 0 ? 1 : -1;
}

const upperLeg = (side: number) => (side > 0 ? BONE.upperLegL : BONE.upperLegR);
const lowerLeg = (side: number) => (side > 0 ? BONE.lowerLegL : BONE.lowerLegR);
const upperArm = (side: number) => (side > 0 ? BONE.upperArmL : BONE.upperArmR);
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

const JOINTS = new Float64Array(17 * 3);
let jointsOf: HumanoidLandmarks | null = null;
/** the trunk's rotations from the root: [hips x spine, hips x spine x chest] */
const TRUNK = new Float64Array(8);
const V = new Float64Array(3);
const CHEST_INV = new Float64Array(4);
/** the last pickupPose's hand aim (character frame, GLB units, the body unlifted): shoulder xyz, target xyz */
export const PICKUP_AIM = new Float64Array(6);

function joints(l: HumanoidLandmarks): Float64Array {
   if (jointsOf !== l) {
      humanoidJoints(l, JOINTS);
      jointsOf = l;
   }
   return JOINTS;
}

/**
 * Where `side`'s shoulder joint is in `pose` (GLB units, the character's frame, the body unlifted)
 * into PICKUP_AIM[0..2], and the chest's rotation from the root into TRUNK[4..7]. The clavicle is
 * taken unturned (resolvePose shrugs it only for an arm above level; the reach is below).
 */
function shoulderOf(pose: HumanoidPose, l: HumanoidLandmarks, side: number): void {
   const j = joints(l);
   const q = pose.q;
   const h = BONE.hips * 3;
   const s = BONE.spine * 3;
   const c = BONE.chest * 3;
   const a = upperArm(side) * 3;
   rotateVec(q, BONE.hips * 4, j[s] - j[h], j[s + 1] - j[h + 1], j[s + 2] - j[h + 2], V, 0);
   let x = j[h] + V[0];
   let y = j[h + 1] + V[1];
   let z = j[h + 2] + V[2];
   mulQuat(q, BONE.hips * 4, q, BONE.spine * 4, TRUNK, 0);
   rotateVec(TRUNK, 0, j[c] - j[s], j[c + 1] - j[s + 1], j[c + 2] - j[s + 2], V, 0);
   x += V[0];
   y += V[1];
   z += V[2];
   mulQuat(TRUNK, 0, q, BONE.chest * 4, TRUNK, 4);
   rotateVec(TRUNK, 4, j[a] - j[c], j[a + 1] - j[c + 1], j[a + 2] - j[c + 2], V, 0);
   PICKUP_AIM[0] = x + V[0];
   PICKUP_AIM[1] = y + V[1];
   PICKUP_AIM[2] = z + V[2];
}

/** (x, y, z) in the character's frame -> the chest's frame (the inverse of TRUNK[4..7]) into V. */
function toChest(x: number, y: number, z: number): void {
   CHEST_INV[0] = -TRUNK[4];
   CHEST_INV[1] = -TRUNK[5];
   CHEST_INV[2] = -TRUNK[6];
   CHEST_INV[3] = TRUNK[7];
   rotateVec(CHEST_INV, 0, x, y, z, V, 0);
}

/**
 * The pickup on top of `out` (the walk or the idle), by weight `k` 0..1 (0 = `out` unchanged): the
 * stoop and the reach towards a piece at (lx, lz) (the cleaner's own frame, world units) with the
 * hand `side`. `scratch` is overwritten. `l` and `scale` are the cleaner's (the forward kinematics
 * and the lift are in GLB units). Allocation-free.
 */
export function pickupPose(
   out: HumanoidPose,
   k: number,
   side: 1 | -1,
   lx: number,
   lz: number,
   scratch: HumanoidPose,
   l: HumanoidLandmarks = CLEANER_LANDMARKS,
   scale: number = CLEANER_SCALE
): HumanoidPose {
   const w = clamp(k, 0, 1);
   if (w === 0) return out;
   // the stoop: legs bent (soles flat), the trunk forward, tipped and turned towards the piece
   // the pelvis tips forward at the hip joints; the thighs take it back and swing forward by STOOP.thigh
   turnBone(out, BONE.hips, STOOP.hips * w, 0, 0);
   for (let leg = 1; leg >= -1; leg -= 2) {
      turnBone(out, upperLeg(leg), -(STOOP.thigh + STOOP.hips) * w, 0, 0);
      turnBone(out, lowerLeg(leg), STOOP.knee * w, 0, 0);
      levelFoot(out, leg);
   }
   const turn = clamp(Math.atan2(lx, Math.max(0.05, lz)), -STOOP.turn, STOOP.turn) * w;
   turnBone(out, BONE.spine, STOOP.spine * w, turn * 0.6, -side * STOOP.tilt * w);
   turnBone(out, BONE.chest, STOOP.chest * w, turn * 0.4, 0);
   turnBone(out, BONE.head, STOOP.head * w, 0, 0);
   out.ground += (1 - out.ground) * w;
   out.lift *= 1 - w;

   // the reach: from the stooped shoulder to the piece's foot, within a hand's reach
   copyPose(out, scratch);
   const lift = bodyLift(out, l);
   shoulderOf(out, l, side);
   const sx = PICKUP_AIM[0];
   const sy = PICKUP_AIM[1];
   const sz = PICKUP_AIM[2];
   let dx = lx / scale - sx;
   let dz = lz / scale - sz;
   const dy = REACH_Y / scale - lift - sy;
   if (side * dx < -REACH_IN / scale) dx = (-side * REACH_IN) / scale;
   if (dz < REACH_AHEAD / scale) dz = REACH_AHEAD / scale;
   const reach = Math.hypot(dx, dz);
   const most = Math.max(0, Math.min(REACH_OUT / scale, -dy / Math.tan(REACH_DOWN)));
   if (reach > most) {
      dx *= most / reach;
      dz *= most / reach;
   }
   PICKUP_AIM[3] = sx + dx;
   PICKUP_AIM[4] = sy + dy;
   PICKUP_AIM[5] = sz + dz;
   // the arm (in the chest's frame): the forearm at the piece, the elbow a little bent, back
   toChest(dx, dy, dz);
   const len = Math.hypot(V[0], V[1], V[2]) || 1;
   const fx = V[0] / len;
   const fy = V[1] / len;
   const fz = V[2] / len;
   aimArm(scratch, side, side * fx + 0.04, fy, fz - 0.14, side * fx, fy, fz);
   // the other arm hangs straight down (the world's down), the hand forward over its knee
   toChest(-side * 0.08, -1, -0.05);
   const ux = -side * V[0];
   const uy = V[1];
   const uz = V[2];
   toChest(-side * 0.02, -1, 0.45);
   aimArm(scratch, -side as 1 | -1, ux, uy, uz, -side * V[0], V[1], V[2]);
   return blendPoses(out, scratch, w, out, POSE_MASK.arms);
}
