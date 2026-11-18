// The level end (levelEnd.ts): the honest bot's clear gives the stars, the no-hit badge and the
// secrets to Menu 2 progress (menu2/progress, a memory storage here), and the star screen's stats.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { STAR_BIT } from "@/arcade3d/menu2/stars/stars";
import { levelOf } from "@/arcade3d/menu2/progress/progress";
import { loadProgress, memoryProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { SECRETS, STAR_TARGET_MS } from "./progression";
import { createRun, createStepInput, runTimeMs, step, type RuinRun } from "./rules";
import { createBot, botInput } from "./bot";
import { SLUG, levelEndStats, runStars } from "./levelEnd";

function botRun(level: LevelId): RuinRun {
   const run = createRun(1, level);
   const bot = createBot(run, 1000 / 60);
   const input = createStepInput();
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, 1000 / 60, input);
   }
   return run;
}

describe("flooded-ruins-escape level end", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: the honest bot's clear earns the clear and time stars, and progress records the clear`, () => {
         const run = botRun(id);
         expect(run.ended).toBe("win");
         const t = runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);
         expect(t).toBeLessThan(STAR_TARGET_MS[id]);
         const r = runStars(run);
         expect(r.clear).toBe(true);
         expect(r.goal).toBe(true);
         // the all-orbs star counts the orbs every hero can reach (bonus orbs are extra)
         expect(r.allOrbs).toBe(run.mainOrbs === run.course.mainOrbs);
         expect(r.noHit).toBe(run.hits === 0);
         const storage = memoryProgressStorage();
         const end = levelEndStats(run, null, storage);
         expect(end.stars & STAR_BIT.clear).toBe(STAR_BIT.clear);
         expect(end.stars).toBe(r.mask);
         expect(end.newStars).toBe(r.mask);
         expect(end.noHit).toBe(r.noHit ? 1 : 0);
         expect(end.xp).toBeGreaterThan(0);
         const saved = levelOf(loadProgress(null, storage), SLUG, id);
         expect(saved?.clears).toBe(1);
         // the same clear again earns no new stars
         expect(levelEndStats(run, null, storage).newStars).toBe(0);
      }, 120_000);
   }

   it("a run that did not clear earns no star, but keeps the secrets it found", () => {
      const run = createRun(1, 1);
      run.secrets.found[0] = 1;
      run.secrets.count = 1;
      const r = runStars(run);
      expect(r.clear).toBe(false);
      expect(r.mask).toBe(0);
      const storage = memoryProgressStorage();
      const end = levelEndStats(run, null, storage);
      expect(end.stars).toBe(0);
      expect(end.secrets & 1).toBe(1);
      expect(end.newSecrets).toBe(1);
      expect(SECRETS[1][0].id).toBe("sunken");
   });
});
