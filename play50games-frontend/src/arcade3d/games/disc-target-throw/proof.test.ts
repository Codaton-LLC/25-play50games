// The gate's extra proof (on top of rules.test.ts): every hero with its power mashed on every level,
// spam on all five levels (random stick, Throw held / let go at random, power mashed, random frame
// times), and mutation probes that show the limits rows read the level they claim to.
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { discTargetThrowMeta } from "./meta";
import { buildCourse, courseFor } from "./course";
import { PROPOSED_LEVEL_LIMITS, createRun, createStepInput, maxScoreOf, minFinishMs, proposeLimits, step, type DiscRun } from "./rules";

function powerRun(level: LevelId, hero: HeroId, fps: number, mash: boolean): DiscRun {
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 400_000 / fms && run.ended === null; f++) {
      botInput(bot, run, input);
      if (mash) input.actionPressed = f % 3 === 0;
      step(run, fms, input);
   }
   return run;
}

describe("every hero power against the limits (honest bot, power mashed)", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: every hero clears with the plain bot, and with its power mashed never leaves the server limits`, () => {
         const lim = discTargetThrowMeta.levels![level - 1].scoring;
         for (const hero of HEROES) {
            const plain = powerRun(level, hero.id, 60, false);
            expect(plain.ended, `${hero.id} plain`).toBe("win");
            expect(withinServerLimits(plain.score, plain.finishMs, lim), `${hero.id} plain`).toBe(true);
            for (const fps of hero.id === "riko" ? [30, 60, 144] : [60]) {
               const mashed = powerRun(level, hero.id, fps, true);
               expect(mashed.score, `${hero.id} ${fps} Hz`).toBeLessThanOrEqual(lim.maxScore);
               if (mashed.ended === "win") expect(withinServerLimits(mashed.score, mashed.finishMs, lim), `${hero.id} ${fps} Hz`).toBe(true);
            }
         }
      }, 600_000);
   }
});

describe("spam stays inside the limits (all five levels)", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: 30 spam runs never beat the limits`, () => {
         const lim = discTargetThrowMeta.levels![level - 1].scoring;
         for (let seed = 1; seed <= 30; seed++) {
            const rng = createRng(seed * 104729 + level);
            const run = createRun(seed, level, HEROES[seed % HEROES.length].id);
            const input = createStepInput();
            for (let f = 0; f < 8_000 && run.ended === null; f++) {
               if (f % 10 === 0) {
                  input.moveX = rng() * 2 - 1;
                  input.moveZ = rng() * 2 - 1;
                  input.yaw = rng() * Math.PI * 2;
               }
               if (f % 4 === 0) input.throwHeld = rng() < 0.6;
               input.actionPressed = rng() < 0.2;
               step(run, 4 + rng() * 46, input);
            }
            expect(run.score).toBeLessThanOrEqual(lim.maxScore);
            if (run.ended === "win") {
               expect(run.finishMs).toBeGreaterThanOrEqual(lim.minDurationMs);
               expect(withinServerLimits(run.score, run.finishMs, lim)).toBe(true);
            }
         }
      }, 300_000);
   }
});

describe("mutation probes: the limits rows read the level they claim to", () => {
   it("no two levels share a limits row; each row is its own course's proposeLimits; meta ships them in order", () => {
      const rows = LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]));
      expect(new Set(rows).size).toBe(5);
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(proposeLimits(courseFor(id)));
         expect(PROPOSED_LEVEL_LIMITS[id].maxDurationMs).toBe(LEVELS[id].durationMs + 1000);
         expect(discTargetThrowMeta.levels![id - 1].id).toBe(id);
         expect(discTargetThrowMeta.levels![id - 1].scoring.maxScore).toBe(PROPOSED_LEVEL_LIMITS[id].maxScore);
         expect(discTargetThrowMeta.levels![id - 1].scoring.minDurationMs).toBe(PROPOSED_LEVEL_LIMITS[id].minDurationMs);
      }
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: an extra target or a longer par lifts maxScore over its row`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         const extra = buildCourse(level);
         const t = extra.targets.find((q) => q.base > 0)!;
         extra.targets.push({ ...t, id: extra.targets.length });
         expect(maxScoreOf(extra), "targets read").toBeGreaterThan(lim.maxScore);
         const par = buildCourse(level);
         par.parMs = Math.round(par.parMs * 1.3);
         expect(maxScoreOf(par), "par read").toBeGreaterThan(lim.maxScore);
         const lb = minFinishMs(courseFor(level));
         expect(lim.minDurationMs).toBeLessThanOrEqual(lb);
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(lb * 0.94);
      });
   }
});
