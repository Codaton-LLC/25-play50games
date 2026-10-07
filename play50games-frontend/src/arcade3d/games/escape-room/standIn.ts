// The primitive runner shown until runner.glb exists. Its limbs point where the rig's bones point,
// so the stand-in walks, reaches and cheers like the GLB will. Pure (no three.js, no React).
// Rig convention (core/rig): the runner faces +z, L = its left = +x. PrimitiveRunner puts armL/legL
// on +x too, so a bone drives the limb on its own side.
import { BONE } from "@/arcade3d/core/rig/humanoid";
import type { HumanoidPose } from "@/arcade3d/core/rig/poses";

export interface Dir3 {
   x: number;
   y: number;
   z: number;
}

/** (x, y, z) rotated by the quaternion q[o..o+3], into out. */
function rotate(q: ArrayLike<number>, o: number, x: number, y: number, z: number, out: Dir3): Dir3 {
   const qx = q[o];
   const qy = q[o + 1];
   const qz = q[o + 2];
   const qw = q[o + 3];
   const tx = 2 * (qy * z - qz * y);
   const ty = 2 * (qz * x - qx * z);
   const tz = 2 * (qx * y - qy * x);
   out.x = x + qw * tx + (qy * tz - qz * ty);
   out.y = y + qw * ty + (qz * tx - qx * tz);
   out.z = z + qw * tz + (qx * ty - qy * tx);
   return out;
}

/**
 * Unit direction, in the body's frame, of the upper arm on `side` (1 = L, +x) as the rig resolves
 * it: first lowered by its drop to `armSpread` rad out from straight down, then turned by its q.
 * (The clavicle shrug keeps this direction; the stand-in has no chest twist.)
 */
export function armDirection(pose: HumanoidPose, side: 1 | -1, armSpread: number, out: Dir3): Dir3 {
   const drop = side > 0 ? pose.dropL : pose.dropR;
   const a = (Math.PI / 2 - armSpread) * drop;
   return rotate(pose.q, (side > 0 ? BONE.upperArmL : BONE.upperArmR) * 4, side * Math.cos(a), -Math.sin(a), 0, out);
}

/** Unit direction, in the body's frame, of the upper leg on `side`: straight down, turned by the thigh, then the hips. */
export function legDirection(pose: HumanoidPose, side: 1 | -1, out: Dir3): Dir3 {
   rotate(pose.q, (side > 0 ? BONE.upperLegL : BONE.upperLegR) * 4, 0, -1, 0, out);
   return rotate(pose.q, BONE.hips * 4, out.x, out.y, out.z, out);
}

/**
 * The arm that reaches a target (dx, dz) away from a runner turned by `heading` (its rotation.y):
 * 1 = its left arm (+x local), -1 = its right arm.
 */
export function reachSide(heading: number, dx: number, dz: number): 1 | -1 {
   // the target along the runner's local +x: rotation.y = h turns local x to (cos h, 0, -sin h)
   const left = Math.cos(heading) * dx - Math.sin(heading) * dz;
   return left >= 0 ? 1 : -1;
}
