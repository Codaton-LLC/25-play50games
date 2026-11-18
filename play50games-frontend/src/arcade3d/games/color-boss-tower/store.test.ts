// The honest bot through the real arcade store (createArcadeStore) on every level, with ragged frames
// (mostly 60 fps, some long ones the core caps at 50 ms): the run is published to the store exactly as
// Scene.tsx does it, ends in a ranked win, and what the client submits is inside that level's server
// limits (README "Server limits", meta.levels[n].scoring = arcade-games.json).
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { colorBossTowerMeta } from "./meta";
import { STAT, createRun, createStepInput, finalScore, step } from "./rules";

describe("the honest bot through the real store", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: ragged frames, a ranked win inside the level's server limits`, () => {
         const store = createArcadeStore();
         store.getState().configure({ resultDelayMs: 1600 });
         store.getState().markReady();
         store.getState().start();
         const run = createRun(5, level);
         const bot = createBot(run);
         const input = createStepInput();
         const rng = createRng(11);
         for (let f = 0; f < 200_000 && store.getState().phase !== "over"; f++) {
            advanceRunClock(store, rng() < 0.05 ? 0.05 + rng() * 0.2 : 1 / 60);
            const dt = playedFrameDt(store.getState());
            if (dt <= 0) continue;
            bot.frameMs = dt * 1000;
            botInput(bot, run, input);
            const ev = step(run, dt * 1000, input);
            if (ev.ended && run.ended === "win") {
               store.getState().setStat(STAT.finishMs, run.finishMs);
               store.getState().setStat(STAT.orbs, run.orbs);
               store.getState().setStat(STAT.comboMs, run.combo.bonusTotal);
               store.getState().end("win");
            } else if (ev.ended) {
               store.getState().end(run.ended === "lose" ? "lose" : "timeup");
            }
         }
         const s = store.getState();
         expect(s.endReason).toBe("win");
         expect(run.finishMs).toBeLessThanOrEqual(s.elapsedMs + 1);
         const fin = finalScore(s);
         const rules = colorBossTowerMeta.levels![level - 1].scoring;
         const sent = normalizeRun({ slug: "color-boss-tower", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-11-18T00:00:00Z" }, rules);
         expect(isRankedRun(rules, s.endReason)).toBe(true);
         expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
         expect(sent.durationMs).toBeLessThanOrEqual(rules.maxDurationMs);
         expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
         expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
      }, 120_000);
   }
});
