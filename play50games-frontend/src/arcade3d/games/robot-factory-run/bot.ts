// Honest controller: writes the same input as a player. Never mutates the run or teleports.
import { JUNCTION_X, createStepInput, type FactoryRun, type StepInput } from "./rules";
export interface FactoryBot {
   retreat: number;
   targetPlate: number;
}
export const createBot = (): FactoryBot => ({ retreat: -1, targetPlate: -1 });
export function botInput(bot: FactoryBot, r: FactoryRun, out: StepInput = createStepInput()): StepInput {
   Object.assign(out, createStepInput());
   out.roll = true;
   const h = r.hero, b = r.board;
   let tx = 8.2, tz = 0;
   const j = b.turns.findIndex((v) => v !== 0);
   if (j >= 0) {
      tx = JUNCTION_X[j];
      tz = 2;
      if (h.plate === j || (bot.retreat === j && Math.abs(h.z - 3.2) > 0.2)) {
         tz = 3.2;
         bot.retreat = j;
      }
      else
         bot.retreat = -1;
   }
   else if (r.boss && r.boss.hp > 0) {
      if (r.boss.phase === 0) {
         tx = 7.2;
         tz = 2.8;
      }
      else if (r.boss.phase === 1) {
         tx = 6;
         tz = h.plate === 4 || (bot.retreat === 4 && h.z < 4.75) ? 5 : 4;
         bot.retreat = tz === 5 ? 4 : -1;
      }
      else {
         // Walk the ramp before approaching the vents, then roll-drop in the open window.
         if (h.y < 1.8) {
            if (h.z > -3.1 && Math.abs(h.x) > 0.12) {
               tx = 0;
               tz = h.z;
            }
            else if (h.z > -3.8) {
               tx = 0;
               tz = -4;
            }
            else {
               tx = 4.2;
               tz = -4;
            }
            out.roll = false;
         }
         else {
            tx = 6.5;
            tz = -4;
            out.jumpPressed = h.grounded && r.boss.step === "vulnerable";
         }
      }
   }
   else if (b.charged < (r.level === 1 ? 2 : 3)) {
      tx = 7;
      tz = 2.8;
   }
   const dx = tx - h.x, dz = tz - h.z;
   const d = Math.hypot(dx, dz);
   if (d > 0.12) {
      out.moveX = dx / d;
      out.moveZ = dz / d;
   }
   return out;
}
