// What to do next, as one line for the hint (Hud.tsx). Purely visual: it reads the stats the Scene
// already writes and never changes the run.
import type { HintTone } from "@/arcade3d/core/hud/hintTiming";

export interface Hint {
   text: string;
   tone: HintTone;
}

/** `need` is the rings still needed; -1 before the first frame of play (the stat is not written yet). */
export function hintFor(need: number, boost: boolean): Hint {
   if (need < 0) return { text: "Fly through the rings to reach the palace. Dodge gulls, balloons and rocks", tone: "info" };
   if (boost) return { text: "Rocket boost! Keep flying through the rings", tone: "ready" };
   if (need > 0) return { text: `Fly through the rings: ${need} more to clear. Dodge gulls, balloons and rocks`, tone: "info" };
   return { text: "Ring quota met: fly on to the palace", tone: "ready" };
}
