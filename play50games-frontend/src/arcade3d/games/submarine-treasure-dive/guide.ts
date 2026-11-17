// What to do next, for the beacon, the scoop readout and the hint line (Scene.tsx, Hud.tsx). Purely
// visual: it reads the run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { COLLECT_DIST, COLLECT_Y, onDock, quotaMet, type Run } from "./rules";

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

/** Below this battery the hint warns that flying low drains twice as fast. */
export const LOW_BATTERY = 25;
/** Switch to another treasure only when it is this much closer than the current one. */
export const SWITCH_SHARE = 0.6;
/** "Ready to scoop" starts this close to a treasure (twice the scoop reach). */
export const NEAR_SCOOP = COLLECT_DIST * 2;

export interface Goal {
   kind: "none" | "treasure" | "dock";
   /** index in run.treasures, -1 for the dock */
   index: number;
   x: number;
   z: number;
}

export const emptyGoal = (): Goal => ({ kind: "none", index: -1, x: 0, z: 0 });

const dist = (run: Run, x: number, z: number): number => Math.hypot(run.sub.x - x, run.sub.z - z);

/** The nearest untaken treasure (kept against a slightly nearer one), the dock once every treasure is aboard. */
export function nextGoal(run: Run, out: Goal): Goal {
   if (run.over) {
      out.kind = "none";
      out.index = -1;
      return out;
   }
   if (quotaMet(run)) {
      out.kind = "dock";
      out.index = -1;
      out.x = run.dock.x;
      out.z = run.dock.z;
      return out;
   }
   const kept = out.kind === "treasure" && run.treasures[out.index] && !run.treasures[out.index].taken ? dist(run, out.x, out.z) : Infinity;
   let best = -1;
   let bestD = Infinity;
   run.treasures.forEach((t, i) => {
      if (t.taken) return;
      const d = dist(run, t.x, t.z);
      if (d < bestD) {
         bestD = d;
         best = i;
      }
   });
   if (kept !== Infinity && bestD > kept * SWITCH_SHARE) return out;
   if (best < 0) {
      out.kind = "none";
      out.index = -1;
      return out;
   }
   out.kind = "treasure";
   out.index = best;
   out.x = run.treasures[best].x;
   out.z = run.treasures[best].z;
   return out;
}

/** True when the sub is low enough to scoop (strictly below COLLECT_Y). */
export const canScoop = (run: Run): boolean => run.sub.y < COLLECT_Y;

/** 0 = too far, 1 = close to the goal but too high, 2 = close and low (scooping), 3 = low battery warning. */
export function hintCode(run: Run, goal: Goal): number {
   if (run.over || goal.kind === "none") return 0;
   const low = run.sub.battery < LOW_BATTERY ? 1 : 0;
   if (goal.kind === "dock") return 10 + (onDock(run) ? 2 : 0) + low * 100;
   const near = dist(run, goal.x, goal.z) <= NEAR_SCOOP;
   return 20 + goal.index * 1000 + (near ? (canScoop(run) ? 2 : 1) : 0) + low * 100_000;
}

export function hintFor(run: Run, goal: Goal): HintState {
   if (run.over || goal.kind === "none") return { text: null };
   const warn = run.sub.battery < LOW_BATTERY;
   const suffix = warn ? " Battery low: flying low drains it twice as fast." : "";
   if (goal.kind === "dock") {
      return { text: `All treasure aboard: land on the dock (arrow).${suffix}`, key: `dock-${warn ? 1 : 0}`, tone: warn ? "warn" : "ready" };
   }
   const near = dist(run, goal.x, goal.z) <= NEAR_SCOOP;
   const key = `t-${goal.index}-${near ? (canScoop(run) ? "low" : "near") : "far"}-${warn ? 1 : 0}`;
   if (near && canScoop(run)) return { text: `Scooping: stay low over the treasure.${suffix}`, key, tone: "ready" };
   if (near) return { text: `Hold Dive to sink and scoop the treasure.${suffix}`, key, tone: "ready" };
   return { text: `Fly to the treasure (arrow), then hold Dive to scoop it.${suffix}`, key, tone: warn ? "warn" : "info" };
}
