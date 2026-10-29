// What to do next, for the hint line (Scene.tsx, Hud.tsx). Purely visual: it reads the run and never
// changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import type { Run } from "./rules";

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

/** 0 nothing, 1 watch, 2 a statue is sneaking, 3 one is frozen. */
export function hintCode(run: Run): number {
   if (run.outcome) return 0;
   let frozen = false;
   for (const ex of run.exhibits) {
      if (ex.mode === "sneaking") return 2;
      if (ex.mode === "frozen") frozen = true;
   }
   return frozen ? 3 : 1;
}

export function hintFor(code: number, touch: boolean): HintState {
   const flash = touch ? "tap Flash" : "press Space or E";
   if (code === 2) return { text: `A statue is sneaking! Turn the beam onto it and ${flash}`, key: "sneak", tone: "warn" };
   if (code === 3) return { text: "Frozen! Keep the beam on it until it goes home", key: "frozen", tone: "ready" };
   if (code === 1) return { text: `Watch the statues: ${flash} to freeze one that moves`, key: "watch", tone: "info" };
   return { text: null };
}
