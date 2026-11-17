// The per-level score-limit proof (arcade-score-limits skill, once per level), shared by limits.*.test.ts.
import { describe, expect, it } from "vitest";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { PROOF_MIN_WIN_S, PROPOSED_LEVEL_LIMITS, TIME_BONUS_PER_SECOND, objectiveCeiling } from "../rules";
import { playBot, playPure, type BotKind } from "./bots";

const FRAMES = [30, 60, 144] as const;
const SEEDS = 200;

export function describeLimitProof(id: LevelId): void {
   const rules = PROPOSED_LEVEL_LIMITS[id];
   const level = LEVELS[id];
   describe(`beach-lifeguard L${id}: score limits and clearing`, () => {
      const sweep = (kind: BotKind) => {
         const out = { wins: 0, best: 0, minWinMs: Infinity, runs: [] as ReturnType<typeof playPure>[] };
         for (let seed = 1; seed <= SEEDS; seed++) {
            const r = playPure(id, seed, kind, FRAMES[seed % 3]);
            out.runs.push(r);
            if (r.endReason === "win") {
               out.wins++;
               out.best = Math.max(out.best, r.score);
               out.minWinMs = Math.min(out.minWinMs, r.elapsedMs);
            }
         }
         return out;
      };
      const oracle = sweep("oracle");
      const greedy = sweep("greedy");

      it("every oracle, greedy, idle and spam run is inside the limits and the cap is a no-op (200 seeds, 30/60/144 Hz)", () => {
         for (const s of [oracle, greedy, sweep("idle"), sweep("spam")]) {
            for (const r of s.runs) {
               expect(withinServerLimits(r.score, r.elapsedMs, rules)).toBe(true);
               if (r.endReason === "win") expect(r.run.uncapped).toBe(r.score);
               expect(capScore(r.score, r.elapsedMs, rules)).toBe(r.score);
            }
         }
      });

      it("the proof's earliest win is at most 0.8 x the fastest bot win, and the line covers the peak from it", () => {
         const fastest = Math.min(oracle.minWinMs, greedy.minWinMs) / 1000;
         expect(PROOF_MIN_WIN_S[id]).toBeLessThanOrEqual(0.8 * fastest + 0.01);
         const M = PROOF_MIN_WIN_S[id];
         const D = level.durationMs / 1000;
         const peak = objectiveCeiling(level) + TIME_BONUS_PER_SECOND * Math.floor(D - M);
         expect(rules.maxScore).toBeGreaterThanOrEqual(peak);
         expect(rules.base).toBe(objectiveCeiling(level));
         // B(t) <= base + pps t for every win time t >= M
         for (let t = M; t <= D; t += 0.25) expect(objectiveCeiling(level) + TIME_BONUS_PER_SECOND * Math.floor(D - t)).toBeLessThanOrEqual(rules.base + rules.maxPointsPerSec * t);
         expect(rules.minDurationMs).toBeLessThanOrEqual(fastest * 1000);
         expect(rules.maxDurationMs).toBe(level.durationMs);
      });

      it("the limit is tight: the best bot reaches >= 90 % of maxScore", () => {
         expect(Math.max(oracle.best, greedy.best)).toBeGreaterThanOrEqual(0.9 * rules.maxScore);
      });

      it("the honest (greedy) bot clears >= 99 % of seeds; idle never clears", () => {
         expect(greedy.wins / SEEDS).toBeGreaterThanOrEqual(0.99);
         for (let seed = 1; seed <= 20; seed++) expect(playPure(id, seed, "idle", 30).endReason).not.toBe("win");
      });

      it("through the real store (createArcadeStore, 30/60/144 Hz and random frames): within the limits, the pure sweep agrees", () => {
         for (const kind of ["oracle", "greedy", "idle", "spam"] as const) {
            for (let seed = 1; seed <= 3; seed++) {
               for (const fr of [...FRAMES, "random"] as const) {
                  const { end, run } = playBot(id, seed, kind, fr);
                  expect(withinServerLimits(end.score, end.elapsedMs, rules)).toBe(true);
                  if (end.endReason === "win") expect(run.uncapped).toBe(end.score);
                  if (fr !== "random") {
                     // the store's first play frame is the rest of the countdown frame, so the clocks differ
                     // by under one frame: the same end, the score within one second of time bonus
                     const pure = playPure(id, seed, kind, fr);
                     expect(end.endReason).toBe(pure.endReason);
                     expect(Math.abs(end.score - pure.score)).toBeLessThanOrEqual(TIME_BONUS_PER_SECOND);
                  }
               }
            }
         }
      });
   });
}
