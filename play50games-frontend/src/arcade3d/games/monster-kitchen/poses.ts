// The chef's poses (pure, no allocation; core/README "Driving a character"): the reach-and-throw over
// the wheel's back arc and the cheer blend, built from the core rig helpers. The throw is driven by a
// small two-bone IK (the measured CHEF_LANDMARKS arm segments) along explicit chest-frame keypoints:
// ready hands over the wheel -> hover on the back-slot ring (the grab) -> swing up-forward at the pot
// -> back to ready. The chef never idles with hanging arms: his rest is a ready stance with the hands
// poised above the wheel — a continuous throw arc must stay clear of the wheel disc, a thin slab at
// counter height spanning the whole floor behind the counter, and that is only possible if the hands
// are already above it at rest (the disc radius reaches the chef's sides). Elbow poles keep the elbow
// out-down reaching and up swinging. Checked on the real mesh in poses.test.ts.
import {
   BONE,
   POSE_MASK,
   aimArm,
   armsDownPose,
   blendPoses,
   carryPose,
   cheerPose,
   idlePose,
   turnBone,
   type HumanoidPose,
} from "@/arcade3d/core/rig";
import { WHEEL } from "./rules";

/** Where the chef stands (m), behind the wheel, facing the cauldron. */
export const CHEF_POS = { x: -2.0, y: 0, z: -0.75 };
/** The chef faces the cauldron mouth: +x and a touch +z. */
export const CHEF_YAW = Math.atan2(2, 0.65);
/** The wheel's back-slot ring the reach reads over (m, world); the hand hovers just above it. */
export const BACK_SLOT_RING = { x: WHEEL.x, y: WHEEL.y + 0.13, z: -0.7 };

const smooth01 = (v: number): number => {
   const t = v < 0 ? 0 : v > 1 ? 1 : v;
   return t * t * (3 - 2 * t);
};

// ---------- the throw IK (GLB units, the chest frame; the right shoulder and the two arm segments
// from CHEF_LANDMARKS: elbowX - shoulderX = wristX - elbowX = 0.238) ----------

const SHOULDER = { x: -0.27, y: 1.138, z: 0.021 };
const SEG = 0.238;
/** the hand centroid sits this far past the wrist, along the forearm */
const HAND = 0.1;

/**
 * The hand-centroid keypoints (chest frame) and elbow poles: ready hands poised over the wheel, the
 * grab hovering on the back-slot ring, the toss swinging up-forward at the pot, then back to ready.
 * Every inside-the-disc-footprint point of the arc stays above the disc's slab. Poles: out-down
 * reaching, up swinging.
 */
const KEYS = [
   { t: 0.0, c: { x: -0.181, y: 1.02, z: 0.29 }, p: { x: -0.6, y: -0.75, z: -0.2 } },
   { t: 0.35, c: { x: -0.044, y: 1.007, z: -0.148 }, p: { x: -0.8, y: -0.3, z: -0.5 } },
   { t: 0.55, c: { x: -0.116, y: 1.233, z: 0.614 }, p: { x: -0.85, y: -0.2, z: -0.45 } },
   { t: 0.78, c: { x: -0.16, y: 1.12, z: 0.42 }, p: { x: -0.7, y: -0.3, z: -0.35 } },
   { t: 1.0, c: { x: -0.181, y: 1.02, z: 0.29 }, p: { x: -0.6, y: -0.75, z: -0.2 } },
] as const;

/** The solved upper/fore directions (chest frame, right arm), written by solveArm. */
const IK = { ux: 0, uy: 0, uz: 0, fx: 0, fy: 0, fz: 0 };

