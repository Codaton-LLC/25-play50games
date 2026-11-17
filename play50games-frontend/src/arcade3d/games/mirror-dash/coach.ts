// The one-line coach: what to do right now. L1 teaches the three beats by playing (your side, the
// reflection's side, both); later the coach names the zone you are in and the Sentinel's windows.
// Pure: reads the world, returns a code the Scene publishes and the Hud turns into text.
import { rowS } from "./levels";
import type { Pair, World } from "./rules";

export const COACH = [
   "One input, two runners: your reflection mirrors every lane change",
   "Merge: the runways meet. Never both in the inner lanes",
   "Frosted glass: the reflection copies you instead of mirroring",
   "Echo: the reflection repeats you half a second later",
   "Cracked! Three cracks shatter you back to the checkpoint",
   "One crack left!",
   "Blocks on your side: dodge them",
   "Now watch the right runway: the reflection's blocks",
   "Both sides: find the one move that saves both",
   "Panes incoming: find the open lane",
   "It stoops: jump through the knee-gem in the middle lanes",
   "Its shield covers one runway: the other body jumps through the gem",
   "One road: jump together as the ring closes",
   "The Sentinel shatters: run for the exit!",
] as const;

export function coachFor(w: World, p: Pair): number {
   if (p.ended) return 0;
   const g = p.boss;
   if (g && g.active) {
      if (g.state.hp === 0) return 13;
      if (g.state.phase === 0) return g.state.step === "vulnerable" ? 10 : 9;
      if (g.state.phase === 1) return 11;
      return 12;
   }
   if (p.cracks === 2) return 5;
   if (p.cracks === 1 && p.graceMs > 0) return 4;
   if (p.zone === "merge") return 1;
   if (p.zone === "frost") return 2;
   if (p.zone === "echo") return 3;
   if (w.level === 1) {
      if (p.s < rowS(13)) return 6;
      if (p.s < rowS(27)) return 7;
      return 8;
   }
   return 0;
}
