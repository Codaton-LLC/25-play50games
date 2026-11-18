// Every hero clears every level with the plain bot. A mashed power, and random spam, never beat the floor.
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { STAT, V_X_CAP, bossMinMs, courseFor, createRun, createStepInput, finalScore, minDurationMsOf, proposeLimits, PROPOSED_LEVEL_LIMITS, reachX, runTimeMs, step, travelFloorMs, type SwingRun } from "./rules";
import { skyHookSwingMeta } from "./meta";
import type { Course } from "./course";

const submitted = (run: SwingRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function powerRun(level: LevelId, hero: HeroId, fps: number, mash: boolean): SwingRun {
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run);
   const input = createStepInput();
   for (let f = 0; f < 600_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      if (mash) input.actionPressed = true;
      step(run, fms, input);
   }
   return run;
}

function accepts(level: LevelId, lb: number): boolean {
   const lim = PROPOSED_LEVEL_LIMITS[level];
   return lim.minDurationMs <= lb && lim.minDurationMs >= lb * 0.88;
}

for (const level of LEVEL_IDS) {
      it(`level ${level}: every hero clears with the plain bot, and a mashed finish stays inside the row`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const hero of HEROES) {
            const plain = powerRun(level, hero.id, 60, false);
            expect(plain.ended, `${hero.id} plain`).toBe("win");
            expect(submitted(plain), `${hero.id} plain time`).toBeGreaterThanOrEqual(lim.minDurationMs);
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

describe("spam stays inside the limits", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: 40 spam runs never beat the floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (let seed = 1; seed <= 40; seed++) {
            const rng = createRng(seed * 104729 + level);
            const run = createRun(seed, level, HEROES[seed % HEROES.length].id);
            const input = createStepInput();
            for (let f = 0; f < 12_000 && run.ended === null; f++) {
               if (f % 10 === 0) {
                  input.moveX = rng() * 2 - 1;
                  input.moveZ = rng() * 2 - 1.5;
                  input.jumpHeld = rng() < 0.6;
               }
               input.jumpPressed = rng() < 0.5;
               input.actionPressed = rng() < 0.3;
               input.yaw = (rng() - 0.5) * Math.PI;
               step(run, 4 + rng() * 46, input);
            }
            if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
         }
      }, 120_000);
   }
});

describe("the limits read this level", () => {
   it("no two levels share a row, and meta ships them in order", () => {
      const rows = LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]));
      expect(new Set(rows).size).toBe(5);
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(proposeLimits(courseFor(id)));
         expect(PROPOSED_LEVEL_LIMITS[id].timeBaseMs).toBe(LEVELS[id].durationMs);
         expect(skyHookSwingMeta.levels![id - 1].id).toBe(id);
         expect(skyHookSwingMeta.levels![id - 1].scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[id]);
      }
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: a different span falls outside the window the row accepts`, () => {
         const course = courseFor(level);
         expect(accepts(level, minDurationMsOf(course))).toBe(true);
         const shorter: Course = { ...course, span: course.span * 0.5, boss: false };
         if (!course.boss) expect(accepts(level, minDurationMsOf(shorter))).toBe(false);
         let stretched = course.span;
         if (course.boss) {
            const need = bossMinMs() * 1.4;
            while (travelFloorMs({ ...course, span: stretched }) < need) stretched *= 2;
         } else {
            stretched = course.span * 4;
         }
         const longer: Course = { ...course, span: stretched };
         expect(accepts(level, minDurationMsOf(longer))).toBe(false);
      });
   }
});

describe("through the real store", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot with ragged frames is a ranked win inside the level's row, the score from the time`, () => {
         const store = createArcadeStore();
         store.getState().configure({ durationMs: LEVELS[level].durationMs, resultDelayMs: 1100 });
         store.getState().markReady();
         store.getState().start();
         const run = createRun(5, level, HEROES[level % 5].id);
         const bot = createBot(run);
         const input = createStepInput();
         const rng = createRng(11 + level);
         for (let f = 0; f < 80_000 && store.getState().phase !== "over"; f++) {
            advanceRunClock(store, rng() < 0.05 ? 0.05 + rng() * 0.2 : 1 / 60);
            const dt = playedFrameDt(store.getState());
            if (dt <= 0) continue;
            botInput(bot, run, input);
            const ev = step(run, dt * 1000, input);
            if (ev.finished) {
               store.getState().setStat(STAT.orbs, run.orbs);
               store.getState().setStat(STAT.finishMs, run.finishMs);
               store.getState().setStat(STAT.comboMs, run.combo.bonusTotal);
               store.getState().end("win");
            } else if (ev.timeup) store.getState().end("timeup");
         }
         const s = store.getState();
         expect(s.endReason).toBe("win");
         expect(run.simMs).toBeLessThanOrEqual(s.elapsedMs + 1);
         const fin = finalScore(s);
         const rules = skyHookSwingMeta.levels![level - 1].scoring;
         const sent = normalizeRun({ slug: "sky-hook-swing", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-28T00:00:00Z" }, rules);
         expect(isRankedRun(rules, s.endReason)).toBe(true);
         expect(sent.durationMs).toBe(submitted(run));
         expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
         expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
         expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
         // the honest run never touches the reach bound
         expect(run.finishMs).toBeGreaterThan(travelFloorMs(run.course) * 1.4);
      }, 60_000);
   }
});

describe("the reach bound", () => {
   it("x never passes startX + V_X_CAP * t, under spam with random camera yaws and frame times, on every level", () => {
      for (const level of LEVEL_IDS) {
         for (let seed = 1; seed <= 12; seed++) {
            const rng = createRng(seed * 31 + level * 7);
            const run = createRun(seed, level, HEROES[seed % 5].id);
            const input = createStepInput();
            for (let f = 0; f < 4000 && run.ended === null; f++) {
               input.moveX = rng() * 2 - 1;
               input.moveZ = rng() * 2 - 1;
               input.yaw = (rng() - 0.5) * Math.PI * 2;
               input.jumpPressed = rng() < 0.3;
               input.actionPressed = rng() < 0.25;
               step(run, 1 + rng() * 49, input);
               expect(run.hero.x).toBeLessThanOrEqual(reachX(run) + 1e-9);
            }
         }
      }
      expect(V_X_CAP).toBe(22);
   });

   it("honest bots never come near it: the best pace from the start stays under 80 % of V_X_CAP", () => {
      for (const level of LEVEL_IDS) {
         for (const hero of HEROES) {
            const run = createRun(2, level, hero.id);
            const bot = createBot(run);
            const input = createStepInput();
            const rng = createRng(level * 5 + 3);
            let worst = 0;
            for (let f = 0; f < 200_000 && run.ended === null; f++) {
               botInput(bot, run, input);
               step(run, rng() < 0.05 ? 50 : 1000 / 60, input);
               if (run.simMs > 100) worst = Math.max(worst, (run.hero.x - run.startX) / (run.simMs / 1000));
            }
            expect(run.ended, `${hero.id} L${level}`).toBe("win");
            expect(worst, `${hero.id} L${level}`).toBeLessThan(0.8 * V_X_CAP);
         }
      }
   }, 120_000);
});
