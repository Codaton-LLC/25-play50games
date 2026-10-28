// THROWAWAY debug probe 2. Deleted after use.
import { describe, expect, it } from "vitest";
import { botInput, createBot } from "./bot";
import { createRun, createStepInput, step } from "./rules";

describe("debug2", () => {
   it("trace the fire itself", () => {
      const run = createRun(1, 1);
      const bot = createBot(run, 1000 / 60);
      const input = createStepInput();
      for (let f = 0; f < 200 && run.ended === null; f++) {
         botInput(bot, run, input);
         const before = { mode: run.hero.mode, ay: run.hero.aimYaw, ap: run.hero.aimPitch, stick: [input.moveX, input.moveZ], jp: input.jumpPressed };
         step(run, 1000 / 60, input);
         if (run.events.fired) {
            const g = run.ghost!;
            console.log(
               `FIRED t=${run.simMs} before=${before.mode} aimYaw=${before.ay.toFixed(2)} aimPitch=${(before.ap * 57.3).toFixed(1)} stick=(${before.stick[0].toFixed(2)},${before.stick[1].toFixed(2)}) jp=${before.jp} | ghost v=${g.v.toFixed(2)} pitch=${(g.pitch * 57.3).toFixed(1)} yaw=${g.yaw.toFixed(2)} | vel after=(${run.hero.vx.toFixed(2)},${run.hero.vy.toFixed(2)},${run.hero.vz.toFixed(2)})`,
            );
            break;
         }
      }
      expect(true).toBe(true);
   }, 60_000);
});
