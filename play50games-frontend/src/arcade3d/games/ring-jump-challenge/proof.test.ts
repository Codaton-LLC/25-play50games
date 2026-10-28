// The gate's extra proof (on top of rules.test.ts): every hero with its power mashed on every level
// (Riko at 30/60/144 Hz), spam on all five levels, and mutation probes that show the limits tests read
// the level they claim to (a shorter drop, an extra ring, a softer Ray all fall outside the row).
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { ringJumpChallengeMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS, buildCourse, courseFor, createRun, createStepInput, maxScoreOf, minFinishMs, proposeLimits, step, type RingRun } from "./rules";

function powerRun(level: LevelId, hero: HeroId, fps: number, mash: boolean): RingRun {
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 600_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      input.actionPressed = mash;
      step(run, fms, input);
   }
   return run;
}

describe("every hero power against the limits (honest bot, power mashed)", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: every hero lands with the plain bot, and with its power mashed never leaves the server limits`, () => {
         const lim = ringJumpChallengeMeta.levels![level - 1].scoring;
         for (const hero of HEROES) {
            const plain = powerRun(level, hero.id, 60, false);
            expect(plain.ended, `${hero.id} plain`).toBe("win");
            expect(withinServerLimits(plain.score, plain.finishMs, lim)).toBe(true);
            for (const fps of hero.id === "riko" ? [30, 60, 144] : [60]) {
               const mashed = powerRun(level, hero.id, fps, true);
               const d = mashed.ended === "win" ? mashed.finishMs : mashed.simMs;
               expect(mashed.score, `${hero.id} ${fps} Hz`).toBeLessThanOrEqual(lim.maxScore);
               if (mashed.ended === "win") expect(withinServerLimits(mashed.score, d, lim), `${hero.id} ${fps} Hz`).toBe(true);
            }
         }
      }, 300_000);
   }
});

describe("spam stays inside the limits (all five levels)", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: 40 spam runs (random stick, dive held and mashed, power mashed, random frame times, any hero) never beat the limits`, () => {
         const lim = ringJumpChallengeMeta.levels![level - 1].scoring;
         for (let seed = 1; seed <= 40; seed++) {
            const rng = createRng(seed * 104729 + level);
            const run = createRun(seed, level, HEROES[seed % HEROES.length].id);
            const input = createStepInput();
            for (let f = 0; f < 14_000 && run.ended === null; f++) {
               if (f % 10 === 0) {
                  input.moveX = rng() * 2 - 1;
                  input.moveZ = rng() * 2 - 1;
                  input.jumpHeld = rng() < 0.7;
               }
               input.jumpPressed = rng() < 0.5;
               input.actionPressed = rng() < 0.3;
               step(run, 4 + rng() * 46, input);
            }
            expect(run.score).toBeLessThanOrEqual(lim.maxScore);
            if (run.ended === "win") {
               expect(run.finishMs).toBeGreaterThanOrEqual(lim.minDurationMs);
               expect(withinServerLimits(run.score, run.finishMs, lim)).toBe(true);
            }
         }
      }, 120_000);
   }
});

describe("mutation probes: the limits tests read the level they claim to", () => {
   it("no two levels share a limits row; each row is its own course's proposeLimits; meta ships them in order", () => {
      const rows = LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]));
      expect(new Set(rows).size).toBe(5);
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(proposeLimits(id, courseFor(id)));
         expect(PROPOSED_LEVEL_LIMITS[id].maxDurationMs).toBe(LEVELS[id].durationMs + 1000);
         expect(ringJumpChallengeMeta.levels![id - 1].id).toBe(id);
         expect(ringJumpChallengeMeta.levels![id - 1].scoring.minDurationMs).toBe(PROPOSED_LEVEL_LIMITS[id].minDurationMs);
      }
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: a mutated level (a 15 % shorter drop, or a 30 % longer par) falls outside its limits row`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         const shorter = buildCourse({ ...LEVELS[level], depth: Math.round(LEVELS[level].depth * 0.85) });
         const accepts = (lb: number) => lim.minDurationMs <= lb && lim.minDurationMs >= lb * 0.94;
         expect(accepts(minFinishMs(courseFor(level)))).toBe(true);
         if (!courseFor(level).boss) expect(accepts(minFinishMs(shorter)), "depth read").toBe(false);
         const longerPar = buildCourse({ ...LEVELS[level], parMs: Math.round(LEVELS[level].parMs * 1.3) });
         expect(maxScoreOf(longerPar), "par read").toBeGreaterThan(lim.maxScore);
      });
   }

   it("a swapped read would fail: no level's row matches another level's course", () => {
      for (const a of LEVEL_IDS) for (const b of LEVEL_IDS) if (a !== b) expect(PROPOSED_LEVEL_LIMITS[b]).not.toEqual(proposeLimits(a, courseFor(a)));
   });
});
