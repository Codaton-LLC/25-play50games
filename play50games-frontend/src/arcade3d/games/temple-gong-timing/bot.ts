// The honest bot (tests, `?autoplay=1` in preview builds): it plays through the same StepInput a player
// gives. It leaves the stick at rest (the hero rolls to the next note's gong by himself), presses Strike
// on the frame nearest the beat when the hero is in reach, holds Strike through a drum hold, and jumps a
// shockwave just before it reaches him. `skill` blurs its timing (0 = the frame nearest the beat; a
// human-paced bot presses up to `skill` ms off).
import { createRng } from "@/arcade3d/core/math";
import { SHOCK_SPEED, STRIKE_R } from "./chart";
import { GOOD_MS, PENDING, createStepInput, inReach, type GongRun, type StepInput } from "./rules";

export interface Bot {
   frameMs: number;
   /** the timing blur (ms): 0 = perfect */
   skill: number;
   rng: () => number;
   /** the note the bot pressed for last (it never presses twice for one note) */
   pressed: number;
   /** this note's press is due at this ms (with the blur) */
   aimNote: number;
   aimMs: number;
}

export function createBot(_run: GongRun, frameMs = 1000 / 60, skill = 0, seed = 7): Bot {
   return { frameMs, skill, rng: createRng(seed), pressed: -1, aimNote: -1, aimMs: 0 };
}

export function botInput(bot: Bot, run: GongRun, input: StepInput): void {
   const fresh = createStepInput();
   input.moveX = fresh.moveX;
   input.moveZ = fresh.moveZ;
   input.yaw = 0;
   input.jumpPressed = false;
   input.actionPressed = false;
   if (run.ended !== null) return;
   const now = run.simMs;
   const notes = run.chart.notes;
   // hold Strike through a drum hold
   input.action = run.holding >= 0;

   // the next pending note the hero can strike
   for (let i = run.cursor; i < notes.length; i++) {
      const n = notes[i];
      if (n.t > now + GOOD_MS + bot.frameMs) break;
      if (run.grade[i] !== PENDING || i === bot.pressed) continue;
      if (n.bonus !== "" && !(n.bonus === "cross" && run.heroId === "riko")) continue;
      if (bot.aimNote !== i) {
         bot.aimNote = i;
         bot.aimMs = n.t + (bot.skill > 0 ? (bot.rng() * 2 - 1) * bot.skill : 0);
      }
      // press on the frame whose start is nearest the aim (the press is judged at the next step's start)
      if (Math.abs(bot.aimMs - now) <= bot.frameMs / 2 + 1e-6 || now > bot.aimMs) {
         if (inReach(run, n)) {
            input.actionPressed = true;
            input.action = true;
            bot.pressed = i;
         }
      }
      break;
   }

   // jump a shockwave just before it reaches the hero (its ring is under 1.3 m inside him, coming out)
   const h = run.hero;
   if (h.grounded) {
      const hr = Math.hypot(h.x, h.z);
      for (const s of run.chart.shocks) {
         const ring = SHOCK_SPEED * ((now - s.t) / 1000) + STRIKE_R;
         if (hr - ring >= 0 && hr - ring < 1.3) {
            input.jumpPressed = true;
            break;
         }
      }
   }
}
