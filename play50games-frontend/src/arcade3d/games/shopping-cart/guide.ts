// What to grab next and what the cart is doing, for the beacon, the list panel and the hint line
// (Scene.tsx, Hud.tsx). Purely visual: it reads the run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import type { ProductKind } from "./assets";
import { FINISH_ZONE, storeDistance, type RunState } from "./rules";

export const PRODUCT_NAMES: Record<ProductKind, string> = {
   apple: "apple",
   banana: "banana",
   burger: "burger",
   tinCan: "tin can",
   bottle: "bottle",
   bag: "bag",
   sock: "sock",
   battery: "battery",
   fish: "fish",
   gourd: "gourd",
};

export const PRODUCT_ICONS: Record<ProductKind, string> = {
   apple: "🍎",
   banana: "🍌",
   burger: "🍔",
   tinCan: "🥫",
   bottle: "🍾",
   bag: "👜",
   sock: "🧦",
   battery: "🔋",
   fish: "🐟",
   gourd: "🎃",
};

/** Switch to another item only when it is this much closer (store distance) than the current one. */
export const SWITCH_SHARE = 0.6;

/** The hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

export interface ListView {
   kinds: readonly ProductKind[];
   /** bit i = item i taken */
   taken: number;
   /** the item the beacon is on, -1 = checkout */
   next: number;
   riding: boolean;
}

const sameList = (a: ListView, b: ListView) => a.kinds === b.kinds && a.taken === b.taken && a.next === b.next && a.riding === b.riding;
/** The list panel's state, written by the Scene, read by the Hud. */
export const LIST = createHudSignal<ListView>({ kinds: [], taken: 0, next: -1, riding: false }, sameList);

/** Centre of the checkout finish zone. */
export const CHECKOUT = { x: (FINISH_ZONE.min.x + FINISH_ZONE.max.x) / 2, z: (FINISH_ZONE.min.z + FINISH_ZONE.max.z) / 2 };

/**
 * The item to fetch next (index into run.list), or -1 once the list is complete (the checkout). It
 * keeps `current` while that one is still on the shelf unless another is clearly closer.
 */
export function nextItem(run: RunState, current: number): number {
   if (run.listComplete) return -1;
   let best = -1;
   let bestD = Infinity;
   for (let i = 0; i < run.list.length; i++) {
      const item = run.list[i];
      if (item.collected) continue;
      const d = storeDistance(run.cart, item);
      if (d < bestD) {
         bestD = d;
         best = i;
      }
   }
   const keep = run.list[current];
   if (keep && !keep.collected && best !== current && bestD > storeDistance(run.cart, keep) * SWITCH_SHARE) return current;
   return best;
}

/** A number per distinct hint, so the Scene rebuilds it only on a change. */
export function hintCode(run: RunState, next: number): number {
   if (run.won) return 0;
   if (run.cart.stunTimer > 0) return 1;
   if (next < 0) return 2;
   return 100 + next;
}

export function cartHint(run: RunState, code: number, touch: boolean): HintState {
   if (code === 0) return { text: null };
   if (code === 1) return { text: "Bumped a shopper! Wait…", key: "stun", tone: "warn", sticky: true };
   if (code === 2) return { text: "List done! Drive to the green checkout", key: "checkout", tone: "carry" };
   const item = run.list[code - 100];
   const left = run.list.length - run.collectedCount;
   const ride = touch ? "hold Ride" : "hold Space";
   const name = item ? PRODUCT_NAMES[item.kind] : "item";
   return run.collectedCount === 0
      ? { text: `Grab the ${name} (arrow) · ${ride} to go fast`, key: `item-${code}` }
      : { text: `Next: the ${name} (arrow) · ${left} left`, key: `item-${code}` };
}
