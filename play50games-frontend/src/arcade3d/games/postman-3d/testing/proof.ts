// The per-level score-limit proof (arcade-score-limits skill, once per level), test-only. Each level has
// two files (proof.level-N: the arithmetic, the careful bot, idle, spam; oracle.level-N: the oracle) so
// the ten run in parallel.
import { describe, expect, it } from "vitest";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { PROOF_EARLIEST_WIN_S, PROPOSED_LEVEL_LIMITS, WIN_PER_SECOND, createRun, objectiveCeiling, step } from "../rules";
import { playBot, type FrameKind } from "./bots";

const FRAMES: readonly FrameKind[] = [30, 60, 144];
const SEEDS = 200;

export function proveLevel(id: LevelId): void {
   const rules = PROPOSED_LEVEL_LIMITS[id];
   const level = LEVELS[id];
   describe(`postman-3d L${id} limits: maxScore ${rules.maxScore}, base ${rules.base}, pps ${rules.maxPointsPerSec}`, () => {
      it("the proof's numbers: base = Bobj, the peak at the earliest win fits maxScore and the rate line", () => {
         const m = PROOF_EARLIEST_WIN_S[id];
         const d = level.durationMs / 1000;
         expect(rules.base).toBe(objectiveCeiling(level.letters + level.parcels));
         expect(rules.maxDurationMs).toBe(level.durationMs);
         expect(rules.minDurationMs).toBe(4000);
         const peak = rules.base + WIN_PER_SECOND * Math.floor(d - m);
         expect(rules.maxScore).toBeGreaterThanOrEqual(peak);
         expect(rules.maxScore).toBeLessThanOrEqual(Math.ceil(peak * 1.05));
         for (let t = m; t <= d; t += 0.01) expect(rules.base + WIN_PER_SECOND * Math.floor(d - t)).toBeLessThanOrEqual(rules.base + rules.maxPointsPerSec * t + 1e-9);
      });
      it(`careful bot: clears >= 99 % of ${SEEDS} seeds at 30/60/144 Hz, never faster than the proof's earliest win, inside the limits`, () => {
         let wins = 0;
         for (let seed = 1; seed <= SEEDS; seed++) {
            const r = playBot(id, seed, "greedy", FRAMES[seed % 3]);
            expect(withinServerLimits(r.score, r.elapsedMs, rules)).toBe(true);
            expect(capScore(r.score, r.elapsedMs, rules)).toBe(r.score);
            if (r.endReason === "win") {
               wins++;
               expect(r.elapsedMs / 1000).toBeGreaterThanOrEqual(PROOF_EARLIEST_WIN_S[id]);
            }
         }
         expect(wins).toBeGreaterThanOrEqual(Math.ceil(SEEDS * 0.99));
      }, 1_800_000);
      it("idle never clears and scores 0: 200 seeds through the rules, 5 through the store", () => {
         for (let seed = 1; seed <= SEEDS; seed++) {
            const run = createRun(seed, level);
            const inp = { moveX: 0, moveY: 0, yaw: 0, actionPressed: false };
            while (!run.over) step(run, inp, 1 / 20);
            expect(run.over).toBe("timeup");
            expect(run.score).toBe(0);
         }
         for (let seed = 1; seed <= 5; seed++) {
            const r = playBot(id, seed, "idle", 30);
            expect(r.endReason).toBe("timeup");
            expect(r.score).toBe(0);
            expect(withinServerLimits(r.score, r.elapsedMs, rules)).toBe(true);
         }
      }, 600_000);
      it("input spam and Deliver spam stay inside the limits and never clear (20 seeds, random frames)", () => {
         for (let seed = 1; seed <= 20; seed++) {
            for (const kind of ["spam", "deliverSpam"] as const) {
               const r = playBot(id, seed, kind, "random");
               expect(withinServerLimits(r.score, r.elapsedMs, rules)).toBe(true);
               expect(r.endReason).not.toBe("win");
            }
         }
      }, 900_000);
   });
}

export function proveOracle(id: LevelId): void {
   const rules = PROPOSED_LEVEL_LIMITS[id];
   describe(`postman-3d L${id} oracle`, () => {
      it(`oracle: inside the limits on ${SEEDS} seeds, never faster than the proof's earliest win, best >= 90 % of maxScore`, () => {
         let best = 0;
         for (let seed = 1; seed <= SEEDS; seed++) {
            const r = playBot(id, seed, "oracle", FRAMES[(seed + 1) % 3]);
            expect(withinServerLimits(r.score, r.elapsedMs, rules)).toBe(true);
            if (r.endReason === "win") expect(r.elapsedMs / 1000).toBeGreaterThanOrEqual(PROOF_EARLIEST_WIN_S[id]);
            best = Math.max(best, r.score);
         }
         expect(best).toBeGreaterThanOrEqual(0.9 * rules.maxScore);
      }, 1_800_000);
   });
}
