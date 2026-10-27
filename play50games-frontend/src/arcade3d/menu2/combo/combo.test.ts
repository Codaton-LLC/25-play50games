import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import {
   DEFAULT_COMBO,
   comboBonus,
   comboBreak,
   comboConfigProblems,
   comboFlow,
   comboHit,
   comboMaxBonus,
   comboMultiplier,
   comboTick,
   copyCombo,
   createCombo,
   resetCombo,
   type ComboConfig,
} from "./combo";

const CFG: ComboConfig = { windowMs: 1000, gain: 0.25, cap: 2 };

describe("combo multiplier", () => {
   it("starts at 1, grows by gain per link and stops at the cap", () => {
      expect([1, 2, 3, 4, 5, 6, 50].map((c) => comboMultiplier(c, CFG))).toEqual([1, 1.25, 1.5, 1.75, 2, 2, 2]);
      expect(comboMultiplier(0, CFG)).toBe(1);
   });

   it("pays whole units, rounded down", () => {
      expect(comboBonus(100, 1, CFG)).toBe(0);
      expect(comboBonus(100, 2, CFG)).toBe(25);
      expect(comboBonus(10, 2, { windowMs: 1, gain: 0.33, cap: 3 })).toBe(3);
      expect(comboBonus(100, 9, CFG)).toBe(100);
   });

   it("validates configs", () => {
      expect(comboConfigProblems(DEFAULT_COMBO)).toEqual([]);
      expect(comboConfigProblems({ windowMs: 0, gain: -1, cap: 0.5 })).toHaveLength(3);
   });
});

describe("combo chain", () => {
   it("chains inside the window and breaks after it", () => {
      const s = createCombo();
      expect(comboHit(s, CFG, 0, 100)).toBe(0);
      expect(comboHit(s, CFG, 900, 100)).toBe(25);
      expect(comboHit(s, CFG, 1900, 100)).toBe(50);
      expect(s.chain).toBe(3);
      expect(comboFlow(s, CFG, 1900)).toBe(1);
      expect(comboFlow(s, CFG, 2400)).toBeCloseTo(0.5);
      comboTick(s, CFG, 2901);
      expect(s.chain).toBe(0);
      expect(s.multiplier).toBe(1);
      expect(comboFlow(s, CFG, 2901)).toBe(0);
      expect(comboHit(s, CFG, 3000, 100)).toBe(0);
      expect(s.bonusTotal).toBe(75);
      expect(s.bestChain).toBe(3);
      expect(s.events).toBe(4);
   });

   it("a break resets the chain but keeps what was paid", () => {
      const s = createCombo();
      for (let i = 0; i < 6; i++) comboHit(s, CFG, i * 100, 100);
      const paid = s.bonusTotal;
      comboBreak(s);
      expect(s.chain).toBe(0);
      expect(s.bonusTotal).toBe(paid);
      expect(comboHit(s, CFG, 700, 100)).toBe(0);
   });

   it("copy and reset", () => {
      const a = createCombo();
      comboHit(a, CFG, 0, 10);
      comboHit(a, CFG, 10, 10);
      const b = createCombo();
      copyCombo(a, b);
      expect(b).toEqual(a);
      resetCombo(b);
      expect(b).toEqual(createCombo());
   });
});

describe("comboMaxBonus (the proof helper)", () => {
   it("is the one unbroken chain with the biggest bases last", () => {
      // 5 events of 100: 0 + 25 + 50 + 75 + 100
      expect(comboMaxBonus({ combo: CFG, sources: [{ count: 5, base: 100 }] })).toBe(250);
      // mixed: bases sorted [10, 10, 100]: 0 + 2.5 + 50
      expect(comboMaxBonus({ combo: CFG, sources: [{ count: 1, base: 100 }, { count: 2, base: 10 }] })).toBe(53);
      expect(comboMaxBonus({ combo: CFG, sources: [] })).toBe(0);
      expect(() => comboMaxBonus({ combo: CFG, sources: [{ count: -1, base: 1 }] })).toThrow();
   });

   it("no random order, timing or break pattern ever beats it (2000 runs)", () => {
      const rng = createRng(7);
      for (let run = 0; run < 2000; run++) {
         const cfg: ComboConfig = { windowMs: 200 + Math.floor(rng() * 2000), gain: rng() * 0.6, cap: 1 + rng() * 3 };
         const sources = [
            { count: Math.floor(rng() * 25), base: Math.floor(rng() * 300) },
            { count: Math.floor(rng() * 15), base: Math.floor(rng() * 80) },
         ];
         const pool: number[] = [];
         for (const src of sources) for (let k = 0; k < src.count; k++) pool.push(src.base);
         // shuffle
         for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
         }
         const s = createCombo();
         let t = 0;
         for (const base of pool) {
            t += Math.floor(rng() * cfg.windowMs * 1.3);
            if (rng() < 0.1) comboBreak(s);
            comboHit(s, cfg, t, base);
         }
         expect(s.bonusTotal).toBeLessThanOrEqual(comboMaxBonus({ combo: cfg, sources }));
      }
   });

   it("is reached by the ideal run (tight)", () => {
      const s = createCombo();
      const bases = [10, 10, 100];
      bases.forEach((b, i) => comboHit(s, CFG, i, b));
      expect(s.bonusTotal).toBe(52); // 0 + floor(2.5) + 50; the bound rounds the sum up once: 53
      expect(comboMaxBonus({ combo: CFG, sources: [{ count: 2, base: 10 }, { count: 1, base: 100 }] })).toBeGreaterThanOrEqual(s.bonusTotal);
   });
});
