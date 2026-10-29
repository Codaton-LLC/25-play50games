// The baby dino's gait on the core quadruped rig (pure; pinned in dinoGait.test.ts). shared/dino.glb
// is a baby triceratops on four short sturdy legs (05-hyper3d-catalog "dino"; measured below), so it
// walks like the zoo-escape panda: a diagonal-sequence walk when slow (mud), a trot (diagonal pairs)
// at a jog and a bounding gallop at full speed. The phase advances by the distance really moved over
// the stride, so the planted feet never slide (until the cadence cap on a dash).
import type { QuadrupedLandmarks } from "@/arcade3d/core/rig/quadruped";
import { DIAGONAL_WALK, quadrupedStride, type QuadrupedGaitOptions } from "@/arcade3d/core/rig/quadrupedPoses";
import { EXPANSION_ASSETS, EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";

/** dino.glb raw bounds (GLB units, faces +z, feet on y = 0), the same as the shared size table. */
export const DINO_GLB = EXPANSION_GLB_SIZE.dino;
/** Metres per GLB unit along x / z (the asset fit: 1.1 m long). */
export const DINO_SCALE = EXPANSION_ASSETS.dino.scale ?? 1;

/**
 * The dino's joints for the core quadruped rig (no skeleton in the GLB), measured on dino.glb
 * (vertex slices 2026-10-28): four stubby feet, x 0.15-0.48 (centre 0.31); the front feet z 0.21-0.57,
 * the hind feet z -0.61 to -0.25; the belly hangs at y 0.16-0.2; a big head and frill (x ±0.56) sit
 * over the front legs from z 0.15 to the snout at z 0.92 (y 0.55-1.47); a short thick tail from z -0.62
 * to the tip at -0.95, y 0.35-0.68.
 */
export const DINO_LANDMARKS: QuadrupedLandmarks = {
   front: { top: [0.31, 0.4, 0.36], knee: [0.31, 0.22, 0.37], ankle: [0.31, 0.08, 0.38], toeZ: 0.57, radius: 0.17, bend: 1 },
   hind: { top: [0.3, 0.42, -0.42], knee: [0.3, 0.22, -0.45], ankle: [0.3, 0.08, -0.42], toeZ: -0.25, radius: 0.17, bend: -1 },
   bellyY: 0.2,
   thighBlend: 0.18,
   neck: [0.1, 0.75],
   head: [0.22, 0.85],
   mouth: [0, 0.68, 0.9],
   tail: [
      [0, 0.5, -0.62],
      [0, 0.52, -0.72],
      [0, 0.56, -0.82],
      [0, 0.6, -0.93],
   ],
   tailRadius: 0.14,
};

export const DINO_GAIT = {
   /** cadence cap (cycles per second): a dash at 8 m/s slides a little rather than paddling */
   maxHz: 9,
   /** speed (m/s) -> speed01 knots: a walk in deep mud, a trot at a jog, the gallop from 3 m/s */
   knots: [
      [0, 0],
      [0.8, 0.22],
      [1.8, 0.5],
      [2.6, 0.66],
      [3.0, 0.9],
      [8.0, 1],
   ] as const,
} as const;

/** walkOffsets: the diagonal walk; pawFold: the stubby round feet fold only a little in the swing. */
export const DINO_GAIT_OPTIONS: QuadrupedGaitOptions = { walkOffsets: DIAGONAL_WALK, pawFold: 0.4 };

const OUT = { speed01: 0, hz: 0 };

/** speed01 for the core gait and the resulting cadence (Hz) at a ground speed (m/s). Returns a shared object. */
export function dinoGait(speed: number): { speed01: number; hz: number } {
   const v = Math.max(0, speed);
   const k = DINO_GAIT.knots;
   let s = k[k.length - 1][1];
   for (let i = 1; i < k.length; i++) {
      if (v <= k[i][0]) {
         const [v0, s0] = k[i - 1];
         const [v1, s1] = k[i];
         s = s0 + ((s1 - s0) * (v - v0)) / (v1 - v0);
         break;
      }
   }
   OUT.speed01 = s;
   OUT.hz = v / Math.max(1e-4, quadrupedStride(s, DINO_LANDMARKS) * DINO_SCALE);
   return OUT;
}
