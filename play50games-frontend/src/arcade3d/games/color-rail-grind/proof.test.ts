// The gate's extra proof (on top of rules.test.ts): every hero with its power mashed on every level,
// spam on all five levels, and mutation probes that show the limits tests read the level they claim.
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { PROPOSED_LEVEL_LIMITS, buildCourse, courseFor, createRun, createStepInput, minDurationMsOf, proposeLimits, runTimeMs, step, type RailRun } from "./rules";
import { colorRailGrindMeta } from "./meta";

function powerRun(level: LevelId, hero: HeroId, fps: number, mash: boolean): RailRun {
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

describe("every hero power against the limits (honest bot, power mashed)", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: every hero clears with the plain bot; with its power mashed (60 Hz; Zuno at 30/60/144) a finish never beats the floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const hero of HEROES) {
            const plain = powerRun(level, hero.id, 60, false);
            expect(plain.ended, `${hero.id} plain`).toBe("win");
            expect(runTimeMs(plain)).toBeGreaterThanOrEqual(lim.minDurationMs);
            for (const fps of hero.id === "zuno" ? [30, 60, 144] : [60]) {
               const mashed = powerRun(level, hero.id, fps, true);
               if (mashed.ended === "win") expect(runTimeMs(mashed), `${hero.id} ${fps} Hz`).toBeGreaterThanOrEqual(lim.minDurationMs);
            }
         }
      }, 240_000);
   }
});

describe("spam stays inside the limits (all five levels)", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: 40 spam runs (random hops, jumps, crouches, switches and power, random frame times and yaws, any hero) never beat the floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
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
               input.switchPressed = rng() < 0.2;
               input.yaw = rng() * 6.3;
               step(run, 4 + rng() * 46, input);
            }
            if (run.ended === "win") expect(runTimeMs(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
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
         expect(PROPOSED_LEVEL_LIMITS[id].timeBaseMs).toBe(LEVELS[id].durationMs);
         expect(colorRailGrindMeta.levels![id - 1].id).toBe(id);
      }
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: a mutated level (a 30 % faster grind) falls outside the limits window`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         const accepts = (lb: number) => lim.minDurationMs <= lb && lim.minDurationMs >= lb * 0.9;
         expect(accepts(minDurationMsOf(courseFor(level)))).toBe(true);
         const faster = buildCourse({ ...LEVELS[level], speed: LEVELS[level].speed * 1.3 });
         expect(accepts(minDurationMsOf(faster)), "speed read").toBe(false);
      });
   }

   it("a swapped read would fail: no level's row matches another level's course", () => {
      for (const a of LEVEL_IDS) for (const b of LEVEL_IDS) if (a !== b) expect(PROPOSED_LEVEL_LIMITS[b]).not.toEqual(proposeLimits(courseFor(a)));
   });
});
