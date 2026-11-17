// What to do next, for the beacon and the hint line (Scene.tsx, Hud.tsx). Purely visual: it reads the
// run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { STREAK_WINDOW_S, type Run } from "./rules";

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

/** Switch to another fish only when it is this much closer than the current one. */
export const SWITCH_SHARE = 0.6;
/** A chasing vacuum this close (m) to the cat gets the "Hop over it" warning. */
export const CHASE_WARN_R = 3.5;

export interface Goal {
   kind: "none" | "treat" | "bed";
   /** index in run.treats, -1 for the bed */
   index: number;
   x: number;
   z: number;
}

export const emptyGoal = (): Goal => ({ kind: "none", index: -1, x: 0, z: 0 });

const dist = (run: Run, x: number, z: number): number => Math.hypot(run.cat.x - x, run.cat.z - z);

/** The nearest fish left (kept against a slightly nearer one), the bed once every fish is eaten. */
export function nextGoal(run: Run, out: Goal): Goal {
   if (run.over) {
      out.kind = "none";
      out.index = -1;
      return out;
   }
   const kept = out.kind === "treat" && run.treats[out.index] && !run.treats[out.index].got ? dist(run, out.x, out.z) : Infinity;
   let best = -1;
   let bestD = Infinity;
   run.treats.forEach((t, i) => {
      if (t.got) return;
      const d = dist(run, t.x, t.z);
      if (d < bestD) {
         bestD = d;
         best = i;
      }
   });
   if (kept !== Infinity && bestD > kept * SWITCH_SHARE) return out;
   if (best < 0) {
      out.kind = "bed";
      out.index = -1;
      out.x = run.home.x;
      out.z = run.home.z;
      return out;
   }
   out.kind = "treat";
   out.index = best;
   out.x = run.treats[best].x;
   out.z = run.treats[best].z;
   return out;
}

/** True when a vacuum is chasing the cat from close by and a hop is not under way. */
export function chaseNear(run: Run): boolean {
   if (run.cat.hop > 0) return false;
   return run.vacuums.some((v) => v.mode === "chase" && Math.hypot(v.agent.x - run.cat.x, v.agent.z - run.cat.z) <= CHASE_WARN_R);
}

/** True while a fish eaten now would extend the streak. */
export const streakLive = (run: Run): boolean => run.streak > 0 && run.time - run.lastTreat <= STREAK_WINDOW_S;

/** A number per distinct hint, so the Scene rebuilds it only on a change. */
export function hintCode(run: Run, goal: Goal): number {
   if (run.over || goal.kind === "none") return 0;
   if (chaseNear(run)) return 1;
   return goal.kind === "bed" ? 2 : 10 + goal.index * 2 + (streakLive(run) ? 1 : 0);
}

export function hintFor(run: Run, goal: Goal): HintState {
   if (run.over || goal.kind === "none") return { text: null };
   if (chaseNear(run)) return { text: "A vacuum is chasing you! Tap Hop to jump over it", key: "chase", tone: "warn", sticky: true };
   if (goal.kind === "bed") return { text: "All fish eaten: run to the bed (arrow) and nap", key: "bed", tone: "ready" };
   const left = run.treats.length - run.collected;
   const streak = streakLive(run);
   return {
      text: streak ? `Keep eating fast for a streak bonus (${left} fish left)` : `Eat the gold fish (arrow), ${left} left. Dodge the red vacuums`,
      key: `treat-${goal.index}-${streak ? 1 : 0}`,
      tone: streak ? "carry" : "info",
   };
}
