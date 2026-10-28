// What to do next, as one line for the hint (Hud.tsx). Purely visual: it reads the stats the Scene
// already writes and never changes the run.
import type { HintTone } from "@/arcade3d/core/hud/hintTiming";

export interface Hint {
   text: string;
   tone: HintTone;
}

/** Power under this percent warns. */
export const LOW_POWER = 25;

export function hintFor(docked: number, waiting: boolean, power: number): Hint {
   if (docked >= 0) return { text: "Docked: tap Repair (E, Enter or Space) when the needle is in the green arc", tone: "ready" };
   if (power < LOW_POWER) return { text: "Low power: thrust to a lit dock (arrow) and repair a module", tone: "warn" };
   if (waiting) return { text: "Wait: this dock is not ready yet. Release to brake near it", tone: "info" };
   return { text: "Thrust to a lit dock, release to brake next to it", tone: "info" };
}
