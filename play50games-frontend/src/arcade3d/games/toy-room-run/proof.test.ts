// The gate's extra proof (on top of rules.test.ts): every hero with its power mashed on every level,
// spam on all five levels, and mutation probes that show the limits tests read
// the level they claim.
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { botRun } from "./bot";
import { HEROES } from "./heroes";
import { LEVELS } from "./levels";
import { PROPOSED_LEVEL_LIMITS, buildCourse, courseFor, createRun, createStepInput, minDurationMsOf, proposeLimits, runTimeMs, step, travelMetres, type ToyRun } from "./rules";

const submitted = (run: ToyRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

describe("every hero power against the limits (honest bot, power mashed)", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: every hero clears with the plain bot; with its power mashed a finish never beats the floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const hero of HEROES) {
            const plain = botRun(level, 60, hero.id);
            expect(plain.ended, `${hero.id} plain`).toBe("win");
            for (const fps of hero.id === "riko" ? [30, 60, 144] : [60]) {
               const mashed = botRun(level, fps, hero.id, true);
               if (mashed.ended === "win") expect(submitted(mashed), `${hero.id} ${fps} Hz`).toBeGreaterThanOrEqual(lim.minDurationMs);
            }
         }
      }, 240_000);
   }
});

describe("spam stays inside the limits (all five levels)", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: 30 spam runs (random stick, jump and power, random frame times, any hero) never beat the floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (let seed = 1; seed <= 30; seed++) {
            const rng = createRng(seed * 104729 + level);
            const run = createRun(seed, level, HEROES[seed % HEROES.length].id);
            const input = createStepInput();
            for (let f = 0; f < 6000 && run.ended === null; f++) {
               if (f % 10 === 0) {
                  input.moveX = rng() * 2 - 1;
                  input.moveZ = rng() * 2 - 1;
               }
               input.jumpPressed = rng() < 0.3;
               input.actionPressed = rng() < 0.2;
               step(run, 4 + rng() * 46, input);
            }
            if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
         }
      }, 120_000);
   }
});

describe("mutation probes: the limits tests read the level they claim to", () => {
   it("no two levels share a limits row; each row is its own course's proposeLimits", () => {
      const rows = LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]));
      expect(new Set(rows).size).toBe(5);
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(proposeLimits(id, courseFor(id)));
   });

   for (const level of [1, 2, 3, 4] as LevelId[]) {
      it(`level ${level}: a finish 20 % nearer falls outside the limits window`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         const accepts = (lb: number) => lim.minDurationMs <= lb && lim.minDurationMs >= lb * 0.94;
         expect(accepts(minDurationMsOf(courseFor(level)))).toBe(true);
         const spec = LEVELS[level];
         const near = { ...spec, finish: { x: spec.finish.x, z: spec.finish.z * 0.8 } };
         const shorter = buildCourse(near);
         expect(travelMetres(shorter)).toBeLessThan(travelMetres(courseFor(level)));
         expect(accepts(minDurationMsOf(shorter)), "finish read").toBe(false);
      });
   }
});
