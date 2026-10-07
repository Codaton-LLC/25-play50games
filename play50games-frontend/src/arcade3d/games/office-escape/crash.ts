// Office Escape's crash, looks only (the run is already over): the runner is knocked back onto its
// back (diagonally, towards the middle, so it stays in view), bounces, and flails. Pure, no three.js,
// no allocation, so Scene.tsx draws from it and crash.test.ts checks it on the real runner.glb.
import { BONE, flailPose, setBoneEuler, type HumanoidPose } from "@/arcade3d/core/rig";

export const CRASH = {
   /** the fall onto the back takes this long (s), then the bounce */
   fallS: 0.45,
   /** the arc of the fall (m at its top) and the body's rest height on its back (m: its thickness) */
   arc: 0.4,
   lift: 0.12,
   /** the tilt onto the back (rad about x) and the bounce's tilt (rad, decaying) */
   tilt: 1.42,
   bounce: 0.07,
   /** knock-back (m) and the turn towards the middle (rad); the body stays above the screen's bottom edge */
   back: 0.25,
   yaw: 0.6,
   /** the crash pose takes over the limbs this quickly (s) once the runner is hit */
   poseS: 0.25,
} as const;

export interface CrashPlacement {
   /** the fall's eased progress 0..1 */
   e: number;
   /** the group's height (m) and knock-back (m) */
   y: number;
   z: number;
   /** the group's tilt onto its back (rad about x, Euler "YXZ") and its turn (rad about y) */
   tilt: number;
   yaw: number;
}

/**
 * The runner group's place `k` seconds after the crash, from the height of its feet at the hit
 * (`feet` m: mid-leap or 0) and the way it turns (`turn` +1 / -1: towards the middle), into `out`.
 */
export function crashPlacement(k: number, feet: number, turn: number, out: CrashPlacement): CrashPlacement {
   const f = Math.min(1, k / CRASH.fallS);
   const e = 1 - (1 - f) ** 3;
   const after = k - CRASH.fallS;
   const bounce = after > 0 ? Math.sin(after * 14) * CRASH.bounce * Math.exp(-after * 5) : 0;
   out.e = e;
   out.y = feet * (1 - f) + Math.sin(f * Math.PI) * CRASH.arc + CRASH.lift * e;
   out.z = CRASH.back * e;
   out.tilt = CRASH.tilt * e + bounce;
   out.yaw = turn * CRASH.yaw * e;
   return out;
}

/**
 * The GLB runner's limbs on its back: core flailPose's waving arms and shaking head, with the legs
 * raised and kicking (the thighs swung up off the floor, the knees a little bent), so neither shin
 * folds down through the floor the body lies on. (flailPose's own legs bend back at the knee, which
 * suits an upright tumble: obstacle-race.) `t` in seconds.
 */
export function crashPose(t: number, out: HumanoidPose): HumanoidPose {
   flailPose(t, out);
   for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const f = Math.sin(t * 22 + i * 2.1);
      setBoneEuler(out.q, side > 0 ? BONE.upperLegL : BONE.upperLegR, -(1.0 + 0.2 * f * side), 0, side * 0.3);
      setBoneEuler(out.q, side > 0 ? BONE.lowerLegL : BONE.lowerLegR, 0.4 - 0.1 * f * side, 0, 0);
   }
   return out;
}
