import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { isActive, isComplete, type Run } from "./rules";

export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

/** Keep the current active battery until collected, avoiding a flickering recommendation. */
export function nextTarget(run: Run, current = -1): number {
   if (isComplete(run.progress)) return -1;
   if (run.layout.batteries[current] && isActive(run.progress, run.layout.batteries[current])) return current;
   let best = -1;
   let distance = Infinity;
   for (const b of run.layout.batteries) {
      const d = Math.hypot(b.x - run.robot.x, b.z - run.robot.z);
      if (isActive(run.progress, b) && d < distance) { best = b.index; distance = d; }
   }
   return best;
}
export function hintFor(run: Run): HintState {
   if (isComplete(run.progress)) return { text: null };
   if (run.slowed) return { text: "Oil slows you down | steer onto clear floor", key: "oil", tone: "warn", sticky: true };
   if (run.belted) return { text: "Conveyor carrying you | steer toward the battery", key: "belt", tone: "carry", sticky: true };
   return { text: `Drive to glowing batteries | ${run.progress.collected}/${run.progress.taken.length} collected`, key: `wave-${run.progress.wave}`, sticky: true };
}
