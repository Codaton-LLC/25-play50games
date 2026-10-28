// What to do next, for the beacons and the hint line (Scene.tsx, Hud.tsx). Purely visual: it reads the
// run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { SAFE_SAND_Z, type Run } from "./rules";

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

/** Alert time left (0..1 of the level's alert clock) under which the hint warns. */
export const LOW_ALERT = 0.3;

export interface Goal {
   /** 0 none, 1 the swimmer in trouble, 2 the dry sand (carrying) */
   kind: 0 | 1 | 2;
   x: number;
   z: number;
}

/** The current goal: the dry-sand line while towing (straight ahead of the lifeguard), else the alerted swimmer. */
export function nextGoal(run: Run, out: Goal): Goal {
   const s = run.swimmers[run.activeSwimmer];
   if (run.over) {
      out.kind = 0;
   } else if (run.carrying) {
      out.kind = 2;
      out.x = run.hero.x;
      out.z = SAFE_SAND_Z + 0.3;
   } else if (s && !s.saved) {
      out.kind = 1;
      out.x = s.x;
      out.z = s.z;
   } else out.kind = 0;
   return out;
}

export const lowAlert = (run: Run): boolean => run.alertTime < run.level.alertS * LOW_ALERT;

/** A number per distinct hint, so the Scene rebuilds it only on a change. */
export function hintCode(run: Run): number {
   if (run.over) return 0;
   if (run.carrying) return lowAlert(run) ? 2 : 1;
   if (lowAlert(run)) return 3;
   return 100 + run.activeSwimmer * 2 + (run.onJetSki ? 1 : 0);
}

export function beachHint(run: Run, code: number, touch: boolean): HintState {
   const grab = touch ? "tap Grab" : "press E";
   if (code === 0) return { text: null };
   if (code === 1) return { text: "Towing the swimmer: back to the dry sand (arrow)", key: "tow", tone: "carry" };
   if (code === 2) return { text: "Hurry! Alert running out: tow them to the sand", key: "tow-low", tone: "warn", sticky: true };
   if (code === 3) return { text: `Hurry! Swim to the pink ring, ${grab}`, key: "swim-low", tone: "warn", sticky: true };
   const key = `swimmer-${code}`;
   if (code % 2 === 1) return { text: `Ride to the pink ring, then ${grab}`, key, tone: "info" };
   if (run.level.jetSki) return { text: `Swim to the pink ring, then ${grab} · or ${grab} at the jet ski`, key, tone: "info" };
   return { text: `Swim to the pink ring, then ${grab}`, key, tone: "info" };
}
