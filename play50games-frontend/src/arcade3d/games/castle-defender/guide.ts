// What to do next, as one line for the hint (Hud.tsx). Purely visual: it reads the stats the Scene
// already writes and never changes the run.
import type { HintTone } from "@/arcade3d/core/hud/hintTiming";

export interface Hint {
   text: string | null;
   tone: HintTone;
}

/** Rock ready (the stat is tenths of a second left, 0 = ready). */
export const rockReady = (rock: number): boolean => rock <= 0;

export function hintFor(climb: number, rock: number, offer: boolean, touch: boolean): Hint {
   if (offer) return { text: null, tone: "info" };
   if (climb > 0) {
      return rockReady(rock)
         ? { text: touch ? "A ladder is up: tap Rock to knock it down!" : "A ladder is up: press E / Enter (Rock) to knock it down!", tone: "warn" }
         : { text: "A ladder is up: shoot the climbers while Rock reloads", tone: "warn" };
   }
   return {
      text: touch ? "Tap the field to fire at a goblin. Hit shields from behind" : "Click the field (or arrows + Space) to fire. Hit shields from behind",
      tone: "info",
   };
}
