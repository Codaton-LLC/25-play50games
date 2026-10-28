// What to do next, as one line for the hint (Hud.tsx). Purely visual: it reads the stats the Scene
// already writes and never changes the run.
import type { HintTone } from "@/arcade3d/core/hud/hintTiming";

export interface Hint {
   text: string;
   tone: HintTone;
}

export function hintFor(catches: number, maxCatches: number, bamboo: number): Hint {
   if (maxCatches - catches <= 1) return { text: "Last chance: one more catch and the escape is over. Sneak and hide", tone: "warn" };
   const toss = bamboo > 0 ? ", Toss bamboo to lure a keeper" : "";
   return { text: `Avoid the flashlight cones: hold Sneak, hide in bushes${toss}`, tone: "info" };
}
