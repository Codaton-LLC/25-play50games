// What to do next, as one line for the hint (Hud.tsx). Purely visual: it reads the stats the Scene
// already writes and never changes the run.
import type { HintTone } from "@/arcade3d/core/hud/hintTiming";

export interface Hint {
   text: string;
   tone: HintTone;
}

export function hintFor(found: number, total: number): Hint {
   if (found >= total) return { text: "Every treasure found!", tone: "ready" };
   if (found <= 0) return { text: "Walk until the detector ring turns gold and pulses fast, then hold Dig", tone: "info" };
   return { text: `${found} of ${total} found: keep sweeping until the ring turns gold, then hold Dig`, tone: "info" };
}
