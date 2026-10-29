// The one-line coach: what to do right now. L1 teaches by playing (dig down, step out from under a
// rumbling boulder, drop a boulder on the beetle); later levels call their twist and the boss windows.
// Pure: reads the world, returns a code the Scene publishes and the Hud turns into text.
import { T, tileAt, type Hero, type World } from "./rules";

export const COACH = [
   "Dig down to the lift",
   "Hold Down (or S) to dig into the soft soil",
   "Dig down to the lantern: it's your checkpoint",
   "Rumble! Step out from under the boulder",
   "Packed soil digs slower. Red ore holds orbs",
   "Dig the soil under the boulder: drop it on the beetle",
   "Reach the lift",
   "Beetle! Hop over it (Jump) or drop a boulder on it",
   "Water is flooding: it slows you. Dig around the pockets",
   "Rockfall from above! Keep digging down",
   "Cart ride! Hold on",
   "Gas pocket: Kiro's shield digs it safely",
   "Rockjaw: dig the plug above it, the boulder falls",
   "Dust! Step off it: Rockjaw erupts there",
   "It's up: drop a boulder on it now",
   "Flipped! Hop beside it, drift onto its belly holding Down",
   "The lift is open: go!",
   "Rock can't be dug: go around it",
] as const;

export function coachFor(w: World, h: Hero, pushing = 0): number {
   if (h.ended) return 0;
   const b = w.boss;
   const a = w.map.arena;
   if (b && a && b.active) {
      if (w.liftOpen) return 16;
      const s = b.state;
      if (s.phase === 0) return 12;
      if (s.phase === 1) return b.buried && s.step === "telegraph" ? 13 : s.step === "vulnerable" ? 14 : 12;
      return 15;
   }
   if (h.riding) return 10;
   for (const bo of w.boulders) if (bo.alive && bo.state !== "rest" && Math.abs(bo.col - h.col) <= 1 && bo.row <= h.row + 1 && bo.row >= h.row - 6) return 3;
   if (w.cfg.rockfall && w.ms > w.cfg.rockfall.startMs - 3000) return 9;
   if (w.floodBudget > 0) return 8;
   for (const be of w.beetles) if (be.alive && be.row === h.row && Math.abs(be.col - h.col) <= 3) return 7;
   for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1]]) if (tileAt(w, h.col + dc, h.row + dr) === T.GAS && h.heroId !== "kiro") return 11;
   if (pushing !== 0 && (tileAt(w, h.col + pushing, h.row) === T.ROCK || tileAt(w, h.col + pushing, h.row) === T.BEDROCK)) return 17;
   if (w.level === 1) {
      if (h.row <= 1) return 1;
      if (h.lit.length === 0) return 2;
      if (h.row >= 28 && w.beetles.some((be) => be.alive)) return 5;
      if (h.row >= 33) return 6;
      return 4;
   }
   if (h.row >= w.map.lift.row - 2) return 6;
   return 0;
}
