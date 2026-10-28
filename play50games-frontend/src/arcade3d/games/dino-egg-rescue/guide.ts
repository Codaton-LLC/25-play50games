// What to do next, as one line for the hint (Hud.tsx). Purely visual: it reads the stats the Scene
// already writes and never changes the run.
import type { HintTone } from "@/arcade3d/core/hud/hintTiming";

export interface Hint {
   text: string;
   tone: HintTone;
}

export function hintFor(carried: number, maxStack: number, golden: boolean): Hint {
   if (carried <= 0) return { text: "Walk over an egg to pick it up, then carry it to the nest. Dodge the boulders", tone: "info" };
   const gold = golden ? " (the golden one is worth more)" : "";
   if (carried >= maxStack) return { text: `Carrying ${carried}/${maxStack}: hands full, take them to the nest${gold}`, tone: "carry" };
   return { text: `Carrying ${carried}/${maxStack}: take them to the nest, or grab more but you slow down${gold}`, tone: "carry" };
}
