// The per-level score-limit proof (arcade-score-limits skill, once per level), test-only. Each level has
// two files (the careful bot; the oracle, idle and spam bots) so the ten run in parallel.
import { describe, expect, it } from "vitest";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { PROOF_EARLIEST_WIN_S, PROPOSED_LEVEL_LIMITS, TIME_BONUS_PER_SEC, createRun, objectiveCeiling, step } from "../rules";
import { playBot, type FrameKind } from "./bots";

const FRAMES: readonly FrameKind[] = [30, 60, 144];
const SEEDS = 200;

/** The careful (honest) bot clears >= 99 % of 200 seeds, every run inside the limits. */
export function proveClears(id: LevelId): void {
   const rules = PROPOSED_LEVEL_LIMITS[id];
   describe(`mars-rover-mission L${id}: the careful bot`, () => {
      it(`clears >= 99 % of ${SEEDS} seeds at 30/60/144 Hz, inside the limits, never faster than the proof's earliest win`, () => {
         let wins = 0;
         for (let seed = 1; seed <= SEEDS; seed++) {
            const r = playBot(id, seed, "careful", FRAMES[seed % 3]);
            expect(withinServerLimits(r.score, r.elapsedMs, rules)).toBe(true);
            expect(r.uncapped).toBe(r.score);
            expect(capScore(r.score, r.elapsedMs, rules)).toBe(r.score);
            if (r.endReason === "win") {
               wins++;
               expect(r.elapsedMs / 1000).toBeGreaterThanOrEqual(PROOF_EARLIEST_WIN_S[id]);
            }
         }
         expect(wins).toBeGreaterThanOrEqual(Math.ceil(SEEDS * 0.99));
      }, 600_000);
   });
}

/** The proof's numbers, the oracle (best >= 90 % of maxScore), idle (never clears) and spam. */
export function proveLimits(id: LevelId): void {
   const rules = PROPOSED_LEVEL_LIMITS[id];
   const level = LEVELS[id];
   describe(`mars-rover-mission L${id} limits: maxScore ${rules.maxScore}, base ${rules.base}, pps ${rules.maxPointsPerSec}`, () => {
      it("base = Bobj; the peak at the earliest win fits maxScore (+3-5 %) and the rate line holds for every later win", () => {
         const m = PROOF_EARLIEST_WIN_S[id];
         const d = level.durationMs / 1000;
         expect(rules.base).toBe(objectiveCeiling(level.sites));
         expect(rules.maxDurationMs).toBe(level.durationMs);
         const peak = rules.base + TIME_BONUS_PER_SEC * Math.floor(d - m);
         expect(rules.maxScore).toBeGreaterThanOrEqual(peak);
         expect(rules.maxScore).toBeLessThanOrEqual(Math.ceil(peak * 1.05));
         for (let t = m; t <= d; t += 0.01) expect(rules.base + TIME_BONUS_PER_SEC * Math.floor(d - t)).toBeLessThanOrEqual(rules.base + rules.maxPointsPerSec * t + 1e-9);
      });
      it(`oracle: inside the limits on ${SEEDS} seeds, never faster than the earliest win, best >= 90 % of maxScore`, () => {
         let best = 0;
         for (let seed = 1; seed <= SEEDS; seed++) {
            const r = playBot(id, seed, "oracle", FRAMES[(seed + 1) % 3]);
            expect(withinServerLimits(r.score, r.elapsedMs, rules)).toBe(true);
            expect(r.uncapped).toBe(r.score);
            if (r.endReason === "win") expect(r.elapsedMs / 1000).toBeGreaterThanOrEqual(PROOF_EARLIEST_WIN_S[id]);
            best = Math.max(best, r.score);
         }
         expect(best).toBeGreaterThanOrEqual(0.9 * rules.maxScore);
      }, 600_000);
      it("idle never clears and scores 0: 200 seeds through the rules, 5 through the store", () => {
         for (let seed = 1; seed <= SEEDS; seed++) {
            const run = createRun(seed, level, id);
            while (!run.over) step(run, { moveX: 0, moveY: 0 }, 1 / 20);
            expect(run.over).not.toBe("win");
            expect(run.score).toBe(0);
         }
         for (let seed = 1; seed <= 5; seed++) {
            const r = playBot(id, seed, "idle", 30);
            expect(r.endReason).not.toBe("win");
            expect(r.score).toBe(0);
         }
      }, 120_000);
      it("input spam stays inside the limits and never clears (40 seeds, random frames)", () => {
         for (let seed = 1; seed <= 40; seed++) {
            const r = playBot(id, seed, "spam", "random");
            expect(withinServerLimits(r.score, r.elapsedMs, rules)).toBe(true);
            expect(r.endReason).not.toBe("win");
         }
      }, 300_000);
   });
}
