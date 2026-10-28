// What to do next, for the hint line (Scene.tsx, Hud.tsx). Purely visual: it reads the run and never
// changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { landingSpins, type Run } from "./rules";

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

/** Seconds left under which the hint sends the penguin to a gate. */
export const HURRY_S = 5;

/** A number per distinct hint, so the Scene rebuilds it only on a change. */
export function hintCode(run: Run): number {
   if (run.end) return 0;
   if (run.airDuration > 0) return landingSpins(run.yaw) >= 0 ? 2 : 3;
   if (run.remaining <= HURRY_S) return 4;
   return 1;
}

export function hintFor(code: number): HintState {
   if (code === 1) return { text: "Steer to the fish and through the gates (+8 s). Hop over ramps", key: "slide", tone: "info" };
   if (code === 2) return { text: "Facing forward: land now", key: "aligned", tone: "ready", sticky: true };
   if (code === 3) return { text: "Turn to face forward before you land", key: "turn", tone: "warn", sticky: true };
   if (code === 4) return { text: "Time is nearly up: cross a gate for +8 s", key: "hurry", tone: "warn", sticky: true };
   return { text: null };
}
