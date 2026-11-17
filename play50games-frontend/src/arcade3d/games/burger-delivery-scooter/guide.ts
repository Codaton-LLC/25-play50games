// What to do next, for the beacons and the hint line (Scene.tsx, Hud.tsx). Purely visual: it reads the
// run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "../../core/hud/hintTiming";
import { target, type Run } from "./rules";

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

export interface Goal {
   /** 0 none, 1 the shop (pick up the order), 2 the customer's door pad (deliver) */
   kind: 0 | 1 | 2;
   x: number;
   z: number;
}

/** The current goal: the shop while the box is empty, the next door while carrying. */
export function nextGoal(run: Run, out: Goal): Goal {
   if (run.end) {
      out.kind = 0;
      return out;
   }
   const t = target(run);
   out.kind = run.carrying ? 2 : 1;
   out.x = t.x;
   out.z = t.z;
   return out;
}

/** A number per distinct hint, so the Scene rebuilds it only on a change. */
export function hintCode(run: Run): number {
   if (run.end) return 0;
   return (run.carrying ? 100 : 200) + run.delivered;
}

export function burgerHint(run: Run, code: number): HintState {
   if (code === 0) return { text: null };
   if (code >= 200) {
      return {
         text: run.delivered === 0 ? "Drive to the pink shop ring and stop on it to load the order" : "Back to the pink shop: stop on the ring for the next order",
         key: `shop-${code}`,
         tone: "info",
      };
   }
   return { text: `Order ${run.delivered + 1} of ${run.config.orders}: stop on the green ring (arrow), slowly`, key: `door-${code}`, tone: "carry" };
}
