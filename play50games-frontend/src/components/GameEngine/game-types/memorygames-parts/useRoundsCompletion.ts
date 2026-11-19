import { useEffect, useRef } from "react";

/**
 * Delayed onComplete of a rounds game: fires exactly once, 1000 ms after the
 * last round, with the final score.
 *
 * The games used an effect that depended on the score state and on onComplete,
 * so a late score update or a new onComplete identity from the parent ran it
 * again and completed (and saved progress) a second time. Here the first
 * render with `done` schedules the completion and nothing can schedule another;
 * onComplete is read through a ref when the delay ends.
 *
 * `finalScore` is the score at that first `done` render. `schedule` is the
 * game's own timer function, so whether the timer is cleared on unmount stays
 * as each game had it.
 */
export function useRoundsCompletion(
   done: boolean,
   finalScore: number,
   onComplete: (finalScore?: number) => void,
   schedule: (fn: () => void, ms: number) => unknown
) {
   const latestRef = useRef({ finalScore, onComplete, schedule });
   useEffect(() => {
      latestRef.current = { finalScore, onComplete, schedule };
   });
   const firedRef = useRef(false);
   useEffect(() => {
      if (!done || firedRef.current) return;
      firedRef.current = true;
      const score = latestRef.current.finalScore;
      latestRef.current.schedule(() => {
         latestRef.current.onComplete(score);
      }, 1000);
   }, [done]);
}