/** Two-bone solve: place the wrist so the centroid lands on (tx, ty, tz), the elbow toward the pole. */
function solveArm(tx: number, ty: number, tz: number, px: number, py: number, pz: number): void {
   // the wrist sits HAND back along the forearm; approximate the forearm by the shoulder->centroid line
   const gx = tx - SHOULDER.x;
   const gy = ty - SHOULDER.y;
   const gz = tz - SHOULDER.z;
   const gl = Math.hypot(gx, gy, gz) || 1;
   const wx = tx - (gx / gl) * HAND;
   const wy = ty - (gy / gl) * HAND;
   const wz = tz - (gz / gl) * HAND;
   let dx = wx - SHOULDER.x;
   let dy = wy - SHOULDER.y;
   let dz = wz - SHOULDER.z;
   let d = Math.hypot(dx, dy, dz);
   if (d < 0.1) d = 0.1;
   if (d > SEG * 1.98) d = SEG * 1.98;
   const dl = Math.hypot(dx, dy, dz) || 1;
   const nx = dx / dl;
   const ny = dy / dl;
   const nz = dz / dl;
   // equal segments: the elbow circle's foot sits at the midpoint, h the half-chord
   const a = d / 2;
   const h = Math.sqrt(Math.max(0, SEG * SEG - a * a));
   const dot = px * nx + py * ny + pz * nz;
   let ex = px - dot * nx;
   let ey = py - dot * ny;
   let ez = pz - dot * nz;
   const el = Math.hypot(ex, ey, ez) || 1;
   ex /= el;
   ey /= el;
   ez /= el;
   const eX = SHOULDER.x + nx * a + ex * h;
   const eY = SHOULDER.y + ny * a + ey * h;
   const eZ = SHOULDER.z + nz * a + ez * h;
   IK.ux = (eX - SHOULDER.x) / SEG;
   IK.uy = (eY - SHOULDER.y) / SEG;
   IK.uz = (eZ - SHOULDER.z) / SEG;
   IK.fx = (wx - eX) / SEG;
   IK.fy = (wy - eY) / SEG;
   IK.fz = (wz - eZ) / SEG;
}

/**
 * The throw at progress k (0..1) into `out`: 0..0.35 the hand comes down onto the back-slot ring (the
 * grab), 0.35..0.55 the toss swings up-forward at the pot, 0.55..1 it settles back to ready hands. One
 * aimArm solves the arm each step — blending two solved poses lerps the quaternions through wild
 * middle poses. `scratch` is kept for the caller's pose pool.
 */
export function reachThrowPose(k: number, out: HumanoidPose, scratch: HumanoidPose): void {
   const t = k < 0 ? 0 : k > 1 ? 1 : k;
   armsDownPose(out);
   let i = 0;
   while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
   const k0 = KEYS[i];
   const k1 = KEYS[i + 1];
   const m = smooth01(k1.t === k0.t ? 1 : (t - k0.t) / (k1.t - k0.t));
   const tx = k0.c.x + (k1.c.x - k0.c.x) * m;
   const ty = k0.c.y + (k1.c.y - k0.c.y) * m;
   const tz = k0.c.z + (k1.c.z - k0.c.z) * m;
   const px = k0.p.x + (k1.p.x - k0.p.x) * m;
   const py = k0.p.y + (k1.p.y - k0.p.y) * m;
   const pz = k0.p.z + (k1.p.z - k0.p.z) * m;
   solveArm(tx, ty, tz, px, py, pz);
   // aimArm mirrors x for the right arm internally (side -1)
   aimArm(out, -1, -IK.ux, IK.uy, IK.uz, -IK.fx, IK.fy, IK.fz);
}

export interface ChefLook {
   /** 0..1 through the throw, or < 0 when the chef is not throwing */
   throwK: number;
   /** 0..1 cheer blend after a serve */
   cheer: number;
}

/**
 * The chef's pose this frame: the ready stance (idle with the forearms carried forward, the hands
 * poised over the wheel — never hanging arms inside the disc footprint), the throw blended in over
 * its envelope (through the carry so the arm never swings out level past the T reach), then the
 * cheer. `reach`, `carry` and `cheer` are scratch poses (createPose).
 */
export function chefPose(look: ChefLook, now: number, out: HumanoidPose, reach: HumanoidPose, carry: HumanoidPose, cheer: HumanoidPose): void {
   idlePose(now, out);
   blendPoses(out, carryPose(0.3, carry), 0.85, out, POSE_MASK.arms);
   if (look.throwK >= 0) {
      const w = 1 - (2 * look.throwK - 1) ** 2;
      reachThrowPose(look.throwK, reach, cheer);
      blendPoses(out, reach, w, out, POSE_MASK.arms);
      turnBone(out, BONE.spine, 0.1 * w, 0, 0);
   }
   if (look.cheer > 0.001) blendPoses(out, cheerPose(now, cheer), look.cheer, out, POSE_MASK.arms);
}
