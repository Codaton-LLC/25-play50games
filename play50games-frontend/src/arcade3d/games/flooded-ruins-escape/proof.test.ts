// The gate's extra proof (on top of rules.test.ts): every hero with its power mashed on every level,
// spam on all five levels, and mutation probes that show the limits tests read the level they claim.
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { PROPOSED_LEVEL_LIMITS, buildCourse, courseFor, createRun, createStepInput, dashFloorMs, minDurationMsOf, proposeLimits, runTimeMs, step, type Course, type RuinRun } from "./rules";
import { floodedRuinsEscapeMeta } from "./meta";

const submitted = (run: RuinRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function powerRun(level: LevelId, hero: HeroId, fps: number, mash: boolean): RuinRun {
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
      it(`level ${level}: every hero clears with the plain bot, and with its power mashed (60 Hz; Riko at 30/60/144) a finish never beats the floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const hero of HEROES) {
            const plain = powerRun(level, hero.id, 60, false);
            expect(plain.ended, `${hero.id} plain`).toBe("win");
            for (const fps of hero.id === "riko" ? [30, 60, 144] : [60]) {
               const mashed = powerRun(level, hero.id, fps, true);
               if (mashed.ended === "win") {
                  expect(submitted(mashed), `${hero.id} ${fps} Hz`).toBeGreaterThanOrEqual(lim.minDurationMs);
                  expect(Math.floor((lim.timeBaseMs - submitted(mashed)) / 10)).toBeLessThanOrEqual(lim.maxScore);
               }
            }
         }
      }, 240_000);
   }
});

describe("spam stays inside the limits (all five levels)", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: 25 spam runs (random stick and camera yaw, jump mashing and holding, power mashing, random frame times, any hero) never beat the floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (let seed = 1; seed <= 25; seed++) {
            const rng = createRng(seed * 104729 + level);
            const run = createRun(seed, level, HEROES[seed % HEROES.length].id);
            const input = createStepInput();
            for (let f = 0; f < 8000 && run.ended === null; f++) {
               if (f % 10 === 0) {
                  input.moveX = rng() * 2 - 1;
                  input.moveZ = rng() * 2 - 1.5;
                  input.jumpHeld = rng() < 0.6;
                  input.yaw = (rng() - 0.5) * 0.6;
               }
               input.jumpPressed = rng() < 0.5;
               input.actionPressed = rng() < 0.3;
               step(run, 4 + rng() * 46, input);
            }
            if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
         }
      }, 180_000);
   }
});

describe("mutation probes: the limits tests read the level they claim to", () => {
   const accepts = (level: LevelId, course: Course) => {
      const lim = PROPOSED_LEVEL_LIMITS[level];
      const lb = minDurationMsOf(course);
      return lim.minDurationMs <= Math.min(lb, dashFloorMs(course)) && lim.minDurationMs >= Math.min(lb * 0.94, Math.floor(dashFloorMs(course) / 100) * 100);
   };

   it("no two levels share a limits row; each row is its own course's proposeLimits; meta ships them in order", () => {
      const rows = LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]));
      expect(new Set(rows).size).toBe(5);
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(proposeLimits(id, courseFor(id)));
         expect(PROPOSED_LEVEL_LIMITS[id].timeBaseMs).toBe(LEVELS[id].durationMs);
         expect(floodedRuinsEscapeMeta.levels![id - 1].id).toBe(id);
         expect(accepts(id, courseFor(id))).toBe(true);
      }
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: another level's temple read under this level's row falls outside its window, and so does a 30 s longer timer`, () => {
         for (const other of LEVEL_IDS) {
            if (other === level) continue;
            const swapped = buildCourse({ ...LEVELS[level], id: other, boss: LEVELS[other].boss });
            expect(accepts(level, swapped), `level ${level} read as ${other}`).toBe(false);
         }
         const longer = buildCourse({ ...LEVELS[level], durationMs: LEVELS[level].durationMs + 30_000 });
         expect(proposeLimits(level, longer).maxScore).not.toBe(PROPOSED_LEVEL_LIMITS[level].maxScore);
      });
   }

   it("a swapped read would fail: no level's row matches another level's course or timer; each level's bot is inside its own row", () => {
      for (const a of LEVEL_IDS) {
         for (const b of LEVEL_IDS) {
            if (a === b) continue;
            expect(PROPOSED_LEVEL_LIMITS[b]).not.toEqual(proposeLimits(a, courseFor(a)));
            expect(PROPOSED_LEVEL_LIMITS[b].timeBaseMs).not.toBe(LEVELS[a].durationMs);
         }
      }
      for (const level of LEVEL_IDS) {
         const run = powerRun(level, "nami", 60, false);
         expect(run.ended).toBe("win");
         expect(submitted(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
      }
   }, 120_000);
});
