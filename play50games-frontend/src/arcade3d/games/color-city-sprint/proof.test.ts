import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { botInput, botRun, createBot } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { colorCitySprintMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS, courseFor, createRun, createStepInput, minDurationMsOf, proposeLimits, runTimeMs, step } from "./rules";

const submitted = (run: ReturnType<typeof createRun>) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

describe("every hero clears", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const hero of HEROES) {
            const run = botRun(level, 60, hero.id);
            expect(run.ended, hero.id).toBe("win");
            expect(submitted(run), hero.id).toBeGreaterThanOrEqual(lim.minDurationMs);
         }
      }, 60_000);
   }
});

describe("a mashed power does not beat the floor", () => {
   for (const level of [1, 5] as LevelId[]) {
      it(`level ${level}`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const hero of HEROES) {
            const fps = 60;
            const fms = 1000 / fps;
            const run = createRun(1, level, hero.id as HeroId);
            const bot = createBot(run, fms);
            const input = createStepInput();
            const cap = Math.ceil(run.course.timerMs / fms) + 5;
            for (let f = 0; f < cap && run.ended === null; f++) {
               botInput(bot, run, input);
               input.actionPressed = true;
               step(run, fms, input);
            }
            if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
         }
      }, 90_000);
   }
});

describe("spam stays inside the limits", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (let seed = 1; seed <= 8; seed++) {
            const rng = createRng(seed * 104729 + level);
            const run = createRun(seed, level, HEROES[seed % HEROES.length].id);
            const input = createStepInput();
            for (let f = 0; f < 1500 && run.ended === null; f++) {
               if (f % 10 === 0) {
                  input.moveX = rng() * 2 - 1;
                  input.moveZ = rng() * 2 - 1;
                  input.yaw = (rng() - 0.5) * Math.PI;
               }
               input.jumpPressed = rng() < 0.4;
               input.actionPressed = rng() < 0.25;
               step(run, 6 + rng() * 28, input);
            }
            if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
         }
      }, 60_000);
   }
});

describe("the limits read the level they name", () => {
   it("five different rows, each the course's own proposal, and meta ships them in order", () => {
      const rows = LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]));
      expect(new Set(rows).size).toBe(5);
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(proposeLimits(id, courseFor(id)));
         expect(PROPOSED_LEVEL_LIMITS[id].timeBaseMs).toBe(LEVELS[id].timerMs);
         expect(colorCitySprintMeta.levels![id - 1].id).toBe(id);
         expect(colorCitySprintMeta.levels![id - 1].scoring.minDurationMs).toBe(PROPOSED_LEVEL_LIMITS[id].minDurationMs);
         expect(minDurationMsOf(courseFor(id))).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[id].minDurationMs);
      }
   });
});
