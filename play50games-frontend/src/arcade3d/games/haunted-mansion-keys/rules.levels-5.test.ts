// Level 5 proof (arcade-score-limits skill, time game): the bots through a fresh store at 30 / 60 / 144 Hz.
// The 200-seed oracle sweep that set minDurationMs is in the README; these are its fastest seeds, pinned.
import { describe, expect, it } from "vitest";
import { computeTimeScore, isRankedRun } from "@/arcade3d/core/scores";
import { PROPOSED_LEVEL_LIMITS } from "./rules";
import { playBot, playOracle } from "./testing/bots";

const ID = 5 as const;
const LIMITS = PROPOSED_LEVEL_LIMITS[ID];
const FASTEST = [118, 38, 54, 1, 44];

describe("haunted-mansion-keys level 5: score limits and clear rate", () => {
   it("the oracle (Use held, corners cut, with and without the lever) never wins under minDurationMs", () => {
      let best = Infinity;
      const seeds = [...FASTEST, ...Array.from({ length: 15 }, (_, i) => 300 + i)];
      for (const seed of seeds) {
         for (const hz of [30, 60, 144] as const) {
            const r = playOracle(ID, seed, hz);
            if (r.endReason !== "win") continue;
            best = Math.min(best, r.elapsedMs);
            expect(r.elapsedMs, `seed ${seed} @${hz}`).toBeGreaterThanOrEqual(LIMITS.minDurationMs);
            expect(r.score).toBe(computeTimeScore(LIMITS, r.elapsedMs));
            expect(r.score).toBe(r.run.score);
            expect(r.score).toBeLessThanOrEqual(LIMITS.maxScore);
         }
      }
      // the limit is tight: the best oracle win is within max(1 s, 15 %) + 100 ms of minDurationMs
      expect(best).toBeLessThanOrEqual(Math.max(LIMITS.minDurationMs + 1100, LIMITS.minDurationMs / 0.85 + 200));
      expect(LIMITS.maxScore).toBe(Math.floor((LIMITS.timeBaseMs! - LIMITS.minDurationMs) / 10));
   }, 120_000);

   it("an honest player (85 % speed, stops to hold Use, keeps away from the armour) finishes >= 99 % of 200 seeds", () => {
      let wins = 0;
      for (let seed = 1; seed <= 200; seed++) {
         const r = playBot(ID, seed, "honest", seed % 3 === 0 ? "random" : 60);
         if (r.endReason !== "win") continue;
         wins++;
         expect(r.elapsedMs).toBeGreaterThanOrEqual(LIMITS.minDurationMs);
         expect(r.elapsedMs).toBeLessThanOrEqual(LIMITS.maxDurationMs);
         expect(r.score).toBe(computeTimeScore(LIMITS, r.elapsedMs));
      }
      expect(wins).toBeGreaterThanOrEqual(198);
   }, 120_000);

   it("idle never finishes (timeup, unranked) and input spam never wins under the limit", () => {
      for (let seed = 1; seed <= 3; seed++) {
         const idle = playBot(ID, seed, "idle", 30);
         expect(idle.endReason).toBe("timeup");
         expect(isRankedRun(LIMITS, idle.endReason)).toBe(false);
         expect(idle.score).toBe(0);
      }
      for (let seed = 1; seed <= 12; seed++) {
         const spam = playBot(ID, seed, "spam", 30);
         if (spam.endReason === "win") expect(spam.elapsedMs).toBeGreaterThanOrEqual(LIMITS.minDurationMs);
         else expect(isRankedRun(LIMITS, spam.endReason)).toBe(false);
      }
   }, 120_000);
});
