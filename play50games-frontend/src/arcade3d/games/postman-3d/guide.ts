// What to do next, for the beacons and the hint line (Scene.tsx, Hud.tsx). Purely visual: it reads the
// run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { ADDRESS_COLORS, OFFICE, nextItem, targetFor, type Run } from "./rules";

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

export interface Goal {
   /** 0 none, 1 a letter to the mailbox, 2 a parcel to the front door, 3 the post office (load the next item) */
   kind: 0 | 1 | 2 | 3;
   x: number;
   z: number;
   /** index of the item in run.items, -1 for none */
   item: number;
}

/** The current goal: the first undelivered item (at its mailbox or door), or the post office when it is not loaded yet. */
export function nextGoal(run: Run, out: Goal): Goal {
   const item = run.over ? undefined : nextItem(run);
   if (!item) {
      out.kind = 0;
      out.item = -1;
      return out;
   }
   out.item = run.items.indexOf(item);
   if (!item.loaded) {
      out.kind = 3;
      out.x = OFFICE.x;
      out.z = OFFICE.z;
      return out;
   }
   targetFor(run, item, out);
   out.kind = item.kind === "letter" ? 1 : 2;
   return out;
}

/** A number per distinct hint, so the Scene rebuilds it only on a change. */
export function hintCode(run: Run): number {
   const g = nextGoal(run, { kind: 0, x: 0, z: 0, item: -1 });
   return g.kind === 0 ? 0 : g.kind * 1000 + g.item;
}

export function postHint(run: Run, code: number, touch: boolean, markers: boolean): HintState {
   if (code === 0) return { text: null };
   const post = touch ? "tap Post" : "press E";
   const kind = Math.floor(code / 1000);
   if (kind === 3) return { text: `Back to the post office ${markers ? "(arrow)" : ""}, ${post} to load mail`, key: `office-${code}`, tone: "carry" };
   const item = run.items[code % 1000];
   if (!item) return { text: null };
   const where = kind === 1 ? "the mailbox" : "the front door";
   return {
      text: `${kind === 1 ? "Letter" : "Parcel"} for no. ${item.house} (${ADDRESS_COLORS[item.color]}): ${where}, ${post}`,
      key: `item-${code}`,
      tone: "info",
   };
}
