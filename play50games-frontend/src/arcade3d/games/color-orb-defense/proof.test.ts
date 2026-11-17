// The score limits per level (README "Scoring and the proof"): every hero wins every level with the
// honest bot inside the row; the bot through the real store submits a ranked run; a spamming player never
// beats the bound nor finishes early; the pinned rows are proposeLimits.
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { colorOrbDefenseMeta } from "./meta";
import { PROPOSED_LEVEL_LIMITS, bossMinMs, courseFor, createRun, createStepInput, finalScore, maxScoreOf, minFinishMs, proposeLimits, step, type DefenseRun } from "./rules";

function botRun(level: LevelId, hero: HeroId, seed: number, frame: () => number): DefenseRun {
   const run = createRun(seed, level, hero);
   const bot = createBot(run);
   const input = createStepInput();
   for (let f = 0; f < 80_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, frame(), input);
   }
   return run;
}

describe("every hero holds every level with the honest bot, inside the row", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const hero of HEROES) {
            for (const hz of [30, 60]) {
               const run = botRun(level, hero.id, 3, () => 1000 / hz);
               expect(run.ended, `${hero.id} ${hz} Hz`).toBe("win");
               expect(run.score).toBeLessThanOrEqual(lim.maxScore);
               expect(run.finishMs).toBeGreaterThanOrEqual(lim.minDurationMs);
               expect(run.finishMs).toBeLessThan(0.9 * LEVELS[level].durationMs);
            }
         }
      }, 180_000);
   }
});

describe("through the real store", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: a ragged-frame bot run is ranked and inside the server's limits`, () => {
         const store = createArcadeStore();
         store.getState().configure({ durationMs: LEVELS[level].durationMs, resultDelayMs: 1200 });
         store.getState().markReady();
         store.getState().start();
         const run = createRun(5, level, HEROES[level % 5].id);
         const bot = createBot(run);
         const input = createStepInput();
         const rng = createRng(17 + level);
         for (let f = 0; f < 120_000 && store.getState().phase !== "over"; f++) {
            advanceRunClock(store, rng() < 0.05 ? 0.05 + rng() * 0.2 : 1 / 60);
            const dt = playedFrameDt(store.getState());
            if (dt <= 0) continue;
            botInput(bot, run, input);
            const ev = step(run, dt * 1000, input);
            store.getState().setScore(run.score);
            if (ev.finished) store.getState().end("win");
            else if (ev.gameOver) store.getState().end("lose");
            else if (ev.timeup) store.getState().end("timeup");
         }
         const s = store.getState();
         expect(s.endReason).toBe("win");
         const fin = finalScore(s);
         const rules = colorOrbDefenseMeta.levels![level - 1].scoring;
         const sent = normalizeRun({ slug: "color-orb-defense", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-11-17T00:00:00Z" }, rules);
         expect(isRankedRun(rules, s.endReason)).toBe(true);
         expect(sent.score).toBe(run.score);
         expect(withinServerLimits(sent.score, sent.durationMs, rules)).toBe(true);
      }, 120_000);
   }
});

describe("the bound under spam", () => {
   it("random play never scores over maxScore nor ends before minDuration", () => {
      for (const level of LEVEL_IDS) {
         for (let seed = 1; seed <= 3; seed++) {
            const rng = createRng(seed * 53 + level);
            const run = createRun(seed, level, HEROES[seed % 5].id);
            const input = createStepInput();
            for (let f = 0; f < 30_000 && run.ended === null; f++) {
               input.moveX = rng() * 2 - 1;
               input.moveZ = rng() * 2 - 1;
               input.yaw = (rng() - 0.5) * Math.PI * 2;
               input.jumpPressed = rng() < 0.05;
               input.actionPressed = rng() < 0.05;
               step(run, 1 + rng() * 49, input);
               expect(run.score).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[level].maxScore);
            }
            if (run.ended === "win") expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.arena));
         }
      }
   }, 120_000);
});

describe("the limits read this level", () => {
   it("the pinned rows are proposeLimits, distinct per level, in meta's order; the Mortar's floor counts on level 5", () => {
      const rows = LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]));
      expect(new Set(rows).size).toBe(5);
      for (const id of LEVEL_IDS) {
         const a = courseFor(id);
         expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(proposeLimits(a));
         expect(colorOrbDefenseMeta.levels![id - 1].scoring).toMatchObject({ kind: "points", maxScore: PROPOSED_LEVEL_LIMITS[id].maxScore });
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBe(maxScoreOf(a));
         expect(PROPOSED_LEVEL_LIMITS[id].minDurationMs).toBeLessThanOrEqual(minFinishMs(a));
         expect((PROPOSED_LEVEL_LIMITS[id].maxScore * 1000) / PROPOSED_LEVEL_LIMITS[id].minDurationMs).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxPointsPerSec);
      }
      expect(bossMinMs()).toBeGreaterThan(10_000);
      expect(minFinishMs(courseFor(5))).toBe(courseFor(5).wavesEndMs + bossMinMs());
   });
});
