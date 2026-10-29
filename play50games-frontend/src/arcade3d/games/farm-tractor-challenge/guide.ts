// What to do next, for the beacon and the hint line (Scene.tsx, Hud.tsx). Purely visual: it reads the
// run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { BALE_R, BAY_HALF, BAY_LIP, HITCH_SPEED, PARK_HOLD, TRACTOR, inBay, type Run } from "./rules";

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

/** Within this distance of the bale's edge the "slow down" warning shows above the hitch speed. */
export const SLOW_ZONE = 4;

export interface FarmGoal {
   /** a bale to hitch (its index), or -1: the barn bay */
   bale: number;
   x: number;
   z: number;
}

export function loadedCount(run: Run): number {
   let n = 0;
   for (const bale of run.bales) if (bale.trip === run.trip && bale.state === "hitched") n += 1;
   return n;
}

/** The middle of the barn bay (the park check's rectangle). */
export function bayCentre(run: Run): { x: number; z: number } {
   return { x: 0, z: (run.gateZ + BAY_LIP + run.halfD - 0.3) / 2 };
}

/** Half the bay's width: the drop-here ring's radius. */
export const BAY_RING = BAY_HALF - 0.3;

/** The nearest bale of this trip still in the field, or the bay once the trailer is full. */
export function nextGoal(run: Run, out: FarmGoal): FarmGoal {
   out.bale = -1;
   if (loadedCount(run) < run.level.balesPerTrip) {
      let best = Infinity;
      for (let i = 0; i < run.bales.length; i++) {
         const bale = run.bales[i];
         if (bale.trip !== run.trip || bale.state !== "field") continue;
         const d = Math.hypot(bale.x - run.tractor.x, bale.z - run.tractor.z);
         if (d < best) {
            best = d;
            out.bale = i;
            out.x = bale.x;
            out.z = bale.z;
         }
      }
      if (out.bale >= 0) return out;
   }
   const c = bayCentre(run);
   out.x = c.x;
   out.z = c.z;
   return out;
}

/** A number per distinct hint, so the Scene rebuilds it only on a change. */
export function hintCode(run: Run, goal: FarmGoal): number {
   if (run.over) return 0;
   if (goal.bale >= 0) {
      const gap = Math.hypot(goal.x - run.tractor.x, goal.z - run.tractor.z) - TRACTOR.radius - BALE_R;
      if (gap < SLOW_ZONE && Math.abs(run.tractor.speed) >= HITCH_SPEED * 0.85) return 1;
      return loadedCount(run) > 0 ? 3 : 2;
   }
   if (inBay(run, run.tractor.x, run.tractor.z)) return run.park > 0 ? 6 : 5;
   return 4;
}

export function farmHint(run: Run, code: number): HintState {
   const size = run.level.balesPerTrip;
   const trip = `Trip ${Math.min(run.trip + 1, run.level.trips)}/${run.level.trips}`;
   switch (code) {
      case 1:
         return { text: "Slow down! Touch the bale under 2 m/s", key: "slow", tone: "warn", sticky: true };
      case 2:
         return { text: `${trip}: drive gently into the ringed ${size > 1 ? "bales" : "bale"} (arrow)`, key: `bale-${run.trip}` };
      case 3:
         return { text: `${loadedCount(run)}/${size} loaded: get the next bale`, key: `bale-${run.trip}-${loadedCount(run)}`, tone: "carry" };
      case 4:
         return { text: "Loaded! Drive into the green barn bay", key: `bay-${run.trip}`, tone: "carry" };
      case 5:
         return { text: "In the bay: stop and hold still", key: `stop-${run.trip}`, tone: "ready" };
      case 6:
         return { text: `Parking… hold still (${PARK_HOLD.toFixed(1)} s)`, key: `park-${run.trip}`, tone: "ready", sticky: true };
      default:
         return { text: null };
   }
}

/** A bump next to an armed field bale is a too-fast hitch (the rules spend the same life). */
export function bumpAtBale(run: Run): boolean {
   for (const bale of run.bales) {
      if (bale.state !== "field") continue;
      if (Math.hypot(bale.x - run.tractor.x, bale.z - run.tractor.z) <= TRACTOR.radius + BALE_R + 0.4) return true;
   }
   return false;
}
