// The per-level score-limit proof (arcade-score-limits skill, once per level). Test-only: each
// rules.levels-<n>.test.ts calls levelProof(n) and clears.levels-<n>.test.ts clearProof(n), so vitest
// runs the ten files in parallel.
import { describe, expect, it } from "vitest";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS } from "../levels";
import { pizzaKitchen3dMeta } from "../meta";
import { EARLIEST_WIN_S, PROPOSED_LEVEL_LIMITS, TUNING, objectiveCeiling } from "../rules";
import { playBot, type Frames } from "./bots";

const FRAMES: readonly Frames[] = [30, 60, 144];
const SEEDS = 200;

export function levelProof(id: LevelId): void {
   const limits = PROPOSED_LEVEL_LIMITS[id];
   const level = LEVELS[id];
   describe(`pizza-kitchen-3d L${id} score limits`, () => {
      it("matches meta.levels and the derived bound", () => {
         expect(pizzaKitchen3dMeta.levels![id - 1].scoring).toEqual(limits);
         expect(limits.base).toBe(objectiveCeiling(level));
         expect(limits.maxDurationMs).toBe(level.durationMs);
         const M = EARLIEST_WIN_S[id];
         const D = level.durationMs / 1000;
         // M never below the hard floor: every oven bakes one pizza at a time for bakeS
         expect(M).toBeGreaterThanOrEqual(Math.ceil(level.orders / level.ovens) * level.bakeS);
         // a win at any t >= M fits base + pps t, and the peak fits maxScore
         for (let t = M; t <= D; t += 0.25) expect(limits.base + TUNING.winPerSecond * Math.floor(D - t)).toBeLessThanOrEqual(limits.base + limits.maxPointsPerSec * t);
         expect(limits.base + TUNING.winPerSecond * (D - M)).toBeLessThanOrEqual(limits.maxScore);
      });

      it(`oracles (both take-out timings) on ${SEEDS} seeds at 30/60/144 Hz: inside every limit, the best >= 90 % of maxScore, never faster than 1.25 M`, () => {
         let best = 0;
         let fastest = Infinity;
         for (let seed = 1; seed <= SEEDS; seed++) {
            for (const kind of ["oracle", "oracleTight"] as const) {
               if ((seed + (kind === "oracle" ? 0 : 1)) % 2) continue; // each seed once, the two oracles alternate
               const r = playBot(id, seed, kind, FRAMES[seed % 3]);
               expect(r.endReason).toBe("win");
               expect(withinServerLimits(r.score, r.elapsedMs, limits)).toBe(true);
               expect(capScore(r.score, r.elapsedMs, limits)).toBe(r.score);
               best = Math.max(best, r.score);
               fastest = Math.min(fastest, r.elapsedMs / 1000);
            }
         }
         expect(best).toBeGreaterThanOrEqual(0.9 * limits.maxScore);
         expect(fastest).toBeGreaterThanOrEqual(EARLIEST_WIN_S[id] * 1.24);
      });
   });
}

export function clearProof(id: LevelId): void {
   const limits = PROPOSED_LEVEL_LIMITS[id];
   const level = LEVELS[id];
   describe(`pizza-kitchen-3d L${id} clears`, () => {
      it(`an honest cook clears on >= 99 % of ${SEEDS} seeds, inside every limit${level.ovens > 1 ? ", using both ovens" : ""}`, () => {
         let wins = 0;
         let both = 0;
         for (let seed = 1; seed <= SEEDS; seed++) {
            const r = playBot(id, seed, "honest", seed % 2 ? 30 : 60);
            if (r.endReason === "win") wins++;
            if (r.bothOvens) both++;
            expect(withinServerLimits(r.score, r.elapsedMs, limits)).toBe(true);
            expect(r.score).toBeGreaterThanOrEqual(r.endReason === "win" ? PROPOSED_LEVEL_LIMITS[1].base : 0);
         }
         expect(wins / SEEDS).toBeGreaterThanOrEqual(0.99);
         if (level.ovens > 1) expect(both).toBe(SEEDS);
      });

      it("idle never clears or scores; spam stays inside the limits", () => {
         for (let seed = 1; seed <= 12; seed++) {
            const idle = playBot(id, seed, "idle", FRAMES[seed % 3]);
            expect(idle.endReason).not.toBe("win");
            expect(idle.score).toBe(0);
            expect(withinServerLimits(idle.score, idle.elapsedMs, limits)).toBe(true);
            const spam = playBot(id, seed, "spam", seed % 2 ? 60 : "random");
            expect(spam.endReason).not.toBe("win");
            expect(withinServerLimits(spam.score, spam.elapsedMs, limits)).toBe(true);
         }
      });
   });
}
