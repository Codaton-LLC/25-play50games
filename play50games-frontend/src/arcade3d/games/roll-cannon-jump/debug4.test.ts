// THROWAWAY debug probe 3. Deleted after use.
import { describe, expect, it } from "vitest";
import { botInput, createBot } from "./bot";
import { createRun, createStepInput, step } from "./rules";

describe("debug3", () => {
   it("trace the c3->c4 flight", () => {
      const run = createRun(1, 1);
      const bot = createBot(run, 1000 / 60);
      const input = createStepInput();
      let shots = 0;
      for (let f = 0; f < 6000 && run.ended === null; f++) {
         botInput(bot, run, input);
         const preJump = input.jumpPressed;
         step(run, 1000 / 60, input);
         if (run.events.fired) {
            shots += 1;
            const g = run.ghost!;
            console.log(`FIRE#${shots} t=${run.simMs} p=${run.events.pulse.toFixed(3)} ghostPitch=${((g.pitch * 180) / Math.PI).toFixed(1)} ghostV=${g.v.toFixed(2)} pos=(${run.hero.x.toFixed(2)},${run.hero.y.toFixed(2)},${run.hero.z.toFixed(2)}) v=(${run.hero.vx.toFixed(1)},${run.hero.vy.toFixed(1)},${run.hero.vz.toFixed(1)}) stick=(${input.moveX.toFixed(2)},${input.moveZ.toFixed(2)})`);
         }
         if (shots === 4 && run.hero.mode === "fly" && run.simMs % 50 < 17) {
            console.log(`  t=${run.simMs} pos=(${run.hero.x.toFixed(2)},${run.hero.y.toFixed(2)},${run.hero.z.toFixed(2)}) v=(${run.hero.vx.toFixed(1)},${run.hero.vy.toFixed(1)},${run.hero.vz.toFixed(1)}) tgt=${bot.target} in=(${input.moveX.toFixed(2)},${input.moveZ.toFixed(2)})`);
         }
         if (shots === 4 && (run.events.caught || run.events.lost || run.events.landed)) {
            console.log(`  EVENT ${run.events.caught ? "CAUGHT " + run.hero.cannon : run.events.lost ? "LOST" : "LANDED " + run.events.landedOn} t=${run.simMs} pos=(${run.hero.x.toFixed(2)},${run.hero.y.toFixed(2)},${run.hero.z.toFixed(2)})`);
            break;
         }
         void preJump;
      }
      expect(true).toBe(true);
   }, 120_000);
});
