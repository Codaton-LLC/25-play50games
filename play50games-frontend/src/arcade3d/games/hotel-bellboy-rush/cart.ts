// The luggage cart and the bellboy's hold on it. Pure: no three.js, React or DOM. rules.ts steps the
// cart (stepTrolley, looks only); Scene.tsx reads the grips and aims the arms with reachArm.
//
// He pulls the cart behind him by a brass T-handle on a short tow bar, both hands on the grip low
// behind his back. Pulled, not pushed: walking up to a door, the desk or the pad he faces the wall with
// nothing in front of him and the cart always has the free floor he came over behind him (pushed, it
// would sink a metre into the wall at every door). The tow bar is needed because the GLB's deck
// overhangs its crossbars by 0.21 m at shin height: a grip on the crossbar itself (within arm's reach)
// would put the deck edge 0.15 m behind his heels, inside every stride; on the tow bar it is 0.60 m back.
// The cart is a trailer: the grip hangs on a hitch HITCH behind his centre (a stiff critically damped
// spring: no lag at a steady walk, a few cm on a start or a stop); the cart heads from its rear axle to
// the grip (the T-grip swivels on the tow bar), so it pivots instead of sliding sideways, at most
// MAX_SWING off his heading (a turn on the
// spot carries it round with him), and its far end scrapes along walls and decor by turning about the grip.
import { BONE, type HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import { aimArm, type HumanoidPose } from "@/arcade3d/core/rig/poses";
import { rotateVec } from "@/arcade3d/core/rig/quat";

// ---------- the cart (bellboyTrolleyV3T.glb at its 1.30 m fit, metres, the cart's own frame: +z = towards him) ----------

/** The crossbars' height: the top rails of the frame (GLB y 1.25-1.36 x 0.6835). */
export const HANDLE_Y = 0.89;
/** Cart centre to the near crossbar along the cart (GLB z 0.54). */
export const HANDLE_AHEAD = 0.369;
/** The tow bar: from the near crossbar's middle straight out towards him, at the crossbar's height. */
export const TOW = 0.45;
/** Cart centre to the T-grip's middle. */
export const GRIP_AHEAD = HANDLE_AHEAD + TOW;
/** The T-grip's length, and where each hand holds it (from its middle). */
export const GRIP_LENGTH = 0.4;
export const GRIP_HALF = 0.14;
/** The palm's centre sits this far over the grip's centre line (the glove wraps it from above). */
export const GRIP_ABOVE = 0.03;

// ---------- the hitch ----------

/** His centre to the T-grip's middle, straight behind him (m). Hands low behind the back, elbows a little bent. */
export const HITCH = 0.36;
/** His centre to the cart's centre when it is straight behind him (1.18 m). */
export const CART_GAP = HITCH + GRIP_AHEAD;
/** The cart's centre to its fixed rear axle (the trailer pivot), along the cart. */
export const AXLE_BACK = 0.45;
/** The cart's heading may differ from his by at most this (rad); a sharper turn carries it round. */
export const MAX_SWING = 0.9;
/** The hitch spring (critically damped, rad/s squared): about 5 cm of lag at his full 22 m/s² start. */
export const HITCH_STIFFNESS = 400;
/** The far end's collision circle: this far behind the centre, this radius (it covers the base's far end). */
export const REAR_BACK = 0.25;
export const REAR_RADIUS = 0.36;

const wrap = (a: number) => {
   let d = a % (2 * Math.PI);
   if (d > Math.PI) d -= 2 * Math.PI;
   if (d < -Math.PI) d += 2 * Math.PI;
   return d;
};
export const clampSwing = (cartYaw: number, heroYaw: number) => heroYaw + Math.max(-MAX_SWING, Math.min(MAX_SWING, wrap(cartYaw - heroYaw)));

/** The hitch point (world x, z) for a hero at (x, z) facing yaw: HITCH straight behind him. */
export function hitchPoint(x: number, z: number, yaw: number, out: { x: number; z: number }): { x: number; z: number } {
   out.x = x - Math.sin(yaw) * HITCH;
   out.z = z - Math.cos(yaw) * HITCH;
   return out;
}

/**
 * A hand's place on the T-grip, in world space. The tow bar is rigid along the cart (its middle line);
 * the T-grip swivels on its end and stays square to his back (`heroYaw`): `side` 1 = his left hand,
 * -1 = his right.
 */
export function gripPoint(cartX: number, cartZ: number, cartYaw: number, heroYaw: number, side: 1 | -1, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = cartX + Math.sin(cartYaw) * GRIP_AHEAD + Math.cos(heroYaw) * side * GRIP_HALF;
   out.y = HANDLE_Y + GRIP_ABOVE;
   out.z = cartZ + Math.cos(cartYaw) * GRIP_AHEAD - Math.sin(heroYaw) * side * GRIP_HALF;
   return out;
}

/**
 * A world point into the bellboy's skinned frame (GLB units: +z forward, +x his left, y up from the
 * soles of the unlifted body): his position and yaw, the body group's lift (m) and the model scale.
 */
export function toBodyFrame(
   heroX: number,
   heroZ: number,
   heroYaw: number,
   lift: number,
   scale: number,
   wx: number,
   wy: number,
   wz: number,
   out: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
   const dx = wx - heroX;
   const dz = wz - heroZ;
   const s = Math.sin(heroYaw);
   const c = Math.cos(heroYaw);
   out.x = (dx * c - dz * s) / scale;
   out.y = (wy - lift) / scale;
   out.z = (dx * s + dz * c) / scale;
   return out;
}

// ---------- the arm: two-bone IK onto aimArm ----------

/** The palm's centre past the wrist (GLB units, along the T-pose arm): where a grip sits. */
export const PALM = 0.07;

const R = new Float64Array(4);
const T = new Float64Array(4);
const V = new Float64Array(3);
const P = new Float64Array(3);

/** R = R * q (bone b of pose), in place. */
function mulInto(q: Float32Array, b: number): void {
   const o = b * 4;
   const ax = R[0];
   const ay = R[1];
   const az = R[2];
   const aw = R[3];
   const bx = q[o];
   const by = q[o + 1];
   const bz = q[o + 2];
   const bw = q[o + 3];
   R[0] = aw * bx + ax * bw + ay * bz - az * by;
   R[1] = aw * by - ax * bz + ay * bw + az * bx;
   R[2] = aw * bz + ax * by - ay * bx + az * bw;
   R[3] = aw * bw - ax * bx - ay * by - az * bz;
}

/**
 * The shoulder joint of arm `side` and the chest's turn for `pose` (forward kinematics through hips,
 * spine and chest; the clavicle stays level for an arm at or below level, as resolvePose leaves it).
 * Into `shoulder` (GLB units, unlifted body frame); the chest's quaternion is left in R.
 */
function shoulderOf(pose: HumanoidPose, l: HumanoidLandmarks, side: 1 | -1, shoulder: Float64Array): void {
   R[0] = 0;
   R[1] = 0;
   R[2] = 0;
   R[3] = 1;
   mulInto(pose.q, BONE.hips);
   rotateVec(R, 0, 0, l.spineY - l.hipY, 0, V, 0);
   let x = V[0];
   let y = l.hipY + V[1];
   let z = l.spineZ + V[2];
   mulInto(pose.q, BONE.spine);
   rotateVec(R, 0, 0, l.chestY - l.spineY, 0, V, 0);
   x += V[0];
   y += V[1];
   z += V[2];
   mulInto(pose.q, BONE.chest);
   rotateVec(R, 0, side * l.shoulderX, l.shoulderY - l.chestY, l.shoulderZ - l.spineZ, V, 0);
   shoulder[0] = x + V[0];
   shoulder[1] = y + V[1];
   shoulder[2] = z + V[2];
}

const SH = new Float64Array(3);

/**
 * Aims arm `side` (1 = left, -1 = right) of `pose` so its palm reaches (tx, ty, tz) (GLB units, the
 * unlifted body frame), the elbow bent towards the pole (px, py, pz) (the chest's frame, written for
 * the left arm: +x = out from the body; the right arm mirrors it). Uses the pose's own hips, spine and
 * chest, so call it after the trunk is set. A target out of reach gets the arm pointing at it, straight.
 * Returns the target's distance over the arm's full length (> 1 = out of reach). Allocation-free.
 */
export function reachArm(pose: HumanoidPose, l: HumanoidLandmarks, side: 1 | -1, tx: number, ty: number, tz: number, px: number, py: number, pz: number): number {
   shoulderOf(pose, l, side, SH);
   // into the chest's frame: R^-1 (target - shoulder)
   T[0] = -R[0];
   T[1] = -R[1];
   T[2] = -R[2];
   T[3] = R[3];
   rotateVec(T, 0, tx - SH[0], ty - SH[1], tz - SH[2], V, 0);
   // the left arm's convention: +x = out from the body
   const vx = side * V[0];
   const vy = V[1];
   const vz = V[2];
   const a = l.elbowX - l.shoulderX;
   const b = l.wristX - l.elbowX + PALM;
   const d = Math.hypot(vx, vy, vz) || 1e-9;
   const nx = vx / d;
   const ny = vy / d;
   const nz = vz / d;
   const reach = Math.min((a + b) * 0.999, Math.max(Math.abs(a - b) + 1e-4, d));
   const cosA = Math.max(-1, Math.min(1, (a * a + reach * reach - b * b) / (2 * a * reach)));
   const sinA = Math.sqrt(1 - cosA * cosA);
   // the pole's part across the shoulder-to-target line
   const pd = px * nx + py * ny + pz * nz;
   P[0] = px - nx * pd;
   P[1] = py - ny * pd;
   P[2] = pz - nz * pd;
   let pl = Math.hypot(P[0], P[1], P[2]);
   if (pl < 1e-6) {
      // the pole lies along the line: bend outwards instead
      P[0] = 1 - nx * nx;
      P[1] = -ny * nx;
      P[2] = -nz * nx;
      pl = Math.hypot(P[0], P[1], P[2]) || 1;
   }
   const ux = nx * cosA + (P[0] / pl) * sinA;
   const uy = ny * cosA + (P[1] / pl) * sinA;
   const uz = nz * cosA + (P[2] / pl) * sinA;
   // the forearm: from the elbow to the palm
   const fx = nx * reach - ux * a;
   const fy = ny * reach - uy * a;
   const fz = nz * reach - uz * a;
   aimArm(pose, side, ux, uy, uz, fx, fy, fz);
   return d / (a + b);
}
