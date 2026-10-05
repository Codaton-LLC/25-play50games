import { describe, expect, it } from "vitest";
import { createRng, randomSeed, turnTowards } from "./math";
import { capScore, submittedMs, withinServerLimits } from "./limits";
import type { ScoringRules } from "../types";

describe("createRng", () => {
   it("is deterministic per seed, differs between seeds, stays in [0, 1)", () => {
      const a = createRng(7);
      const b = createRng(7);
      const c = createRng(8);
      const first = Array.from({ length: 50 }, () => a());
      expect(Array.from({ length: 50 }, () => b())).toEqual(first);
      expect(Array.from({ length: 50 }, () => c())).not.toEqual(first);
      const rng = createRng(2 ** 32 - 1);
      const values = Array.from({ length: 10000 }, () => rng());
      expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...values)).toBeLessThan(1);
   });

   it("randomSeed draws 32-bit integer seeds", () => {
      for (let i = 0; i < 100; i++) {
         const seed = randomSeed();
         expect(Number.isInteger(seed)).toBe(true);
         expect(seed).toBeGreaterThanOrEqual(0);
         expect(seed).toBeLessThan(2 ** 32);
      }
   });
});

describe("turnTowards", () => {
   it("turns the short way round", () => {
      expect(turnTowards(3, -3, 1)).toBeCloseTo(-3 + 2 * Math.PI, 9);
      expect(turnTowards(0.1, -0.1, 0.5)).toBeCloseTo(0, 9);
      expect(turnTowards(-3, 3, 1)).toBeCloseTo(3 - 2 * Math.PI, 9);
      expect(turnTowards(1, 1 + 4 * Math.PI, 1)).toBeCloseTo(1, 9);
   });
});

describe("server limits (points games)", () => {
   const rules: ScoringRules = {
      kind: "points",
      maxScore: 1600,
      minDurationMs: 5000,
      maxDurationMs: 75000,
      base: 600,
      maxPointsPerSec: 120,
      unitLabel: "pts",
      display: "int",
   };

   it("mirrors the server's integer check", () => {
      expect(withinServerLimits(1520, 7_700, rules)).toBe(true);
      expect(withinServerLimits(1520, 7_600, rules)).toBe(false);
      expect(withinServerLimits(1601, 70_000, rules)).toBe(false);
      expect(withinServerLimits(100, 4_999, rules)).toBe(false);
      expect(withinServerLimits(100, 75_001, rules)).toBe(false);
      expect(withinServerLimits(100.5, 10_000, rules)).toBe(false);
      expect(withinServerLimits(-1, 10_000, rules)).toBe(false);
   });

   it("rounds the duration like GameShell before submitting", () => {
      expect(submittedMs(7_608.49)).toBe(7_608);
      expect(submittedMs(-3)).toBe(0);
      expect(withinServerLimits(100, 4_999.5, rules)).toBe(true);
      // 7608.49 ms is sent as 7608, where 1513 is 40 thousandths of a point too many
      expect(withinServerLimits(1512, 7_608.49, rules)).toBe(true);
      expect(withinServerLimits(1513, 7_608.49, rules)).toBe(false);
   });

   it("capScore trims to the cap and never below 0", () => {
      expect(capScore(1520, 7_600, rules)).toBe(1512);
      expect(capScore(5000, 70_000, rules)).toBe(1600);
      expect(capScore(1600, 7_608.49, rules)).toBe(1512);
      expect(capScore(-5, 10_000, rules)).toBe(0);
      expect(capScore(900, 60_000, rules)).toBe(900);
      for (const [score, ms] of [[1520, 7_600], [5000, 70_000], [1600, 7_608.49]]) {
         expect(withinServerLimits(capScore(score, ms, rules), ms, rules)).toBe(true);
      }
   });
});
