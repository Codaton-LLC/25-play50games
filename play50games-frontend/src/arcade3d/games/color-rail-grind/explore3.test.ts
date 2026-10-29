import { it } from "vitest";
import { createRun, createStepInput, step } from "./rules";
import { createBot, botInput } from "./bot";
it("missed", () => {
   for (const lv of [2, 3] as const) {
      const run = createRun(7, lv, "kiro");
      const bot = createBot(run);
      const inp = createStepInput();
      const laneAt = new Map<number, string>();
      while (run.ended === null) {
         botInput(bot, run, inp);
         step(run, 1000 / 60, inp);
         laneAt.set(Math.round(run.hero.z), `${run.hero.lane}/p${run.hero.piece}/x${run.hero.x.toFixed(1)}`);
      }
      const c = run.course;
      const miss = c.orbs.map((o, i) => ({ o, i })).filter(({ o, i }) => o.kind === "main" && !run.collected[i]);
      console.log("MISS", lv, miss.map(({ o }) => `L${o.lane}p${o.piece}@${o.z.toFixed(0)} hero ${laneAt.get(Math.round(o.z))}`).join(" | "));
   }
});
