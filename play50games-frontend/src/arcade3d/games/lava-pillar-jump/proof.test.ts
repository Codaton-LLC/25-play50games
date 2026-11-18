// The gate's extra proof (on top of rules.test.ts): every level, every hero power, at 30/60/144 Hz;
// idle and spam on all five levels; and mutation probes that show the limits tests read the right level.
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { PROPOSED_LEVEL_LIMITS, buildCourse, courseFor, createRun, createStepInput, dashFloorMs, minDurationMsOf, runTimeMs, step, type Course, type LavaRun } from "./rules";

const FPS = [30, 60, 144] as const;
const submitted = (run: LavaRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

/** The honest bot with the hero's power pressed as often as the cooldown allows (every frame). */
function powerRun(level: LevelId, hero: HeroId, fps: number, mash: boolean): LavaRun {
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

describe("every hero power against the limits (honest bot, power mashed, 30/60/144 Hz)", () => {
   for (const level of LEVEL_IDS) {
      for (const hero of HEROES) {
         it(`level ${level} ${hero.name} (${hero.power}): a finish never beats the floor or the clock, and the plain bot with this hero still clears`, () => {
            const lim = PROPOSED_LEVEL_LIMITS[level];
            for (const fps of FPS) {
               const plain = powerRun(level, hero.id, fps, false);
               expect(plain.ended, `${hero.id} plain ${fps} Hz`).toBe("win");
               expect(submitted(plain)).toBeGreaterThanOrEqual(lim.minDurationMs);
               const mashed = powerRun(level, hero.id, fps, true);
               if (mashed.ended === "win") {
                  expect(submitted(mashed), `${hero.id} ${fps} Hz`).toBeGreaterThanOrEqual(lim.minDurationMs);
                  expect(submitted(mashed)).toBeLessThanOrEqual(lim.maxDurationMs);
                  // a power may shave a little, never more than the shipped margin
                  expect(Math.floor((lim.timeBaseMs - submitted(mashed)) / 10)).toBeLessThanOrEqual(lim.maxScore);
               }
            }
         }, 120_000);
      }
   }
});

describe("idle never wins, spam stays inside the limits (all five levels)", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: idle times out unranked; 60 spam runs (random stick, jump and power mashing, random frame times, any hero) never beat the floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         const idle = createRun(3, level);
         const none = createStepInput();
         for (let f = 0; f < 40_000 && idle.ended === null; f++) step(idle, 1000 / 60, none);
         expect(idle.ended).not.toBe("win");
         expect(idle.ended === "lose" || idle.ended === "timeup").toBe(true);
         if (idle.ended === "timeup") expect(idle.simMs).toBe(LEVELS[level].durationMs);
         if (idle.ended === "lose") expect(idle.simMs).toBeLessThan(LEVELS[level].durationMs);
         for (let seed = 1; seed <= 60; seed++) {
            const rng = createRng(seed * 104729 + level);
            const run = createRun(seed, level, HEROES[seed % HEROES.length].id);
            const input = createStepInput();
            for (let f = 0; f < 12_000 && run.ended === null; f++) {
               if (f % 10 === 0) {
                  input.moveX = rng() * 2 - 1;
                  input.moveZ = rng() * 2 - 1;
               }
               input.jumpPressed = rng() < 0.5;
               input.actionPressed = rng() < 0.3;
               step(run, 4 + rng() * 46, input);
            }
            if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(run.ended === null || run.ended === "win" || run.ended === "timeup" || run.ended === "lose").toBe(true);
         }
      }, 120_000);
   }
});

describe("mutation probes: the limits tests read the level they claim to", () => {
   it("each level has its own floor and its own clock: no two levels share a limits row", () => {
      const rows = LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]));
      expect(new Set(rows).size).toBe(5);
      // each level's floor is its own (vents can make a longer level's floor shorter, so no order is claimed)
      const floors = LEVEL_IDS.map((id) => minDurationMsOf(courseFor(id)));
      expect(new Set(floors.map((f) => Math.round(f))).size).toBe(5);
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id].timeBaseMs).toBe(LEVELS[id].durationMs);
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: a mutated level (a 30 % lower goal roof, five fewer pillars, or level 5 without Kalder) falls outside the limits window, so the "limits sit under the bound" test would fail on a misread`, () => {
         const spec = LEVELS[level].spec;
         const lim = PROPOSED_LEVEL_LIMITS[level];
         // rules.test.ts accepts a course when lim.min <= its bound lb and lim.min >= min(0.9 lb, its dashed floor):
         // a misread level must fall outside that window
         const accepts = (c: Course) => {
            const lb = minDurationMsOf(c);
            return lim.minDurationMs <= lb && lim.minDurationMs >= Math.min(lb * 0.9, Math.floor(dashFloorMs(c) / 100) * 100);
         };
         expect(accepts(courseFor(level))).toBe(true);
         const lower = buildCourse({ ...LEVELS[level], spec: { ...spec, goalTop: spec.goalTop * 0.7, lavaCap: spec.lavaCap === null ? null : spec.goalTop * 0.7 - 3.2 } });
         const fewer = buildCourse({ ...LEVELS[level], spec: { ...spec, surfaces: spec.surfaces - 5, rises: Math.max(2, spec.rises - 5) } });
         expect(accepts(lower), "goalTop read").toBe(false);
         expect(accepts(fewer), "rises read").toBe(false);
         if (spec.arena) expect(accepts(buildCourse({ ...LEVELS[level], spec: { ...spec, arena: null, lavaCap: null } })), "boss read").toBe(false);
         // and the real course still sits over it
         expect(minDurationMsOf(courseFor(level))).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
      });
   }

   it("a level's honest finish is not inside the limits of the level below it (a swapped read would fail the tightness test)", () => {
      for (const level of [2, 3, 4, 5] as const) {
         const run = powerRun(level, "riko", 60, false);
         expect(run.ended).toBe("win");
         expect(submitted(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[(level - 1) as LevelId].minDurationMs * 1.6 - 1);
      }
   });
});
