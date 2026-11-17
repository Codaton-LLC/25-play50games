// What to do next, as one line for the hint (Hud.tsx). Purely visual: it reads the task stats the Scene
// already writes (t0p, t0k, t0h, ...) and never changes the run.
import type { HintTone } from "@/arcade3d/core/hud/hintTiming";

export interface TaskStat {
   /** platform index, -1 for no task in this slot */
   platform: number;
   /** true for a passenger, false for a bag */
   passenger: boolean;
   /** in hand (the bag) or following (the passenger) */
   held: boolean;
}

export interface Hint {
   text: string | null;
   tone: HintTone;
}

/** The held task wins; otherwise the first open one. */
export function hintFor(slots: readonly TaskStat[]): Hint {
   const held = slots.find((t) => t.platform >= 0 && t.held);
   if (held) {
      const n = held.platform + 1;
      return held.passenger
         ? { text: `Walk your passenger to platform ${n}'s pad (arrow), then Use`, tone: "carry" }
         : { text: `Carry the bag to platform ${n}'s pad (arrow) before its train leaves`, tone: "carry" };
   }
   const open = slots.find((t) => t.platform >= 0);
   if (!open) return { text: null, tone: "info" };
   const n = open.platform + 1;
   return open.passenger
      ? { text: `A passenger waits at the entrance for platform ${n}: stand close and Use`, tone: "info" }
      : { text: `A bag waits at the entrance for platform ${n}: stand close and Use to pick it up`, tone: "info" };
}
