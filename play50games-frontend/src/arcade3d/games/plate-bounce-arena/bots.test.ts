// Every hero clears every table with the honest bot (flips only, like a player), inside the level's
// row and well inside the clock cap; the bot's finish never beats the travel floor.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { PROPOSED_LEVEL_LIMITS, createRun, createStepInput, minFinishMs, runTimeMs, step, type PinRun } from "./rules";

function botRun(level: LevelId, hero: HeroId, seed: number): PinRun {
   const run = createRun(seed, level, hero);
   const bot = createBot(run);
   const input = createStepInput();
   for (let f = 0; f < 60 * 500 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, 1000 / 60, input);
   }
   return run;
}

describe("every hero clears every table with the honest bot", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const hero of HEROES) {
            const run = botRun(level, hero.id, 3);
            expect(run.ended, `${hero.id} L${level}`).toBe("win");
            const sent = runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);
            expect(sent).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.table));
            expect(run.finishMs, `${hero.id} L${level} pace`).toBeLessThan(0.85 * LEVELS[level].durationMs);
         }
      }, 600_000);
   }
});
