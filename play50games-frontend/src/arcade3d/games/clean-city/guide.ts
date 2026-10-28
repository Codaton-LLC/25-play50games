// What to do next, for the beacon, the pickup pop and the hint line (Guide.tsx, Hud.tsx). Purely
// visual: it reads the run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { START_PAD, matchesKind, type CleanRun } from "./rules";

/** The game's hint line, written by Guide.tsx, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

/** Switch to another piece only when it is this much closer than the current one. */
export const SWITCH_SHARE = 0.6;

export interface Goal {
   /** "litter" = the nearest piece to collect, "pad" = back to the start ring, "none" */
   kind: "none" | "litter" | "pad";
   /** index in run.litter, -1 for the pad */
   index: number;
   x: number;
   z: number;
}

export const emptyGoal = (): Goal => ({ kind: "none", index: -1, x: 0, z: 0 });

const dist = (run: CleanRun, x: number, z: number): number => Math.hypot(run.runner.x - x, run.runner.z - z);

/** The ring while delivering, else the nearest piece that counts now (kept against a slightly nearer one). */
export function nextGoal(run: CleanRun, out: Goal): Goal {
   if (run.delivering) {
      out.kind = "pad";
      out.index = -1;
      out.x = START_PAD.x;
      out.z = START_PAD.z;
      return out;
   }
   const counts = (i: number) => run.litter[i].active && (!run.level.matching || matchesKind(run, run.litter[i].kind));
   const kept = out.kind === "litter" && out.index >= 0 && counts(out.index) ? dist(run, out.x, out.z) : Infinity;
   let best = -1;
   let bestD = Infinity;
   for (let i = 0; i < run.level.items; i++) {
      if (!counts(i)) continue;
      const d = dist(run, run.litter[i].x, run.litter[i].z);
      if (d < bestD) {
         bestD = d;
         best = i;
      }
   }
   if (kept !== Infinity && bestD > kept * SWITCH_SHARE) return out;
   if (best < 0) {
      out.kind = "none";
      out.index = -1;
      return out;
   }
   out.kind = "litter";
   out.index = best;
   out.x = run.litter[best].x;
   out.z = run.litter[best].z;
   return out;
}

/** Points this step added (a piece's points, plus the combo bonus when it came inside the window). */
export const gained = (run: CleanRun, before: number): number => Math.max(0, run.score - before);

/** A number per distinct hint, so Guide rebuilds it only on a change. */
export function hintCode(run: CleanRun, goal: Goal): number {
   if (run.ended || goal.kind === "none") return 0;
   if (goal.kind === "pad") return 1;
   return run.level.matching ? 10 + run.targetKind : 2;
}

export function hintFor(run: CleanRun, goal: Goal): HintState {
   if (run.ended || goal.kind === "none") return { text: null };
   if (goal.kind === "pad") return { text: "All collected: return to the white start ring (arrow)", key: "pad", tone: "ready" };
   if (run.level.matching) {
      const names = run.targetKind === 0 ? "bottles and bags" : "cans and bananas";
      return { text: `Sort first: collect the ${names} (arrow)`, key: `kind-${run.targetKind}`, tone: "info" };
   }
   return { text: "Walk into the litter (arrow) to pick it up", key: "litter", tone: "info" };
}
