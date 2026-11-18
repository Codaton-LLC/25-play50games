// The one-line coach: what to do right now. L1 teaches the three beats (walk the red bridge as Riko,
// switch the dark node to blue for Nyla, tag Vexa where red turns purple); then the coach reads the
// cell ahead and the Keeper's windows. Pure: reads the world, returns a code the Scene publishes.
import { DC, DR, T } from "./levels";
import { HERO_MASK, heroForMask, tileAt, type Team, type World } from "./rules";

export const COACH = [
   "Light the way: walk onto a switch to colour its node",
   "A red bridge: only Riko walks red. Tag to Riko (Space / Tag)",
   "A dark node: step on its switch to turn it blue, then cross as Nyla",
   "Red crosses blue: purple ahead. Step on, and tag Vexa as you go",
   "Bump a prism to turn its beam toward an anchor",
   "Orange flickers: step on as it lights up, and keep going",
   "Tag before you step on: this bridge needs another hero",
   "The Keeper's plate wants a colour: send that beam into it",
   "Stomp! Get off the glowing row",
   "The gate is open: go!",
   "A drone swallows the beam it flies through: wait for it to pass",
   "That node only shines for 10 s: run!",
] as const;

export function coachFor(w: World, t: Team): number {
   if (t.ended) return 0;
   const k = w.keeper;
   if (k && k.active) {
      if (w.exitOpen) return 9;
      if (k.state.step === "telegraph" && t.r === k.stompRow) return 8;
      return 7;
   }
   const r = t.r + DR[t.facing];
   const c = t.c + DC[t.facing];
   const ahead = tileAt(w, r, c) === T.CHASM ? w.bridge[r * w.map.w + c] : 0;
   if (ahead === 5) return 5;
   if (ahead && heroForMask(ahead) && HERO_MASK[t.heroId] !== ahead && ahead !== 7) return 6;
   if (w.cfg.drones.length && w.drones.some((d) => Math.abs(d.r - t.r) < 4)) return 10;
   if (w.nodeUntil.some((u) => u < Infinity)) return 11;
   if (w.level === 1) {
      if (t.r >= 11) return 1;
      if (t.r >= 6 && w.nodeColor[2] === 0) return 2;
      if (t.r <= 6) return 3;
   }
   if (w.level === 2 && w.prismKind[0] === 1) return 4;
   return 0;
}
