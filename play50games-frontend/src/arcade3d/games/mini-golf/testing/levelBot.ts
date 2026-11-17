// Tests only: the level bots (rules.levels-<n>.test.ts).
import { describe, expect, it } from "vitest";
import type { LevelId } from "../../../types";
import { capScore, withinServerLimits } from "../../../core/limits";
import { advanceRunClock, playedFrameDt } from "../../../core/frameLoop";
import { createRng } from "../../../core/math";
import { fixedFrames, randomFrames, simulateRun } from "../../../core/testing/botHarness";
import { createArcadeStore } from "../../../core/useArcadeStore";
import { isLevelCleared } from "../../../core/levels";
import { LEVELS } from "../levels";
import { LEVEL_ACE_LINES, LEVEL_PAR_LINES } from "../levelLines.fixture";
import { miniGolfMeta } from "../meta";
import { advanceRun, canPutt, createRun, currentHole, syncStore, PROPOSED_LEVEL_LIMITS } from "../rules";
import { linePsi } from "../solver";

type Bot = "human" | "oracle" | "spam" | "idle";
export function botRun(id: LevelId, seed: number, bot: Bot) {
   const run = createRun(seed, LEVELS[id]), store = createArcadeStore(), rng = createRng(seed ^ 0x1234567);
   const frame = [fixedFrames(1000 / 30), fixedFrames(1000 / 60), fixedFrames(1000 / 144), randomFrames(seed)][seed % 4];
   let hole = -1, next = 0, frames = 0;
   const end = simulateRun(store, {
      frame,
      step(dt, _time, actions) {
         const h = currentHole(run);
         if (hole !== run.hole) { hole = run.hole; next = 0; }
         let putt = false, psi = 0, power = 0.5;
         if (bot === "human" || bot === "oracle") {
            const q = (bot === "human" ? LEVEL_PAR_LINES : LEVEL_ACE_LINES)[id][hole][next];
            if (q && canPutt(run) && run.holeTicks >= q.w) {
               putt = true; psi = linePsi(h, q); power = q.p; next++;
            }
         } else if (bot === "spam") {
            putt = rng() < 0.5; psi = (rng() - 0.5) * 2 * Math.PI; power = rng();
         }
         advanceRun(run, dt, psi, power, putt);
         syncStore(run, actions.getState());
         // Pauses advance wall-clock frames, never the ball, obstacles or scored run time.
         if (++frames % 777 === 0 && actions.getState().phase === "playing") {
            const before = actions.getState().elapsedMs;
            actions.getState().pause(); advanceRunClock(actions, 0.05);
            expect(playedFrameDt(actions.getState())).toBe(0);
            expect(actions.getState().elapsedMs).toBe(before);
            actions.getState().resume();
         }
      },
   });
   return { end, run };
}

/** The level bots through the real store (one file per level so they run in parallel; suite < 30 s each).
 * human = the level's par witness lines (>= 1 s to aim every first shot, robust over nine start ticks),
 * oracle = the ace lines (the ceiling), spam = random putts, idle = no input. */
const SEEDS: Record<Bot, number> = { human: 100, oracle: 30, spam: 20, idle: 4 };

export function levelBotSuite(id: LevelId): void {
   describe(`mini-golf L${id} bots through the real store`, () => {
      for (const bot of ["human", "oracle", "spam", "idle"] as const) {
         const n = SEEDS[bot];
         it(`${bot}: ${n} seeds, frame rates, pauses and server limits`, { timeout: 120_000 }, () => {
            let clears = 0, best = 0, fastest = Infinity;
            const limits = PROPOSED_LEVEL_LIMITS[id], meta = miniGolfMeta.levels![id - 1];
            for (let seed = 0; seed < n; seed++) {
               const { end, run } = botRun(id, seed * 7919 + 13, bot);
               expect(end.phase).toBe("over");
               expect(withinServerLimits(end.score, end.elapsedMs, limits), `${id}/${bot}/${seed}: ${end.score} @ ${end.elapsedMs}`).toBe(true);
               expect(capScore(end.score, end.elapsedMs, limits)).toBe(end.score);
               expect(run.topSpeed).toBeLessThanOrEqual(6 + 1e-9);
               const clear = isLevelCleared(end.endReason, end.score, meta);
               if (clear) clears++;
               if (bot === "human" || bot === "oracle") {
                  expect(end.endReason, `${id}/${bot}/${seed}: ${run.card}`).toBe("win");
                  expect(run.pickups).toBe(0);
                  expect(run.card.every((s, i) => s > 0 && s <= run.course[i].par)).toBe(true);
                  if (meta.clearScore !== undefined) expect(end.score).toBeGreaterThanOrEqual(meta.clearScore);
               }
               if (bot === "idle") { expect(clear).toBe(false); expect(end.score).toBe(0); }
               best = Math.max(best, end.score); fastest = Math.min(fastest, end.elapsedMs);
            }
            if (bot === "human" || bot === "oracle") expect(clears).toBe(n);
            if (bot === "oracle") expect(best).toBe(limits.maxScore);
         });
      }
   });
}
