// The panda's gait on the core quadruped rig (pure; pinned in panda.test.ts). A sneak is a slow,
// crouched diagonal walk, a walk at full speed a trot (diagonal pairs); the phase is advanced by the
// distance the body really moved over the stride, so the planted paws never slide.
import { DIAGONAL_WALK, quadrupedStride, type QuadrupedGaitOptions } from "@/arcade3d/core/rig/quadrupedPoses";
import { PANDA_LANDMARKS, PANDA_SCALE } from "./assets";
import { PANDA } from "./rules";

export const PANDA_GAIT = {
   /** speed01 at the full sneak (a walk: the core trot starts at 0.3) */
   sneak01: 0.24,
   /** speed01 at the full walk (a trot) */
   walk01: 0.62,
   /** cadence cap (cycles per second), above every cadence the panda reaches */
   maxHz: 12,
   /** crouch while sneaking: the trunk drops this much (GLB units) and the head dips (rad) */
   crouch: 0.09,
   dip: 0.22,
} as const;

/** walkOffsets: the diagonal walk; pawFold: the big flat paws fold only a little in the swing. */
export const PANDA_GAIT_OPTIONS: QuadrupedGaitOptions = { walkOffsets: DIAGONAL_WALK, pawFold: 0.35 };

const OUT = { speed01: 0, hz: 0 };

/** speed01 for the core gait and the resulting cadence (Hz) at a ground speed (m/s). Returns a shared object. */
export function pandaGait(speed: number, sneaking: boolean): { speed01: number; hz: number } {
   const v = Math.min(PANDA.walk, Math.max(0, speed));
   // sneaking faster than the sneak (braking from a walk) rises on towards the trot, so the cadence stays sane
   OUT.speed01 = !sneaking
      ? PANDA_GAIT.walk01 * (v / PANDA.walk)
      : v <= PANDA.sneak
        ? PANDA_GAIT.sneak01 * (v / PANDA.sneak)
        : PANDA_GAIT.sneak01 + ((PANDA_GAIT.walk01 - PANDA_GAIT.sneak01) * (v - PANDA.sneak)) / (PANDA.walk - PANDA.sneak);
   OUT.hz = speed / Math.max(1e-4, quadrupedStride(OUT.speed01, PANDA_LANDMARKS) * PANDA_SCALE);
   return OUT;
}
