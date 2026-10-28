// The gate's extra proof (on top of rules.test.ts): every hero plain and with its power mashed on every
// level, spam on all five levels, and mutation probes that show the limits tests read the level they claim.
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { buildCourse } from "./tunnel";
import { PROPOSED_LEVEL_LIMITS, courseFor, createRun, createStepInput, minDurationMsOf, proposeLimits, runTimeMs, step, type WindRun } from "./rules";
import { windTunnelEscapeMeta } from "./meta";

const submitted = (run: WindRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function powerRun(level: LevelId, hero: HeroId, fps: number, mash: boolean): WindRun {
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 400_000 / fms && run.ended === null; f++) {
      botInput(bot, run, input);
      // mashing the power: a press on every 7th frame the bot is not using Action itself
      if (mash && !input.actionPressed && !input.actionHeld && f % 7 === 0) {
         input.actionPressed = true;
         input.actionHeld = false;
      }
      step(run, fms, input);
   }
   return run;
}

describe("every hero against the limits (honest bot, plain and with the power mashed)", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: every hero clears with the plain bot; with its power mashed (60 Hz; Riko at 30/60/144) a finish never beats the floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const hero of HEROES) {
            const plain = powerRun(level, hero.id, 60, false);
            expect(plain.ended, `${hero.id} plain`).toBe("win");
            expect(submitted(plain)).toBeGreaterThanOrEqual(lim.minDurationMs);
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
      it(`level ${level}: 25 spam runs (random stick, Jump and Action mashed and held, random frame times, any hero) never beat the floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (let seed = 1; seed <= 25; seed++) {
            const rng = createRng(seed * 104729 + level);
            const run = createRun(seed, level, HEROES[seed % HEROES.length].id);
            const input = createStepInput();
            for (let f = 0; f < 3000 && run.ended === null; f++) {
               if (f % 10 === 0) {
                  input.moveX = rng() * 2 - 1;
                  input.moveZ = rng() * 2 - 1.5;
                  input.jumpHeld = rng() < 0.6;
               }
               input.jumpPressed = rng() < 0.4;
               input.actionPressed = rng() < 0.25;
               input.actionHeld = input.actionPressed || rng() < 0.4;
               step(run, 4 + rng() * 46, input);
            }
            if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
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
         expect(windTunnelEscapeMeta.levels![id - 1].id).toBe(id);
      }
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: its own bound sits in the window; the same rooms with a 20 % shorter timer give another row; the rooms are read (one room fewer moves the bound out)`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         const accepts = (lb: number) => lim.minDurationMs <= lb && lim.minDurationMs >= lb * 0.88;
         expect(accepts(minDurationMsOf(courseFor(level)))).toBe(true);
         const shorter = proposeLimits(buildCourse(level, { ...LEVELS[level], durationMs: LEVELS[level].durationMs * 0.8 }));
         expect(shorter.maxScore).not.toBe(lim.maxScore);
         // the bound reads the course's length: a goal 25 m nearer would be rejected by these limits
         const c = courseFor(level);
         const nearer = { ...c, goalNearZ: c.goalNearZ + 25, goal: { ...c.goal, z1: c.goal.z1 + 25 } };
         expect(minDurationMsOf(nearer)).toBeLessThan(lim.minDurationMs);
      });
   }

   it("a swapped read would fail: no level's row matches another level's course or timer, and each bot sits inside its own row", () => {
      for (const a of LEVEL_IDS) {
         for (const b of LEVEL_IDS) {
            if (a === b) continue;
            expect(PROPOSED_LEVEL_LIMITS[b]).not.toEqual(proposeLimits(courseFor(a)));
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
