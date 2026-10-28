// What the front bag needs, for the beacons and the hint line (Scene.tsx, Hud.tsx). Purely visual:
// it reads the run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { DIVERTER_AT, FLIGHTS, HALL, SEG, diverterLocked, type Bag, type RunState } from "./rules";

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

export const FLIGHT_NAMES = ["red circle", "blue square", "green triangle", "yellow star"] as const;
/** The keyboard key of each diverter (the Scene reads A / S / D / W and the arrows). */
export const DIVERTER_KEYS = ["A", "S", "D", "W"] as const;

/** The diverter a bag meets next, by the segment it is on. -1 once it is past the last one (on a chute). */
const NEXT_DIVERTER: Record<number, number> = { [SEG.entry]: 0, [SEG.mid]: 1, [SEG.toD3]: 2, [SEG.hold]: 3 };

export interface Goal {
   /** "flip": a diverter on the front bag's way is set wrong; "chute": the route is right, the chute is the target */
   kind: "none" | "flip" | "chute";
   /** the diverter to flip (0..3) for "flip", -1 otherwise */
   diverter: number;
   flight: number;
   x: number;
   y: number;
   z: number;
}

export const emptyGoal = (): Goal => ({ kind: "none", diverter: -1, flight: 0, x: 0, y: 0, z: 0 });

/** What diverter `d` must be set to for a bag of `flight` (0 = straight to the chute, 1 = on down the spine). */
export const wantedChoice = (flight: number, d: number): number => (d < flight ? 1 : 0);

/** The oldest living bag that still has a diverter ahead, or null. */
export function frontBag(run: RunState): Bag | null {
   let best: Bag | null = null;
   for (const bag of run.bags) {
      if (!bag.alive || NEXT_DIVERTER[bag.segment] === undefined) continue;
      if (!best || bag.born < best.born) best = bag;
   }
   return best;
}

/** The first unlocked diverter on the bag's way that is set wrong, or -1. */
export function wrongDiverter(run: RunState, bag: Bag): number {
   const from = NEXT_DIVERTER[bag.segment];
   if (from === undefined) return -1;
   for (let d = from; d <= Math.min(3, bag.flight); d++) {
      if (diverterLocked(d, run.time, run.config)) continue;
      if (run.choices[d] !== wantedChoice(bag.flight, d)) return d;
   }
   return -1;
}

export function nextGoal(run: RunState, out: Goal): Goal {
   const bag = run.lost ? null : frontBag(run);
   if (!bag) {
      out.kind = "none";
      out.diverter = -1;
      return out;
   }
   const d = wrongDiverter(run, bag);
   out.flight = bag.flight;
   if (d >= 0) {
      out.kind = "flip";
      out.diverter = d;
      out.x = DIVERTER_AT[d].x;
      out.y = DIVERTER_AT[d].y + 0.2;
      out.z = DIVERTER_AT[d].z;
      return out;
   }
   out.kind = "chute";
   out.diverter = -1;
   out.x = HALL.gateX;
   out.y = DIVERTER_AT[bag.flight].y + 0.2;
   out.z = DIVERTER_AT[bag.flight].z;
   return out;
}

/** A number per distinct hint, so the Scene rebuilds it only on a change. */
export function hintCode(goal: Goal): number {
   if (goal.kind === "none") return 0;
   return goal.kind === "flip" ? 100 + goal.diverter * 10 + goal.flight : 200 + goal.flight;
}

export function hintFor(goal: Goal, touch: boolean): HintState {
   if (goal.kind === "none") return { text: null };
   const name = FLIGHT_NAMES[goal.flight];
   if (goal.kind === "flip") {
      const how = touch ? `Tap diverter ${goal.diverter + 1}` : `Press ${DIVERTER_KEYS[goal.diverter]} (diverter ${goal.diverter + 1})`;
      return { text: `${how}: the ${name} bag needs another way`, key: `flip-${goal.diverter}-${goal.flight}`, tone: "warn" };
   }
   return { text: `Route set: the ${name} bag rides to chute ${goal.flight + 1} (arrow)`, key: `chute-${goal.flight}`, tone: "ready" };
}

export const flightColor = (flight: number): string => FLIGHTS[flight].color;
