// The per-level score-limit proof (arcade-score-limits skill, once per level), test-only. Each
// proof.level-N.test.ts runs one level so the five run in parallel.
import { describe, expect, it } from "vitest";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { PROOF_EARLIEST_WIN_S, PROPOSED_LEVEL_LIMITS, TIME_BONUS_PER_SECOND, createRun, idleInput, objectiveCeiling, step } from "../rules";
import { playBot, type FrameKind } from "./bots";

const FRAMES: readonly FrameKind[] = [30, 60, 144];
const SEEDS = 200;

export function proveLevel(id: LevelId): void {
   const rules = PROPOSED_LEVEL_LIMITS[id];
   const level = LEVELS[id];
   describe(`dog-park-fetch L${id} limits: maxScore ${rules.maxScore}, base ${rules.base}, pps ${rules.maxPointsPerSec}`, () => {
      it("the proof's numbers: base = Bobj, the peak at the earliest win fits maxScore and the rate line", () => {
         const m = PROOF_EARLIEST_WIN_S[id];
         const d = level.durationMs / 1000;
         expect(rules.base).toBe(objectiveCeiling(level));
         expect(rules.maxDurationMs).toBe(level.durationMs);
         const peak = rules.base + TIME_BONUS_PER_SECOND * Math.floor(d - m);
         expect(rules.maxScore).toBeGreaterThanOrEqual(peak);
         expect(rules.maxScore).toBeLessThanOrEqual(Math.ceil(peak * 1.05));
         for (let t = m; t <= d; t += 0.01) expect(rules.base + TIME_BONUS_PER_SECOND * Math.floor(d - t)).toBeLessThanOrEqual(rules.base + rules.maxPointsPerSec * t + 1e-9);
      });
      it(`honest bot: clears >= 99 % of ${SEEDS} seeds at 30/60/144 Hz, every run inside the limits`, () => {
         let wins = 0;
         let fastest = Infinity;
         for (let seed = 1; seed <= SEEDS; seed++) {
            const r = playBot(id, seed, "honest", FRAMES[seed % 3]);
            expect(withinServerLimits(r.score, r.elapsedMs, rules), `seed ${seed} ${r.score} ${r.elapsedMs}`).toBe(true);
            expect(capScore(r.score, r.elapsedMs, rules)).toBe(r.score);
            expect(r.score).toBe(r.run.score);
            if (r.endReason === "win") {
               wins++;
               fastest = Math.min(fastest, r.elapsedMs / 1000);
            }
         }
         expect(wins).toBeGreaterThanOrEqual(Math.ceil(SEEDS * 0.99));
         expect(fastest).toBeGreaterThanOrEqual(PROOF_EARLIEST_WIN_S[id]);
      }, 600_000);
      it(`oracle bot: inside the limits on ${SEEDS} seeds, never faster than the proof's earliest win, best >= 90 % of maxScore`, () => {
         let best = 0;
         for (let seed = 1; seed <= SEEDS; seed++) {
            const r = playBot(id, seed, "oracle", FRAMES[(seed + 1) % 3]);
            expect(withinServerLimits(r.score, r.elapsedMs, rules), `seed ${seed} ${r.score} ${r.elapsedMs}`).toBe(true);
            if (r.endReason === "win") expect(r.elapsedMs / 1000).toBeGreaterThanOrEqual(PROOF_EARLIEST_WIN_S[id]);
            best = Math.max(best, r.score);
         }
         expect(best).toBeGreaterThanOrEqual(0.9 * rules.maxScore);
      }, 600_000);
      it("idle never clears and scores 0: 200 seeds through the rules, 10 through the store", () => {
         for (let seed = 1; seed <= SEEDS; seed++) {
            const run = createRun(seed, level);
            const idle = idleInput();
            for (let t = 0; t < level.durationMs / 1000 && !run.over; t += 1 / 30) step(run, idle, 1 / 30, level.durationMs - t * 1000);
            expect(run.over).not.toBe("win");
            expect(run.score).toBe(0);
         }
         for (let seed = 1; seed <= 10; seed++) {
            const r = playBot(id, seed, "idle", 30);
            expect(r.endReason).not.toBe("win");
            expect(r.score).toBe(0);
            expect(withinServerLimits(r.score, r.elapsedMs, rules)).toBe(true);
         }
      }, 120_000);
      it("input spam stays inside the limits (40 seeds, random frames)", () => {
         for (let seed = 1; seed <= 40; seed++) {
            const r = playBot(id, seed, "spam", "random");
            expect(withinServerLimits(r.score, r.elapsedMs, rules)).toBe(true);
         }
      }, 300_000);
   });
}
