// The one-line coach: what to do right now. Each room opens with its own hint (levels.ts); after that
// the coach reads the room: coins to gather, the quota, the door, a lost swarm, drones, Magnus's
// windows. Pure: reads the world, returns a code the Scene publishes and the Hud turns into text.
import type { Hero, World } from "./rules";

export const COACH = [
   "", // 0: show the room's own hint
   "Walk past the coins: they follow you",
   "Lead your swarm into the piggy bank",
   "Door open: go!",
   "Coins dropped! They return to their pile in 3 s",
   "A drone has your coins: flip to + and get close",
   "Magnus slams: match his sign to ride it out",
   "His core is open: flip to the opposite sign!",
   "Block storm: be - to catch it, flip to + to throw it back",
   "Hold the block until his core opens, then flip to +",
   "His core is up: + on a floor pad launches you into it",
   "Magnus is down: through the door!",
   "Tap Action to flip your sign. Hold it for your hero power",
] as const;

/** How long a room's own hint stays up after entering it. */
export const ROOM_HINT_MS = 7000;

export function coachFor(w: World, h: Hero, roomMs: number): number {
   if (h.ended) return 0;
   const room = w.rooms[h.room];
   const m = w.magnus;
   if (room.def.boss && m && m.active) {
      if (room.doorOpen) return 11;
      const s = m.state;
      if (s.phase === 0) return s.step === "vulnerable" ? 7 : 6;
      if (s.phase === 1) return m.block.alive && m.block.held === h.index ? 9 : 8;
      return 10;
   }
   if (roomMs < ROOM_HINT_MS) return 0;
   if (room.doorOpen) return 3;
   if (room.drones.some((d) => d.carrying > 0)) return 5;
   if (room.coins.some((c) => c.state === "lost")) return 4;
   if (h.swarm === 0) return 1;
   if (h.swarm + room.banked >= room.def.need) return 2;
   return w.level === 1 && h.room === 0 ? 2 : 12;
}
