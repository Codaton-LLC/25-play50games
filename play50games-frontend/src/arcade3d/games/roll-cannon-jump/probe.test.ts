// THROWAWAY probe: prints the limits table and honest-bot results. Deleted after use.
import { describe, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { DEFAULT_HERO, HEROES } from "./heroes";
import {
   PROPOSED_LEVEL_LIMITS,
   bossMinMs,
   createRun,
   createStepInput,
   dashFloorMs,
   minDurationMsOf,
   minFinishMs,
   progressFloorMs,
   runTimeMs,
   step,
} from "./rules";
import { courseFor } from "./course";

describe("probe", () => {
   it("prints limits", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const lim = PROPOSED_LEVEL_LIMITS[id];
         console.log(
            `L${id} floor=${progressFloorMs(c).toFixed(0)} minFinish=${minFinishMs(c).toFixed(0)} bossMin=${c.boss ? bossMinMs().toFixed(0) : "-"} minDurOf=${minDurationMsOf(c).toFixed(0)} dashFloor=${dashFloorMs(c).toFixed(0)} -> min=${lim.minDurationMs} max=${lim.maxDurationMs} base=${lim.timeBaseMs} maxScore=${lim.maxScore}`,
         );
      }
   }, 60_000);

   it("bot per level per fps", () => {
      for (const id of LEVEL_IDS) {
         for (const fps of [30, 60, 144] as const) {
            const fms = 1000 / fps;
            const run = createRun(1, id, DEFAULT_HERO);
            const bot = createBot(run, fms);
            const input = createStepInput();
            for (let f = 0; f < 600_000 && run.ended === null; f++) {
               botInput(bot, run, input);
               step(run, fms, input);
            }
            const d = run.ended === "win" ? runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal) : NaN;
            console.log(
               `L${id} ${fps}fps hero=${DEFAULT_HERO} ended=${run.ended} finish=${run.finishMs} submitted=${d.toFixed(0)} score=${run.ended === "win" ? Math.floor((PROPOSED_LEVEL_LIMITS[id].timeBaseMs - d) / 10) : "-"} shots=${run.shots} orbs=${run.orbs}/${run.course.orbs.length}+${run.course.rainOrbs.length} main=${run.mainOrbs} hits=${run.hits}`,
            );
         }
      }
   }, 600_000);

   it("bot every hero 60fps", () => {
      for (const id of LEVEL_IDS) {
         for (const hero of HEROES) {
            const run = createRun(1, id, hero.id);
            const bot = createBot(run, 1000 / 60);
            const input = createStepInput();
            for (let f = 0; f < 600_000 && run.ended === null; f++) {
               botInput(bot, run, input);
               step(run, 1000 / 60, input);
            }
            const d = run.ended === "win" ? runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal) : NaN;
            console.log(`L${id} 60fps hero=${hero.id} ended=${run.ended} submitted=${d.toFixed(0)} shots=${run.shots} orbs=${run.orbs} hits=${run.hits}`);
         }
      }
   }, 600_000);
});
