import { describe, expect, it } from "vitest";
import { createScoreSlots, emitScore, scoreLook, stepScores, SCORE_LIFE, SCORE_RISE } from "./floatingScores";
import { clearTrail, createTrailHistory, followTrail } from "./trailHistory";

describe("floating score slots", () => {
   it("uses a free slot, and the oldest when all are busy", () => {
      const pool = createScoreSlots(2);
      expect(emitScore(pool, 0, 0, 0, "+1", "#fff", 0.06)).toBe(0);
      expect(emitScore(pool, 0, 0, 0, "+2", "#fff", 0.06)).toBe(1);
      expect(emitScore(pool, 0, 0, 0, "+3", "#fff", 0.06)).toBe(0);
      expect(pool.slots[0].text).toBe("+3");
      expect(pool.slots.length).toBe(2);
   });

   it("marks a slot dirty only when its text or colour changes", () => {
      const pool = createScoreSlots(1);
      emitScore(pool, 0, 0, 0, "+10", "#fff", 0.06);
      expect(pool.slots[0].dirty).toBe(true);
      pool.slots[0].dirty = false;
      stepScores(pool, SCORE_LIFE);
      emitScore(pool, 1, 1, 1, "+10", "#fff", 0.06);
      expect(pool.slots[0].dirty).toBe(false);
      emitScore(pool, 1, 1, 1, "+20", "#fff", 0.06);
      expect(pool.slots[0].dirty).toBe(true);
   });

   it("ages, frees at the end of its life and freezes at dt 0", () => {
      const pool = createScoreSlots(1);
      emitScore(pool, 0, 0, 0, "+5", "#fff", 0.06);
      stepScores(pool, 0);
      expect(pool.slots[0].age).toBe(0);
      stepScores(pool, SCORE_LIFE / 2);
      expect(pool.slots[0].active).toBe(true);
      stepScores(pool, SCORE_LIFE);
      expect(pool.slots[0].active).toBe(false);
   });

   it("rises and fades over its life", () => {
      const look = { rise: 0, opacity: 0, pop: 0 };
      scoreLook(0, look);
      expect(look.rise).toBe(0);
      expect(look.opacity).toBe(1);
      scoreLook(SCORE_LIFE, look);
      expect(look.rise).toBeCloseTo(SCORE_RISE, 6);
      expect(look.opacity).toBe(0);
      expect(look.pop).toBe(1);
   });
});

describe("trail history", () => {
   it("keeps an anchor until the target moves, then adds points newest first", () => {
      const h = createTrailHistory(4);
      followTrail(h, 0, 0, 0, 0.5, 10, 0.016);
      followTrail(h, 0.1, 0, 0, 0.5, 10, 0.016);
      expect(h.count).toBe(1);
      expect(h.points[0]).toBe(0);
      followTrail(h, 0.6, 0, 0, 0.5, 10, 0.016);
      expect(h.count).toBe(2);
      expect(h.points[0]).toBeCloseTo(0.6, 6);
      expect(h.points[3]).toBe(0);
   });

   it("never exceeds its capacity", () => {
      const h = createTrailHistory(3);
      for (let i = 0; i < 10; i++) followTrail(h, i, 0, 0, 0.5, 10, 0.016);
      expect(h.count).toBe(3);
      expect(h.points[0]).toBe(9);
   });

   it("shrinks while the target stands still, down to the head", () => {
      const h = createTrailHistory(8);
      for (let i = 0; i < 8; i++) followTrail(h, i, 0, 0, 0.5, 10, 0.016);
      const before = h.count;
      for (let i = 0; i < 100; i++) followTrail(h, 7, 0, 0, 0.5, 20, 0.05);
      expect(h.count).toBeLessThan(before);
      expect(h.count).toBe(1);
      clearTrail(h);
      expect(h.count).toBe(0);
   });
});
