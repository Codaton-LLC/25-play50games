// The visual obstacle clock, shared by Scene.tsx and Decor.tsx: the rules ms the moving
// obstacles (and the decor driven by them: the level-2 beacons, the level-4 sweeping lights)
// are drawn at, in every run phase. Moved out of Scene.tsx so Decor.tsx can use it without a
// circular import. Pure: no three.js, React or store imports (the phase comes in as an argument).
import { COUNTDOWN_MS } from "@/arcade3d/core/useArcadeStore";
import type { RunPhase } from "@/arcade3d/core/types";

/** The mutable end marker both users keep (Scene: Fx.endedAt; Decor: a useRef). */
export interface ObstacleClock {
   /** useGameTime().now when the run ended; negative = still playing (or not started) */
   endedAt: number;
}

export function createObstacleClock(): ObstacleClock {
   return { endedAt: -1 };
}

/**
 * The rules ms the obstacles are drawn at, every frame and in every phase: −countdownMs during
 * the countdown (the bar arrives at its "Go" pose exactly at "Go"), simMs while playing or
 * paused, simMs plus the game time since the end afterwards (nothing freezes under the arch),
 * and free-running on the start screen (its own Scene mount, behind the start panel).
 */
export function obstacleMs(phase: RunPhase, countdownMs: number, simMs: number, clock: ObstacleClock, now: number): number {
   switch (phase) {
      case "countdown":
         return -countdownMs;
      case "playing":
      case "paused":
         return simMs;
      case "over":
         if (clock.endedAt < 0) clock.endedAt = now;
         return simMs + (now - clock.endedAt) * 1000;
      default:
         return now * 1000 - COUNTDOWN_MS;
   }
}
