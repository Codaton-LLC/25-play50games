import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createRng, inputToWorld, randomSeed, rngNext, turnTowards, type RngState } from "./math";
import { inputToWorld as inputToWorldFromView } from "./view";
import { inputToWorld as inputToWorldFromInput } from "./input";
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

describe("rngNext (scalar mulberry32)", () => {
   it("gives exactly createRng(seed)'s sequence for the same seed", () => {
      for (const seed of [0, 1, 7, 123456789, 2 ** 31, 2 ** 32 - 1, -1, -123, 1.5, -1.5, 2 ** 32 + 5, 2 ** 40 + 3]) {
         const rng = createRng(seed);
         const state: RngState = { s: seed };
         for (let i = 0; i < 500; i++) expect(rngNext(state)).toBe(rng());
      }
   });

   it("keeps its whole state in the object it is given (no closure), so it can be reset and copied", () => {
      const state: RngState = { s: 99 };
      const first = [rngNext(state), rngNext(state), rngNext(state)];
      expect(Number.isInteger(state.s)).toBe(true);
      expect(state.s).toBeGreaterThanOrEqual(0);
      expect(state.s).toBeLessThan(2 ** 32);
      // a copy continues the same stream; a reset replays it
      const copy: RngState = { ...state };
      expect(rngNext(copy)).toBe(rngNext(state));
      state.s = 99;
      expect([rngNext(state), rngNext(state), rngNext(state)]).toEqual(first);
      const values = Array.from({ length: 10000 }, () => rngNext(state));
      expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...values)).toBeLessThan(1);
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

describe("inputToWorld", () => {
   it("maps screen input to the world for both camera yaws", () => {
      const out = { x: 0, z: 0 };
      // landscape camera (yaw 0): up = -z, right = +x
      inputToWorld(0, -1, 0, out);
      expect(out.x).toBeCloseTo(0, 9);
      expect(out.z).toBeCloseTo(-1, 9);
      inputToWorld(1, 0, 0, out);
      expect(out.x).toBeCloseTo(1, 9);
      expect(out.z).toBeCloseTo(0, 9);
      // portrait camera (yaw 90°, looking along -x): up = -x, right = -z
      inputToWorld(0, -1, Math.PI / 2, out);
      expect(out.x).toBeCloseTo(-1, 9);
      expect(out.z).toBeCloseTo(0, 9);
      inputToWorld(1, 0, Math.PI / 2, out);
      expect(out.x).toBeCloseTo(0, 9);
      expect(out.z).toBeCloseTo(-1, 9);
   });

   it("up always points away from the camera, and the input's length is kept", () => {
      for (const yaw of [0.3, 1.2, 2.5, -2]) {
         const camera = { x: Math.sin(yaw), z: Math.cos(yaw) }; // camera direction from the focus
         const up = inputToWorld(0, -1, yaw);
         expect(up.x * camera.x + up.z * camera.z).toBeCloseTo(-1, 9);
         const d = inputToWorld(0.6, 0.3, yaw);
         expect(Math.hypot(d.x, d.z)).toBeCloseTo(Math.hypot(0.6, 0.3), 9);
      }
   });

   it("writes into `out` without allocating", () => {
      const out = { x: 5, z: 5 };
      expect(inputToWorld(1, 0, 0, out)).toBe(out);
      expect(out.x).toBe(1);
      expect(out.z).toBeCloseTo(0, 12);
   });

   it("is pure (no three.js, so rules.ts can use it) and re-exported by core/view and core/input", () => {
      const source = readFileSync(new URL("./math.ts", import.meta.url), "utf8");
      expect(source).not.toMatch(/from "(three|react|@react-three)/);
      expect(inputToWorldFromView).toBe(inputToWorld);
      expect(inputToWorldFromInput).toBe(inputToWorld);
   });
});
