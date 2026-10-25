// The per-level score-limit proof run by the bots (test-only; one file per level so they run in parallel).
import { describe, expect, it } from "vitest";
import { capScore, withinServerLimits } from "../../../core/limits";
import type { LevelId } from "../../../types";
import { LEVELS } from "../levels";
import { LIMITS } from "../meta";
import { playBot, playRules, type Frames } from "./bots";

const FRAMES: readonly Frames[] = [30, 60, 144, "random"];

export function describeLevelLimits(id: LevelId): void {
   const limits = LIMITS[id - 1];
   const n = LEVELS[id].orders;
   describe(`burger-delivery-scooter L${id} score limits (bots through the real store)`, () => {
      it("oracle, greedy, idle and spam stay inside the limits at 30 / 60 / 144 Hz and random frames; capScore is a no-op", () => {
         for (let seed = 1; seed <= 12; seed++) for (const kind of ["oracle", "greedy", "idle", "spam"] as const) {
            const r = playBot(id, seed, kind, FRAMES[seed % FRAMES.length]);
            expect(withinServerLimits(r.score, r.elapsedMs, limits), `${kind} seed ${seed}: ${r.score} in ${r.elapsedMs} ms`).toBe(true);
            expect(capScore(r.score, r.elapsedMs, limits)).toBe(r.score);
            expect(r.run.score).toBe(r.score);
            if (kind === "idle" || kind === "spam") { expect(r.endReason).not.toBe("win"); expect(r.score).toBe(0); }
         }
      });

      it("the honest (greedy) bot and the oracle each clear at least 99 % of 200 seeds (30 / 60 / 144 Hz); idle and spam never", () => {
         let honest = 0, oracle = 0, best = 0;
         for (let seed = 1; seed <= 200; seed++) {
            const g = playRules(id, seed, "greedy", ([30, 60, 144] as const)[seed % 3]);
            if (g.end === "win") honest++;
            const o = playRules(id, seed, "oracle", ([144, 30, 60] as const)[seed % 3]);
            if (o.end === "win") oracle++;
            best = Math.max(best, o.score, g.score);
            expect(o.score).toBeLessThanOrEqual(limits.maxScore);
            for (const kind of ["idle", "spam"] as const) {
               const r = playRules(id, seed, kind, 30);
               expect(r.end).not.toBe("win");
               expect(r.score).toBe(0);
            }
         }
         expect(honest / 200).toBeGreaterThanOrEqual(0.99);
         expect(oracle / 200).toBeGreaterThanOrEqual(0.99);
         // the limit is tight: the best bot reaches 90 % of maxScore
         expect(best / limits.maxScore).toBeGreaterThanOrEqual(0.9);
      });

      if (LEVELS[id].wet) it("a spoiled order (a wet patch) is retried and its slot pays once", () => {
         for (let seed = 1; seed <= 6; seed++) {
            const r = playBot(id, seed, "wetRetry", 60);
            expect(r.run.misses).toBe(1);
            expect(r.endReason).toBe("win");
            expect(r.run.delivered).toBe(n);
            expect(r.score).toBeLessThanOrEqual(140 * n + 4 * Math.floor(LEVELS[id].durationMs / 1000 - r.elapsedMs / 1000));
            expect(withinServerLimits(r.score, r.elapsedMs, limits)).toBe(true);
         }
      });
   });
}
