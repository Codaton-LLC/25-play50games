// THROWAWAY debug probe. Deleted after use.
import { describe, expect, it } from "vitest";
import { botInput, createBot, solveShot, stepTarget } from "./bot";
import { courseFor } from "./course";
import { createRun, createStepInput, pulseAt, pulseForSpeed, step } from "./rules";

describe("debug", () => {
   it("first shot trace", () => {
      const run = createRun(1, 1);
      const bot = createBot(run, 1000 / 60);
      const input = createStepInput();
      let last = 0;
      for (let f = 0; f < 3000 && run.ended === null; f++) {
         botInput(bot, run, input);
         step(run, 1000 / 60, input);
         if (run.simMs - last >= 200) {
            last = run.simMs;
            const h = run.hero;
            console.log(
               `t=${run.simMs} mode=${h.mode} pos=(${h.x.toFixed(1)},${h.y.toFixed(1)},${h.z.toFixed(1)}) vel=(${h.vx.toFixed(1)},${h.vy.toFixed(1)},${h.vz.toFixed(1)}) tgt=${bot.target} aim=${bot.aim ? `${bot.aim.yaw.toFixed(2)}/${(bot.aim.pitch * 57.3).toFixed(0)}/${bot.aim.pulse.toFixed(2)}` : "null"} input=(${input.moveX.toFixed(2)},${input.moveZ.toFixed(2)}) jump=${input.jumpPressed} shots=${run.shots} hits=${run.hits}`,
            );
         }
      }
      expect(true).toBe(true);
   }, 60_000);

   it("solveShot from c0 to p1", () => {
      const course = courseFor(1);
      const t = stepTarget(course, course.plan[0], 0);
      console.log("target", t);
      const solved = solveShot(0, 8, 0, 0, t, () => t);
      console.log("solved", solved ? { yaw: solved.yaw.toFixed(2), pitch: (solved.pitch * 57.3).toFixed(1), v: solved.v.toFixed(2), t: solved.t.toFixed(2), pulse: pulseForSpeed(solved.v).toFixed(2) } : null);
      console.log("pulse at 0..1200:", [0, 300, 600, 900, 1200].map((m) => pulseAt(m).toFixed(2)).join(" "));
      expect(true).toBe(true);
   }, 60_000);
});
