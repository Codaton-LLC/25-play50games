// What to do next, for the beacons and the hint line (Scene.tsx, Hud.tsx). Purely visual: it reads the
// run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { TYPES, itemXZ, shelfFor, type Ingredient, type Run } from "./rules";

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

export interface Goal {
   /** 0 none, 1 the shelf to take from, 2 the cauldron (the carried item is next), 3 the shelf to put it back on */
   kind: 0 | 1 | 2 | 3;
   x: number;
   z: number;
   type: Ingredient | null;
}

/** The ingredient the first open recipe wants next, or null. */
export function wantedType(run: Run): Ingredient | null {
   for (const recipe of run.recipes) {
      if (recipe.open && !recipe.done) return recipe.steps[recipe.at] ?? null;
   }
   return null;
}

/** True when the cauldron would take this ingredient now (the head of any open recipe). */
export function isHead(run: Run, type: Ingredient): boolean {
   for (const recipe of run.recipes) {
      if (recipe.open && !recipe.done && recipe.steps[recipe.at] === type) return true;
   }
   return false;
}

/** The current goal: the shelf with the next ingredient, then the cauldron (or the shelf again for a wrong one). */
export function nextGoal(run: Run, out: Goal): Goal {
   out.type = null;
   out.kind = 0;
   if (run.over) return out;
   if (run.carried) {
      if (isHead(run, run.carried)) {
         out.kind = 2;
         out.x = 0;
         out.z = 0;
         out.type = run.carried;
         return out;
      }
      const back = shelfFor(run, run.carried);
      if (!back) return out;
      itemXZ(back, run.time, out);
      out.kind = 3;
      out.type = run.carried;
      return out;
   }
   const want = wantedType(run);
   const shelf = want ? shelfFor(run, want) : null;
   if (!want || !shelf) return out;
   itemXZ(shelf, run.time, out);
   out.kind = 1;
   out.type = want;
   return out;
}

/** A number per distinct hint, so the Scene rebuilds it only on a change. */
export function hintCode(run: Run): number {
   if (run.over) return 0;
   const kind = run.carried ? (isHead(run, run.carried) ? 2 : 3) : 1;
   const type = run.carried ?? wantedType(run);
   if (!type) return 0;
   return kind * 100 + TYPES.indexOf(type) * 10 + (run.recipes.length - run.done);
}

export function labHint(run: Run, code: number, touch: boolean): HintState {
   const use = touch ? "tap Use" : "press E";
   if (code === 0) return { text: null };
   const kind = Math.floor(code / 100);
   const type = TYPES[Math.floor((code % 100) / 10)];
   if (kind === 2) return { text: `Go to the cauldron, ${use} to add the ${type}`, key: `pot-${code}`, tone: "carry" };
   if (kind === 3) return { text: `Not in the recipe: put the ${type} back on its shelf (${use})`, key: `back-${code}`, tone: "warn" };
   return { text: `Take the ${type} from the glowing shelf (arrow), ${use}`, key: `take-${code}`, tone: "info" };
}
