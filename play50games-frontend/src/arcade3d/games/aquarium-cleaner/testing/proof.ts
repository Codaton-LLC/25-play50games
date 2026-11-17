// The per-level score-limit proof (arcade-score-limits skill, once per level), test-only. Each
// proof.level-N.test.ts runs one level so the five run in parallel.
import { describe, expect, it } from "vitest";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { EARLIEST_WIN_MS, PROPOSED_LEVEL_LIMITS, createRun, idleInput, objectiveCeiling, step, timeBonus } from "../rules";
import { play } from "./bot";

const HZ = [30, 60, 144] as const;
const SEEDS = 200;

export function proveLevel(id: LevelId): void {
   const limits = PROPOSED_LEVEL_LIMITS[id];
   const level = LEVELS[id];
   describe(`aquarium-cleaner L${id} limits: maxScore ${limits.maxScore}, base ${limits.base}, pps ${limits.maxPointsPerSec}`, () => {
      it("the proof's numbers: base = Bobj, a win at 0.85 x the earliest measured win fits maxScore and the rate line", () => {
         expect(limits.base).toBe(objectiveCeiling(level));
         expect(limits.maxDurationMs).toBe(level.durationMs);
         const t = Math.floor(EARLIEST_WIN_MS[id] * 0.85);
         // every win at t' >= t: Bobj + 4 floor((D - t') / 1000) <= base + pps t'
         for (let ms = t; ms <= level.durationMs; ms += 50) {
            const score = objectiveCeiling(level) + timeBonus(level.durationMs - ms);
            expect(withinServerLimits(score, ms, limits)).toBe(true);
         }
         expect(limits.maxScore).toBeLessThanOrEqual(Math.ceil((objectiveCeiling(level) + timeBonus(level.durationMs - t)) * 1.05));
      });
      it(`honest (human-paced) bot: wins >= 99 % of ${SEEDS} seeds at 30/60/144 Hz, every run inside the limits`, () => {
         let wins = 0;
         for (let seed = 1; seed <= SEEDS; seed++) {
            const r = play(id, seed, HZ[seed % 3], "human");
            expect(r.score).toBe(r.run.score);
            expect(withinServerLimits(r.score, r.ms, limits)).toBe(true);
            expect(capScore(r.score, r.ms, limits)).toBe(r.score);
            if (r.reason === "win") wins++;
         }
         expect(wins).toBeGreaterThanOrEqual(Math.ceil(SEEDS * 0.99));
      }, 900_000);
      it(`oracle bot: inside the limits on ${SEEDS} seeds, never faster than the measured earliest win, best >= 90 % of maxScore`, () => {
         let best = 0;
         for (let seed = 1; seed <= SEEDS; seed++) {
            const r = play(id, seed, HZ[(seed + 1) % 3], "oracle");
            expect(r.score).toBe(r.run.score);
            expect(withinServerLimits(r.score, r.ms, limits)).toBe(true);
            expect(capScore(r.score, r.ms, limits)).toBe(r.score);
            if (r.reason === "win") {
               expect(r.ms).toBeGreaterThanOrEqual(Math.floor(EARLIEST_WIN_MS[id] * 0.85));
               best = Math.max(best, r.score);
            }
         }
         expect(best).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
      }, 900_000);
      it("idle never wins and scores 0 (200 seeds through the rules, 10 through the store); spam stays inside the limits", () => {
         for (let seed = 1; seed <= SEEDS; seed++) {
            const run = createRun(seed, level);
            const input = idleInput();
            for (let t = 0; t < level.durationMs / 1000 && !run.over; t += 1 / 30) step(run, input, 1 / 30, level.durationMs - t * 1000);
            expect(run.over).not.toBe("win");
            expect(run.score).toBe(0);
         }
         for (let seed = 1; seed <= 10; seed++) {
            const idle = play(id, seed, 30, "idle");
            expect(idle.reason).not.toBe("win");
            expect(idle.score).toBe(0);
            expect(withinServerLimits(idle.score, idle.ms, limits)).toBe(true);
         }
         for (let seed = 1; seed <= 30; seed++) {
            const spam = play(id, seed, HZ[seed % 3], "spam");
            expect(spam.score).toBe(spam.run.score);
            expect(withinServerLimits(spam.score, spam.ms, limits)).toBe(true);
            expect(capScore(spam.score, spam.ms, limits)).toBe(spam.score);
         }
      }, 600_000);
   });
}
