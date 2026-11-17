// What to do next, for the beacon, the work readout and the hint line (Scene.tsx, Hud.tsx). Purely
// visual: it reads the run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import {
   ALGAE_HOLD_S, CARRY_MAX, COLUMN_R, FILTER_HOLD_S, HIGH_MIN_Y, type Run,
} from "./rules";

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

/** Below this air the hint and the beacon send the diver to the bubble column. */
export const LOW_AIR = 28;
/** Switch to another target only when it is this much closer than the current one. */
export const SWITCH_SHARE = 0.6;

export type GoalKind = "none" | "trash" | "basket" | "algae" | "filter" | "hatch" | "column";

export interface Goal {
   kind: GoalKind;
   /** index in run.trash / run.algae / run.filters, -1 for the others */
   index: number;
   x: number;
   y: number;
   z: number;
}

export const emptyGoal = (): Goal => ({ kind: "none", index: -1, x: 0, y: 0, z: 0 });

const dist = (run: Run, x: number, z: number): number => Math.hypot(run.hero.x - x, run.hero.z - z);

function put(out: Goal, kind: GoalKind, index: number, x: number, y: number, z: number): Goal {
   out.kind = kind;
   out.index = index;
   out.x = x;
   out.y = y;
   out.z = z;
   return out;
}

function stillValid(run: Run, g: Goal): boolean {
   if (g.kind === "trash") return run.trash[g.index]?.state === 0 && run.carried.length < CARRY_MAX;
   if (g.kind === "algae") return run.algae[g.index] ? !run.algae[g.index].done : false;
   if (g.kind === "filter") return run.filters[g.index] ? !run.filters[g.index].done : false;
   if (g.kind === "basket") return run.carried.length > 0;
   return false;
}

/**
 * The current goal, kept in `out` between frames so two equally near targets do not flicker: the
 * hatch when every task is done, the bubble column when the air is low, the basket when the arms are
 * full, otherwise the nearest open patch, filter, bottle or the basket.
 */
export function nextGoal(run: Run, out: Goal): Goal {
   if (run.over) return put(out, "none", -1, 0, 0, 0);
   if (run.done === run.tasks) return put(out, "hatch", -1, run.hatch.x, 0.2, run.hatch.z);
   if (run.hero.air < LOW_AIR && dist(run, run.column.x, run.column.z) > COLUMN_R) {
      return put(out, "column", -1, run.column.x, 0.4, run.column.z);
   }
   if (run.carried.length >= CARRY_MAX) return put(out, "basket", -1, run.basket.x, 0.9, run.basket.z);
   const keep = stillValid(run, out);
   const keepD = keep ? dist(run, out.x, out.z) : Infinity;
   const best = emptyGoal();
   let bestD = Infinity;
   const take = (kind: GoalKind, index: number, x: number, y: number, z: number) => {
      const d = dist(run, x, z);
      if (d < bestD) {
         bestD = d;
         put(best, kind, index, x, y, z);
      }
   };
   run.algae.forEach((a, i) => { if (!a.done) take("algae", i, a.x, a.y, a.z); });
   run.filters.forEach((f, i) => { if (!f.done) take("filter", i, f.x, 1.3, f.z); });
   if (run.carried.length > 0) take("basket", -1, run.basket.x, 0.9, run.basket.z);
   if (run.carried.length < CARRY_MAX) run.trash.forEach((t, i) => { if (t.state === 0) take("trash", i, t.x, 0.3, t.z); });
   if (keep && bestD > keepD * SWITCH_SHARE) return out;
   return put(out, best.kind, best.index, best.x, best.y, best.z);
}

/** Work progress 0..10 (tenths of the hold) while the diver holds a task, -1 otherwise. */
export function workTenths(run: Run): number {
   if (run.holdKind === 0) return -1;
   const need = run.holdKind === 1 ? ALGAE_HOLD_S : FILTER_HOLD_S;
   return Math.min(10, Math.floor((run.holdTime / need) * 10));
}

/** True while the hold waits for the diver to float up to a high patch. */
export function waitingToFloat(run: Run): boolean {
   return run.holdKind === 1 && run.algae[run.holdIndex]?.high === true && run.hero.y <= HIGH_MIN_Y;
}

/** A number per distinct hint, so the Scene rebuilds it only on a change. */
export function hintCode(run: Run, goal: Goal): number {
   if (run.over) return 0;
   const work = workTenths(run);
   const kind = goal.kind === "none" ? 0 : ["", "trash", "basket", "algae", "filter", "hatch", "column"].indexOf(goal.kind);
   if (work >= 0) return 1_000_000 + (waitingToFloat(run) ? 100_000 : 0) + work * 100 + run.holdKind;
   return kind * 10_000 + (goal.index + 1) * 10 + run.carried.length;
}

export function hintFor(run: Run, goal: Goal): HintState {
   if (run.over) return { text: null };
   const work = workTenths(run);
   if (work >= 0) {
      const what = run.holdKind === 1 ? "Scrubbing" : "Fixing the filter";
      if (waitingToFloat(run)) return { text: "High patch: tap Float and keep holding Work", key: "float", tone: "warn", sticky: true };
      return { text: `${what} ${work * 10}%: keep holding`, key: `work-${run.holdKind}`, tone: "carry", sticky: true };
   }
   const n = run.carried.length;
   switch (goal.kind) {
      case "hatch":
         return { text: "All done: swim to the glowing hatch", key: "hatch", tone: "ready" };
      case "column":
         return { text: "Low air: swim into the bubble column", key: "column", tone: "warn", sticky: true };
      case "basket":
         return { text: `Carrying ${n}/${CARRY_MAX}: drop it in the basket (arrow)`, key: `basket-${n}`, tone: "carry" };
      case "trash":
         return {
            text: n > 0 ? `Carrying ${n}/${CARRY_MAX}: grab more trash or go to the basket` : "Walk over the bottle to pick it up (arrow)",
            key: `trash-${n}`,
            tone: n > 0 ? "carry" : "info",
         };
      case "algae":
         return {
            text: run.algae[goal.index]?.high ? "High algae: stand close, tap Float, hold Work" : "Stand at the algae and hold Work to scrub",
            key: `algae-${goal.index}`,
            tone: "info",
         };
      case "filter":
         return { text: "Stand at the filter and hold Work (1.5 s)", key: `filter-${goal.index}`, tone: "info" };
      default:
         return { text: null };
   }
}
