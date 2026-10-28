// THROWAWAY event trace. Deleted after use.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { botInput, createBot } from "./bot";
import { createRun, createStepInput, step, type CannonRun, type StepEvents } from "./rules";

function trace(level: number, maxMs = 75000): void {
   const run = createRun(1, level as 1);
   const bot = createBot(run, 1000 / 60);
   const input = createStepInput();
   for (let f = 0; f < 600_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, 1000 / 60, input);
      const ev = run.events;
      const p = (e: string) =>
         console.log(`t=${run.simMs} ${e} pos=(${run.hero.x.toFixed(1)},${run.hero.y.toFixed(1)},${run.hero.z.toFixed(1)}) tgt=${bot.target} shots=${run.shots} hits=${run.hits}`);
      if (ev.fired) p(`FIRE p=${ev.pulse.toFixed(2)}${ev.aimTimeout ? " TIMEOUT" : ""}${ev.autoFire ? " AUTO" : ""}`);
      if (ev.caught) p(`CAUGHT c${run.hero.cannon}`);
      if (ev.mounted) p(`MOUNT c${run.hero.cannon}`);
      if (ev.landed) p(`LAND p${ev.landedOn}`);
      if (ev.bounced >= 0) p(`BOUNCE t${ev.bounced}`);
      if (ev.balloon >= 0) p(`BALLOON b${ev.balloon}`);
      if (ev.lost) p("LOST");
      if (ev.finished) p("FINISH");
   }
   console.log(`END ${run.ended} t=${run.simMs} shots=${run.shots} hits=${run.hits} orbs=${run.orbs}`);
}

describe("trace", () => {
   it("L1", () => {
      trace(1, 20000);
      expect(true).toBe(true);
   }, 120_000);
   it("L3 tail", () => {
      trace(3, 30000);
      expect(true).toBe(true);
   }, 120_000);
   it("L5", () => {
      trace(5, 60000);
      expect(true).toBe(true);
   }, 240_000);
   void (0 as unknown as CannonRun);
   void (0 as unknown as StepEvents);
   void LEVEL_IDS;
});
