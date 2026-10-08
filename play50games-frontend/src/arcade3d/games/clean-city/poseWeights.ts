// How strongly the cleaner's pickup reach and cheer show over time (looks only). Pure, no three.js,
// so Scene.tsx (Cleaner) and poseWeights.test.ts share it.
// - The reach (core reachPose, on the arms) fades out linearly over REACH_S after each pickup.
// - The cheer (core cheerPose, arms up in a V) eases in over CHEER_IN_S, holds, then eases out with
//   a smoothstep over the last CHEER_OUT_S of CHEER_S. Any blend between the V and the arms down
//   sweeps the arms through level, where the cleaner reads as T-posing: the smoothstep crosses it
//   quickly (both arms within 20° of the T-pose for about 0.07 s per cheer; a linear fade over
//   CHEER_S held them there for about 0.25 s). On the win the cheer eases in and then holds.
// - `since` is the animation time (useGameTime, pause-safe) since the event; a huge `since` (no
//   event yet) gives 0.

/** The pickup reach (s): full at the pickup, gone after this. */
export const REACH_S = 0.45;
/** The cheer after a map clear (s), from the clear to arms down. */
export const CHEER_S = 1.15;
/** The cheer eases in over this (s): the arms swing up instead of jumping in one frame. */
export const CHEER_IN_S = 0.1;
/** The cheer eases out over the last this of CHEER_S (s). */
export const CHEER_OUT_S = 0.35;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (k: number) => k * k * (3 - 2 * k);

/** The reach's weight `since` s after a pickup: 1 down to 0 over REACH_S. */
export function reachWeight(since: number): number {
   return since < 0 ? 0 : Math.max(0, 1 - since / REACH_S);
}

/** The cheer's weight `since` s after a map clear (or the win, `won`: it then holds at 1). */
export function cheerWeight(since: number, won: boolean): number {
   if (!(since >= 0)) return 0;
   const easeIn = smoothstep(clamp01(since / CHEER_IN_S));
   if (won) return easeIn;
   if (since >= CHEER_S) return 0;
   return easeIn * (1 - smoothstep(clamp01((since - (CHEER_S - CHEER_OUT_S)) / CHEER_OUT_S)));
}
