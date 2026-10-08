// The shell side of looping sounds (engines, rotors, vacuums...). Owned by Claude.
// GameShell calls stopShellLoops() whenever a run must fall silent: it pauses, the player mutes,
// the run ends, the game closes. The audio module registers its own stopper once:
//
//    registerLoopStopper(stopAllLoops);   // TODO(P-06): core/audio.ts, when its loops land
//
// Pure (no React, no Web Audio), so the moments are tested in node (loopControl.test.ts).
import type { RunPhase } from "./types";

const stoppers = new Set<() => void>();

/** Adds a function that silences every running loop; returns its unregister function. */
export function registerLoopStopper(stop: () => void): () => void {
   stoppers.add(stop);
   return () => {
      stoppers.delete(stop);
   };
}

/** Silences every loop (each registered stopper once; one that throws does not stop the others). */
export function stopShellLoops(): void {
   stoppers.forEach((stop) => {
      try {
         stop();
      } catch {
         // a broken stopper must not break the shell
      }
   });
}

/** Does this phase change silence the loops? Entering "paused" or "over" (the run stopped). */
export function loopsStopOn(prev: RunPhase, next: RunPhase): boolean {
   return next !== prev && (next === "paused" || next === "over");
}
