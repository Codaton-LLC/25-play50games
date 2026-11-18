// The gate's extra proof (on top of rules.test.ts): every hero with its power mashed on every level,
// spam on all five levels (any end: a win, a lost run, a time-up), and mutation probes that show the
// limits tests read the level they claim.
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { PROPOSED_LEVEL_LIMITS, buildCourse, courseFor, createRun, createStepInput, maxScoreBound, proposeLimits, scoreBoundAt, scoreOf, step, type TempleRun } from "./rules";
import { templeCoinRushMeta } from "./meta";

function powerRun(level: LevelId, hero: HeroId, fps: number, mash: boolean): TempleRun {
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run, fms);
   bot.mash = mash;
   const input = createStepInput();
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   return run;
}

const inside = (level: LevelId, run: TempleRun) => {
   const rules = templeCoinRushMeta.levels![level - 1].scoring;
   return withinServerLimits(scoreOf(run), Math.max(rules.minDurationMs, run.simMs), rules) && scoreOf(run) <= scoreBoundAt(run.course, run.simMs);
};

describe("every hero power against the limits (honest bot, power mashed)", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: every hero clears with the plain bot, and with its power mashed (60 Hz; Kiro at 30/60/144) the run stays inside every limit`, () => {
         for (const hero of HEROES) {
            const plain = powerRun(level, hero.id, 60, false);
            expect(plain.ended, `${hero.id} plain`).toBe("win");
            expect(inside(level, plain), `${hero.id} plain`).toBe(true);
            for (const fps of hero.id === "kiro" ? [30, 60, 144] : [60]) {
               const mashed = powerRun(level, hero.id, fps, true);
               expect(mashed.ended, `${hero.id} mashed`).not.toBeNull();
               expect(inside(level, mashed), `${hero.id} ${fps} Hz`).toBe(true);
            }
         }
      }, 240_000);
   }
});

describe("spam stays inside the limits (all five levels)", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: 40 spam runs (random lanes, jumps, rolls and power mashing, random frame times and yaws, any hero) stay inside every limit at every end`, () => {
         for (let seed = 1; seed <= 40; seed++) {
            const rng = createRng(seed * 104729 + level);
            const run = createRun(seed, level, HEROES[seed % HEROES.length].id);
            const input = createStepInput();
            for (let f = 0; f < 20_000 && run.ended === null; f++) {
               input.left = rng() < 0.15;
               input.right = rng() < 0.15;
               input.up = rng() < 0.15;
               input.down = rng() < 0.1;
               input.jumpPressed = rng() < 0.3;
               input.actionPressed = rng() < 0.3;
               input.yaw = rng() * 6.3;
               step(run, 4 + rng() * 46, input);
            }
            expect(inside(level, run), `seed ${seed}`).toBe(true);
         }
      }, 120_000);
   }
});

describe("mutation probes: the limits tests read the level they claim to", () => {
   it("no two levels share a limits row; each row is its own course's proposeLimits; meta ships them in order", () => {
      const rows = LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]));
      expect(new Set(rows).size).toBe(5);
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(proposeLimits(courseFor(id)));
         expect(templeCoinRushMeta.levels![id - 1].id).toBe(id);
      }
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: a mutated level (a 30 % faster run, or a doubled finish bonus) breaks its maxScore`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         expect(maxScoreBound(courseFor(level))).toBeLessThanOrEqual(lim.maxScore);
         const faster = buildCourse({ ...LEVELS[level], speed: LEVELS[level].speed * 1.3 });
         expect(maxScoreBound(faster), "speed read").toBeGreaterThan(lim.maxScore);
         const richer = buildCourse({ ...LEVELS[level], finishBonus: LEVELS[level].finishBonus * 2 });
         expect(maxScoreBound(richer), "bonus read").toBeGreaterThan(lim.maxScore);
      });
   }

   it("a swapped read would fail: no level's row matches another level's course", () => {
      for (const a of LEVEL_IDS) for (const b of LEVEL_IDS) if (a !== b) expect(PROPOSED_LEVEL_LIMITS[b]).not.toEqual(proposeLimits(courseFor(a)));
   });
});
