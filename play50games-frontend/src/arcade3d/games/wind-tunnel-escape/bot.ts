import { createInput, fanX, roomStart, type WindRun, type WindInput } from "./rules";

// Honest controller: uses only the same stick/action edges as a player. No position writes.
export function botInput(r: WindRun): WindInput {
   const i = createInput(), h = r.hero;
   const toward = (x: number, z: number) => {
      i.moveX = Math.max(-1, Math.min(1, (x - h.x) * 2));
      i.moveZ = Math.max(-1, Math.min(1, (z - h.z) * 2));
   };
   if (r.boss && r.escapeAt < 0) {
      const phase = r.boss.phase;
      const index = phase === 0 ? r.returned.findIndex((v) => !v) : r.crates.findIndex((c) => !c.delivered);
      const f = r.fans[Math.max(0, index)];
      toward(f.x, f.z + 1);
      if (Math.hypot(h.x - f.x, h.z - f.z, h.y - f.y) < 2 && f.dir !== 1) i.actionPressed = true;
      return i;
   }
   const room = r.room, z = roomStart(r, room), y = room * 6;
   const fs = r.fans.filter((f) => f.room === room);
   const upper = fs[1];
   const cross = fs.find((f) => f.baseX === -2.8);
   if (cross?.on && h.y >= y + 4.8 && h.z < z - 6 && h.z > z - 11) {
      toward(-0.6, cross.z);
      if (r.nearFan === cross.index) { i.actionPressed = true; i.jumpHeld = true; }
      return i;
   }
   if (h.y < y + 4.8 && h.z > z - 6) toward(0, z - 3);
   else {
      if (Math.hypot(h.x - fanX(upper, r.ms), h.y - upper.y, h.z - upper.z) < 3 && upper.dir !== 1) {
         i.actionPressed = true;
         toward(fanX(upper, r.ms), upper.z);
      } else toward(0, z - 20);
   }
   return i;
}
