import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { itemY, type RunState } from "./rules";

export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

/** The lowest good item is the next catch; bad items retain their existing red rings. */
export function nextTarget(run: RunState) {
   let best = -1;
   let lowest = Infinity;
   run.items.forEach((item, i) => {
      const y = itemY(item.bornMs, run.elapsedMs, item.speed);
      if (item.active && !item.bad && y < lowest) { best = i; lowest = y; }
   });
   return best;
}
export function hintFor(run: RunState): HintState {
   if (run.ended) return { text: null };
   if (run.lives === 1) return { text: "Last life! Catch food, dodge socks and cans", key: "last-life", tone: "warn", sticky: true };
   return { text: `Left/right: catch food | dodge socks/cans${run.level.dropsPerLife > 0 ? " | drops cost lives" : ""}`, key: "catch" };
}
