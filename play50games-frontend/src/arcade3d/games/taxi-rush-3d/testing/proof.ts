// The per-level score-limit proof (arcade-score-limits skill, once per level), test-only. Each
// proof.level-N.test.ts runs one level so the five run in parallel.
import { describe, expect, it } from "vitest";
import { withinServerLimits } from "@/arcade3d/core/limits";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { PROOF_EARLIEST_WIN_S, PROPOSED_LEVEL_LIMITS, TIME_POINTS, objectiveCeiling } from "../rules";
import { play } from "./bots";

const HZ = [30, 60, 144] as const;
const SEEDS = 200;

export function proveLevel(id: LevelId): void {
   const rules = PROPOSED_LEVEL_LIMITS[id];
   const level = LEVELS[id];
   describe(`taxi L${id} limits: maxScore ${rules.maxScore}, base ${rules.base}, pps ${rules.maxPointsPerSec}`, () => {
      it("the proof's numbers: base = Bobj, the peak at the earliest win fits maxScore and the rate line", () => {
         const m = PROOF_EARLIEST_WIN_S[id];
         const d = level.durationMs / 1000;
         expect(rules.base).toBe(objectiveCeiling(level.rides));
         expect(rules.maxDurationMs).toBe(level.durationMs);
         expect(rules.minDurationMs).toBe(4000);
         const peak = rules.base + TIME_POINTS * Math.floor(d - m);
         expect(rules.maxScore).toBeGreaterThanOrEqual(peak);
         expect(rules.maxScore).toBeLessThanOrEqual(Math.ceil(peak * 1.05));
         for (let t = m; t <= d; t += 0.01) expect(rules.base + TIME_POINTS * Math.floor(d - t)).toBeLessThanOrEqual(rules.base + rules.maxPointsPerSec * t + 1e-9);
      });
      it(`honest bot: clears >= 99 % of ${SEEDS} seeds at 30/60/144 Hz, every run inside the limits`, () => {
         let wins = 0;
         let fastest = Infinity;
         for (let seed = 1; seed <= SEEDS; seed++) {
            const r = play(id, seed, HZ[seed % 3], "human");
            expect(withinServerLimits(r.score, r.ms, rules)).toBe(true);
            expect(r.score).toBe(r.rawScore);
            if (r.reason === "win") {
               wins++;
               fastest = Math.min(fastest, r.ms / 1000);
            }
         }
         expect(wins).toBeGreaterThanOrEqual(Math.ceil(SEEDS * 0.99));
         expect(fastest).toBeGreaterThanOrEqual(PROOF_EARLIEST_WIN_S[id]);
      }, 900_000);
      it(`oracle bot: inside the limits on ${SEEDS} seeds, never faster than the proof's earliest win, best >= 90 % of maxScore`, () => {
         let best = 0;
         for (let seed = 1; seed <= SEEDS; seed++) {
            const r = play(id, seed, HZ[seed % 3], "oracle");
            expect(withinServerLimits(r.score, r.ms, rules)).toBe(true);
            if (r.reason === "win") expect(r.ms / 1000).toBeGreaterThanOrEqual(PROOF_EARLIEST_WIN_S[id]);
            best = Math.max(best, r.score);
         }
         expect(best).toBeGreaterThanOrEqual(0.9 * rules.maxScore);
      }, 900_000);
      it("idle never clears and scores 0; stick spam stays inside the limits (30 seeds, random frames)", () => {
         for (let seed = 1; seed <= 30; seed++) {
            const idle = play(id, seed, 30, "idle");
            expect(idle.reason).not.toBe("win");
            expect(idle.score).toBe(0);
            expect(withinServerLimits(idle.score, idle.ms, rules)).toBe(true);
            const spam = play(id, seed, 0, "spam");
            expect(withinServerLimits(spam.score, spam.ms, rules)).toBe(true);
         }
      }, 300_000);
   });
}
