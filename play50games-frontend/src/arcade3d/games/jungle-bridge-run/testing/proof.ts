// The per-level score-limit proof (arcade-score-limits skill, once per level), test-only. Each
// proof.level-N.test.ts runs one level so the five run in parallel.
import { describe, expect, it } from "vitest";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { PROPOSED_LEVEL_LIMITS, TIME_BONUS_PER_SECOND, earliestEndS, earliestWinS, objectiveCeiling } from "../rules";
import { playBot, type FrameKind } from "./bots";

const FRAMES: readonly FrameKind[] = [30, 60, 144];
const SEEDS = 200;

export function proveLevel(id: LevelId): void {
   const rules = PROPOSED_LEVEL_LIMITS[id];
   const level = LEVELS[id];
   const m = earliestWinS(level);
   describe(`jungle-bridge-run L${id} limits: maxScore ${rules.maxScore}, base ${rules.base}, pps ${rules.maxPointsPerSec}`, () => {
      it("the proof's numbers: base = Bobj, the peak at the earliest win, the rate line, the duration window", () => {
         const d = level.durationMs / 1000;
         expect(rules.base).toBe(objectiveCeiling(level));
         expect(rules.maxDurationMs).toBe(level.durationMs);
         const peak = rules.base + TIME_BONUS_PER_SECOND * Math.floor(d - m);
         expect(rules.maxScore).toBeGreaterThanOrEqual(peak);
         expect(rules.maxScore).toBeLessThanOrEqual(Math.ceil(peak * 1.05));
         for (let t = m; t <= d; t += 0.01) expect(rules.base + TIME_BONUS_PER_SECOND * Math.floor(d - t)).toBeLessThanOrEqual(rules.base + rules.maxPointsPerSec * t + 1e-9);
         // no run ends sooner than three hits at the earliest points the layout allows
         expect(rules.minDurationMs).toBeLessThanOrEqual(earliestEndS(level) * 1000 * 0.95);
         expect(rules.minDurationMs).toBeGreaterThanOrEqual(earliestEndS(level) * 1000 * 0.85);
      });
      it(`honest bot (±60 ms timing): clears >= 99 % of ${SEEDS} seeds at 30/60/144 Hz, every run inside the limits`, () => {
         let wins = 0;
         for (let seed = 1; seed <= SEEDS; seed++) {
            const r = playBot(id, seed, "honest", FRAMES[seed % 3]);
            expect(withinServerLimits(r.score, r.elapsedMs, rules)).toBe(true);
            expect(capScore(r.score, r.elapsedMs, rules)).toBe(r.score);
            if (r.endReason === "win") {
               wins++;
               expect(r.elapsedMs / 1000).toBeGreaterThanOrEqual(m - 1e-9);
            }
         }
         expect(wins).toBeGreaterThanOrEqual(Math.ceil(SEEDS * 0.99));
      }, 180_000);
      it(`oracle bot (perfect timing, detours for every gem): inside the limits on ${SEEDS} seeds, best >= 90 % of maxScore, never before M`, () => {
         let best = 0;
         for (let seed = 1; seed <= SEEDS; seed++) {
            const r = playBot(id, seed, "oracle", FRAMES[(seed + 1) % 3]);
            expect(withinServerLimits(r.score, r.elapsedMs, rules)).toBe(true);
            if (r.endReason === "win") expect(r.elapsedMs / 1000).toBeGreaterThanOrEqual(m - 1e-9);
            best = Math.max(best, r.score);
         }
         expect(best).toBeGreaterThanOrEqual(0.9 * rules.maxScore);
      }, 180_000);
      it(`idle never clears and stays inside the limits (${SEEDS} seeds); input spam inside the limits (60 seeds, random frames)`, () => {
         for (let seed = 1; seed <= SEEDS; seed++) {
            const r = playBot(id, seed, "idle", FRAMES[seed % 3]);
            expect(r.endReason).not.toBe("win");
            expect(withinServerLimits(r.score, r.elapsedMs, rules)).toBe(true);
         }
         for (let seed = 1; seed <= 60; seed++) {
            const r = playBot(id, seed, "spam", "random");
            expect(withinServerLimits(r.score, r.elapsedMs, rules)).toBe(true);
         }
      }, 180_000);
   });
}
