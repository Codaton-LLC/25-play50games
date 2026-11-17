// The gate's extra proof (on top of rules.test.ts): every hero with its power mashed on every level,
// spam on all five levels (random stick, jumps, power mashed, random frame times), and
// mutation probes that show the limits rows read the level they claim to.
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { neonCubeJumpMeta } from "./meta";
import { buildCourse, courseFor } from "./course";
import { PROPOSED_LEVEL_LIMITS, createRun, createStepInput, maxBonusMs, minFinishMs, proposeLimits, step, submittedMs, type NeonRun } from "./rules";

function powerRun(level: LevelId, hero: HeroId, fps: number, mash: boolean): NeonRun {
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 400_000 / fms && run.ended === null; f++) {
      botInput(bot, run, input);
      if (mash && f % 3 === 0) input.actionPressed = true;
      step(run, fms, input);
   }
   return run;
}

/** The server's check for a time game: the submitted time inside [min, max]. */
const inside = (run: NeonRun, lim: { minDurationMs: number; maxDurationMs: number }) => submittedMs(run) >= lim.minDurationMs && submittedMs(run) <= lim.maxDurationMs;

describe("every hero power against the limits (honest bot, power mashed)", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: every hero clears with the plain bot, and with its power mashed never beats the floor`, () => {
         const lim = neonCubeJumpMeta.levels![level - 1].scoring;
         for (const hero of HEROES) {
            const plain = powerRun(level, hero.id, 60, false);
            expect(plain.ended, `${hero.id} plain`).toBe("win");
            expect(inside(plain, lim), `${hero.id} plain`).toBe(true);
            for (const fps of hero.id === "riko" ? [30, 60, 144] : [60]) {
               const mashed = powerRun(level, hero.id, fps, true);
               if (mashed.ended === "win") expect(submittedMs(mashed), `${hero.id} ${fps} Hz`).toBeGreaterThanOrEqual(lim.minDurationMs);
            }
         }
      }, 900_000);
   }
});

describe("spam stays inside the limits (all five levels)", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: 30 spam runs never beat the floor`, () => {
         const lim = neonCubeJumpMeta.levels![level - 1].scoring;
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
               input.jumpPressed = rng() < 0.3;
               input.actionPressed = rng() < 0.2;
               step(run, 4 + rng() * 46, input);
            }
            if (run.ended === "win") expect(submittedMs(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
         }
      }, 300_000);
   }
});

describe("mutation probes: the limits rows read the level they claim to", () => {
   it("no two levels share a row; each row is its own course's proposeLimits; meta ships them in order", () => {
      const rows = LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]));
      expect(new Set(rows).size).toBe(5);
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(proposeLimits(courseFor(id)));
         expect(PROPOSED_LEVEL_LIMITS[id].maxDurationMs).toBe(LEVELS[id].durationMs);
         expect(neonCubeJumpMeta.levels![id - 1].id).toBe(id);
         expect(neonCubeJumpMeta.levels![id - 1].scoring.minDurationMs).toBe(PROPOSED_LEVEL_LIMITS[id].minDurationMs);
         expect(neonCubeJumpMeta.levels![id - 1].scoring.maxScore).toBe(PROPOSED_LEVEL_LIMITS[id].maxScore);
      }
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: a closer goal or more orbs move the floor below the row's`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         const shorter = buildCourse(level);
         for (const c of shorter.cubes) c.z *= 0.6;
         if (shorter.boss) shorter.boss.wakeZ *= 0.6;
         expect(proposeLimits(shorter).minDurationMs, "distance read").toBeLessThan(lim.minDurationMs);
         const extra = buildCourse(level);
         for (let k = 0; k < 30; k++) extra.orbs.push({ x: 0, y: 0, z: 0 });
         expect(maxBonusMs(extra)).toBeGreaterThan(maxBonusMs(courseFor(level)));
         expect(proposeLimits(extra).minDurationMs, "bonus read").toBeLessThan(lim.minDurationMs);
         expect(lim.minDurationMs).toBeLessThanOrEqual(minFinishMs(courseFor(level)) - maxBonusMs(courseFor(level)));
      });
   }
});
