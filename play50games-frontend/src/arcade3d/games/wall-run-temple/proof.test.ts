// The score limits per level (README "Scoring and the proof"): every hero wins every level with the
// honest bot; the bot through the real store submits a ranked run inside the level's row; the reach
// bound holds every step under spam with random camera yaws and frame times; honest bots stay under 80 %
// of the pace; the pinned rows are proposeLimits; idle times out unranked.
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { wallRunTempleMeta } from "./meta";
import {
   PROPOSED_LEVEL_LIMITS, STAT, V_PACE, bossMinMs, courseFor, createRun, createStepInput, finalScore, minDurationMsOf, proposeLimits, reachOf, runTimeMs, step,
   travelFloorMs, type WallRun,
} from "./rules";

const submitted = (run: WallRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function botRun(level: LevelId, hero: HeroId, seed: number, frame: (rng: () => number) => number): WallRun {
   const run = createRun(seed, level, hero);
   const bot = createBot(run);
   const input = createStepInput();
   const rng = createRng(seed * 31 + level);
   for (let f = 0; f < 80_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, frame(rng), input);
   }
   return run;
}

describe("every hero wins every level with the honest bot, inside the row", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const hero of HEROES) {
            for (const hz of [30, 60, 144]) {
               const run = botRun(level, hero.id, 3, () => 1000 / hz);
               expect(run.ended, `${hero.id} ${hz} Hz`).toBe("win");
               expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
               expect(Math.floor((lim.timeBaseMs - submitted(run)) / 10)).toBeLessThanOrEqual(lim.maxScore);
            }
         }
      }, 120_000);
   }
});

describe("through the real store", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: a ragged-frame bot run is a ranked win inside the level's row, the score from the time`, () => {
         const store = createArcadeStore();
         store.getState().configure({ durationMs: LEVELS[level].durationMs, resultDelayMs: 1200 });
         store.getState().markReady();
         store.getState().start();
         const run = createRun(5, level, HEROES[level % 5].id);
         const bot = createBot(run);
         const input = createStepInput();
         const rng = createRng(17 + level);
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
         const rules = wallRunTempleMeta.levels![level - 1].scoring;
         const sent = normalizeRun({ slug: "wall-run-temple", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-29T00:00:00Z" }, rules);
         expect(isRankedRun(rules, s.endReason)).toBe(true);
         expect(sent.durationMs).toBe(submitted(run));
         expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
         expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
         expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
      }, 60_000);
   }

   it("idle never wins: the clock cap ends every level unranked", () => {
      for (const level of LEVEL_IDS) {
         const run = createRun(1, level);
         const none = createStepInput();
         for (let f = 0; f < 20_000 && run.ended === null; f++) step(run, 50, none);
         expect(run.ended).toBe("timeup");
         expect(isRankedRun(wallRunTempleMeta.levels![level - 1].scoring, "timeup")).toBe(false);
      }
   });
});

describe("the reach bound", () => {
   it("the Manhattan distance from the start never passes V_PACE * t, under spam with random yaws and frame times", () => {
      for (const level of LEVEL_IDS) {
         for (let seed = 1; seed <= 10; seed++) {
            const rng = createRng(seed * 53 + level);
            const run = createRun(seed, level, HEROES[seed % 5].id);
            const input = createStepInput();
            for (let f = 0; f < 3000 && run.ended === null; f++) {
               input.moveX = rng() * 2 - 1;
               input.moveZ = rng() * 2 - 1;
               input.yaw = (rng() - 0.5) * Math.PI * 2;
               input.jumpPressed = rng() < 0.3;
               input.actionPressed = rng() < 0.2;
               step(run, 1 + rng() * 49, input);
               const m = Math.abs(run.hero.x - run.startX) + Math.abs(run.hero.z - run.startZ);
               expect(m).toBeLessThanOrEqual(reachOf(run) + 1e-9);
            }
         }
      }
   });

   it("honest bots never come near it: their best pace from the start stays under 80 % of V_PACE", () => {
      for (const level of LEVEL_IDS) {
         for (const hero of HEROES) {
            const run = createRun(2, level, hero.id);
            const bot = createBot(run);
            const input = createStepInput();
            let worst = 0;
            for (let f = 0; f < 80_000 && run.ended === null; f++) {
               botInput(bot, run, input);
               step(run, 1000 / 60, input);
               if (run.simMs > 300) worst = Math.max(worst, (Math.abs(run.hero.x - run.startX) + Math.abs(run.hero.z - run.startZ)) / (run.simMs / 1000));
            }
            expect(run.ended, `${hero.id} L${level}`).toBe("win");
            expect(worst, `${hero.id} L${level}`).toBeLessThan(0.8 * V_PACE);
         }
      }
   }, 120_000);

   it("the course is a staircase (+x and +z only), so its length is the Manhattan distance the proof uses", () => {
      for (const level of LEVEL_IDS) {
         const c = courseFor(level);
         for (const leg of c.legs) {
            expect(leg.heading.x >= 0 && leg.heading.z >= 0).toBe(true);
            for (const t of leg.turns) expect(t.x >= 0 && t.z >= 0).toBe(true);
         }
      }
   });
});

describe("the limits read this level", () => {
   it("the pinned rows are proposeLimits, distinct per level, in meta's order; the boss floor counts on level 5", () => {
      const rows = LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]));
      expect(new Set(rows).size).toBe(5);
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(proposeLimits(courseFor(id)));
         expect(PROPOSED_LEVEL_LIMITS[id].timeBaseMs).toBe(LEVELS[id].durationMs);
         expect(wallRunTempleMeta.levels![id - 1].scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[id]);
         expect(PROPOSED_LEVEL_LIMITS[id].minDurationMs).toBeLessThanOrEqual(minDurationMsOf(courseFor(id)));
      }
      expect(bossMinMs()).toBeGreaterThan(5000);
      expect(minDurationMsOf(courseFor(5))).toBeGreaterThanOrEqual(Math.min(travelFloorMs(courseFor(5)), bossMinMs()) - 6000);
   });
});
