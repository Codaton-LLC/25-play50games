// Which ship to aim at, for the beacon and the hint line (Scene.tsx, Hud.tsx). Purely visual: it reads
// the run and never changes it.
import { createHudSignal, EMPTY_HINT, sameHint, type HintState } from "@/arcade3d/core/hud/hintTiming";
import { SEA, SHIP_SAILING, type RunState, type Ship } from "./rules";

/** The game's hint line, written by the Scene, read by the Hud. */
export const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);

/** A ship this close (m) to the harbour is "almost in". */
export const NEAR_HARBOUR_M = 8;

/** The sailing ship nearest the harbour (the one that costs a life first), or null. */
export function targetShip(run: RunState): Ship | null {
   let best: Ship | null = null;
   for (const s of run.ships) {
      if (s.state !== SHIP_SAILING) continue;
      if (!best || s.rider.position.x > best.rider.position.x) best = s;
   }
   return best;
}

/** A number per distinct hint, so the Scene rebuilds it only on a change. */
export function hintCode(run: RunState): number {
   const t = targetShip(run);
   if (!t) return 1;
   if (t.rider.position.x >= SEA.harbourX - NEAR_HARBOUR_M) return 3;
   return run.nextShot <= 1 ? 1 : 2;
}

export function hintFor(code: number, touch: boolean): HintState {
   if (code === 3) return { text: "A ship is nearly in the harbour: sink the marked one!", key: "harbour", tone: "warn" };
   if (code === 2) return { text: "Aim at the marked ship. Read the wind arrow; a powder barrel blasts ships near it", key: "aim", tone: "info" };
   return { text: touch ? "Drag to turn the cannon, release to fire at the marked ship" : "Drag (or arrow keys) to aim, release to fire at the marked ship", key: "first", tone: "info" };
}
