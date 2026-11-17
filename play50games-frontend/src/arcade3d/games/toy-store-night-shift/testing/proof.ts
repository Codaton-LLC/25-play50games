// The per-level score-limit proof (arcade-score-limits skill, once per level), test-only. Each
// proof.level-N.test.ts runs one level so the five run in parallel.
import { describe, expect, it } from "vitest";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { PROOF_EARLIEST_WIN_S, PROPOSED_LEVEL_LIMITS, TIME_BONUS_PER_SECOND, createRun, idleInput, objectiveCeiling, step } from "../rules";
import { play } from "./bot";

const HZ = [30, 60, 144] as const;
const SEEDS = 200;

export function proveLevel(id: LevelId): void {
   const rules = PROPOSED_LEVEL_LIMITS[id];
   const level = LEVELS[id];
   describe(`toy store L${id} limits: maxScore ${rules.maxScore}, base ${rules.base}, pps ${rules.maxPointsPerSec}`, () => {
      it("the proof's numbers: base = Bobj, the peak at the earliest win fits maxScore (+<= 5 %) and the rate line", () => {
         const t0 = PROOF_EARLIEST_WIN_S[id];
         const d = level.durationMs / 1000;
         expect(rules.base).toBe(objectiveCeiling(level));
         expect(rules.maxDurationMs).toBe(level.durationMs);
         expect(rules.minDurationMs).toBe(4000);
         const peak = rules.base + TIME_BONUS_PER_SECOND * Math.floor(d - t0);
         expect(rules.maxScore).toBeGreaterThanOrEqual(peak);
         expect(rules.maxScore).toBeLessThanOrEqual(Math.ceil(peak * 1.05));
         for (let t = t0; t <= d; t += 0.01) expect(rules.base + TIME_BONUS_PER_SECOND * Math.floor(d - t)).toBeLessThanOrEqual(rules.base + rules.maxPointsPerSec * t + 1e-9);
      });
      it(`oracle: ${SEEDS} seeds at 30/60/144 Hz inside the limits, never faster than the proof's earliest win, best >= 90 % of maxScore`, () => {
         let best = 0;
         let wins = 0;
         for (let seed = 0; seed < SEEDS; seed++) {
            const r = play(id, seed, HZ[seed % 3], "oracle");
            expect(withinServerLimits(r.score, r.ms, rules)).toBe(true);
            expect(capScore(r.score, r.ms, rules)).toBe(r.score);
            if (r.reason === "win") {
               wins++;
               expect(r.ms / 1000).toBeGreaterThanOrEqual(PROOF_EARLIEST_WIN_S[id]);
               best = Math.max(best, r.score);
            }
         }
         expect(wins).toBeGreaterThanOrEqual(Math.ceil(SEEDS * 0.99));
         expect(best).toBeGreaterThanOrEqual(0.9 * rules.maxScore);
      }, 600_000);
      it(`honest (human-paced) bot: clears >= 99 % of ${SEEDS} seeds at 30/60/144 Hz, inside the limits`, () => {
         let wins = 0;
         for (let seed = 0; seed < SEEDS; seed++) {
            const r = play(id, seed + 1000, HZ[(seed + 1) % 3], "human");
            expect(withinServerLimits(r.score, r.ms, rules)).toBe(true);
            expect(capScore(r.score, r.ms, rules)).toBe(r.score);
            if (r.reason === "win") {
               wins++;
               expect(r.ms / 1000).toBeGreaterThanOrEqual(PROOF_EARLIEST_WIN_S[id]);
            }
         }
         expect(wins).toBeGreaterThanOrEqual(Math.ceil(SEEDS * 0.99));
      }, 600_000);
      it("idle never clears and scores 0: 200 seeds through the rules, 10 through the store", () => {
         for (let seed = 0; seed < SEEDS; seed++) {
            const run = createRun(seed, level);
            const input = idleInput();
            for (let t = 0; t < level.durationMs / 1000; t += 1 / 30) step(run, input, 1 / 30, level.durationMs - t * 1000);
            expect(run.over).toBeNull();
            expect(run.score).toBe(0);
         }
         for (let seed = 0; seed < 10; seed++) {
            const r = play(id, seed, 30, "idle");
            expect(r.reason).toBe("timeup");
            expect(r.score).toBe(0);
            expect(withinServerLimits(r.score, r.ms, rules)).toBe(true);
         }
      }, 120_000);
      it("input spam stays inside the limits (40 seeds, 30/60/144 Hz)", () => {
         for (let seed = 0; seed < 40; seed++) {
            const r = play(id, seed, HZ[seed % 3], "spam");
            expect(r.score).toBe(r.run.score);
            expect(withinServerLimits(r.score, r.ms, rules)).toBe(true);
            expect(capScore(r.score, r.ms, rules)).toBe(r.score);
         }
      }, 300_000);
   });
}
