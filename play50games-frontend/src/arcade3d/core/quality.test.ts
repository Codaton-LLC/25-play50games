import { describe, expect, it } from "vitest";
import { QUALITY, qualityFor, scaledCount, tierFor } from "./quality";

describe("tierFor", () => {
   it("is high on a desktop without slow periods", () => {
      expect(tierFor({ declines: 0, coarsePointer: false })).toBe("high");
   });
   it("is mid on a coarse pointer or after one decline", () => {
      expect(tierFor({ declines: 0, coarsePointer: true })).toBe("mid");
      expect(tierFor({ declines: 1, coarsePointer: false })).toBe("mid");
      expect(tierFor({ declines: 1, coarsePointer: true })).toBe("mid");
   });
   it("is low after two or more declines, whatever the pointer", () => {
      expect(tierFor({ declines: 2, coarsePointer: false })).toBe("low");
      expect(tierFor({ declines: 5, coarsePointer: true })).toBe("low");
   });
});

describe("QUALITY table (06 §10.4)", () => {
   it("matches the plan's factors", () => {
      expect([QUALITY.low.particles, QUALITY.mid.particles, QUALITY.high.particles]).toEqual([0.4, 0.7, 1]);
      expect([QUALITY.low.decor, QUALITY.mid.decor, QUALITY.high.decor]).toEqual([0.5, 0.8, 1]);
      expect([QUALITY.low.water, QUALITY.mid.water, QUALITY.high.water]).toEqual(["flat", "reduced", "full"]);
      expect([QUALITY.low.maxDpr, QUALITY.mid.maxDpr, QUALITY.high.maxDpr]).toEqual([1, 1.5, 1.75]);
   });
   it("qualityFor returns the shared tier object", () => {
      expect(qualityFor({ declines: 3, coarsePointer: false })).toBe(QUALITY.low);
      expect(qualityFor({ declines: 0, coarsePointer: false }).tier).toBe("high");
   });
});

describe("scaledCount", () => {
   it("scales and rounds", () => {
      expect(scaledCount(20, 0.7)).toBe(14);
      expect(scaledCount(18, 0.4)).toBe(7);
      expect(scaledCount(10, 1)).toBe(10);
   });
   it("keeps at least one for a positive count and never exceeds it", () => {
      expect(scaledCount(1, 0.4)).toBe(1);
      expect(scaledCount(2, 0.01)).toBe(1);
      expect(scaledCount(5, 3)).toBe(5);
   });
   it("is 0 for nothing or nonsense", () => {
      expect(scaledCount(0, 1)).toBe(0);
      expect(scaledCount(-3, 1)).toBe(0);
      expect(scaledCount(Number.NaN, 1)).toBe(0);
   });
});
