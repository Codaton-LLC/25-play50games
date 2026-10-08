import { describe, expect, it } from "vitest";
import { createFrameStats, framePercentiles, pushFrame, resetFrameStats } from "./perfStats";

const out = () => ({ p50: -1, p95: -1, max: -1 });

describe("frame stats", () => {
   it("is all zero without samples", () => {
      expect(framePercentiles(createFrameStats(10), out())).toEqual({ p50: 0, p95: 0, max: 0 });
   });

   it("gives nearest-rank percentiles of the samples so far", () => {
      const stats = createFrameStats(600);
      for (let i = 1; i <= 100; i++) pushFrame(stats, i);
      expect(framePercentiles(stats, out())).toEqual({ p50: 50, p95: 95, max: 100 });
   });

   it("keeps only the last `capacity` frames", () => {
      const stats = createFrameStats(4);
      for (const ms of [100, 100, 100, 100, 10, 20, 30, 40]) pushFrame(stats, ms);
      expect(stats.count).toBe(4);
      expect(framePercentiles(stats, out())).toEqual({ p50: 20, p95: 40, max: 40 });
   });

   it("ignores nonsense samples and resets", () => {
      const stats = createFrameStats(8);
      pushFrame(stats, Number.NaN);
      pushFrame(stats, -1);
      pushFrame(stats, Infinity);
      expect(stats.count).toBe(0);
      pushFrame(stats, 16.7);
      expect(framePercentiles(stats, out()).max).toBeCloseTo(16.7, 3);
      resetFrameStats(stats);
      expect(framePercentiles(stats, out()).max).toBe(0);
   });

   it("does not disturb the ring when sorting", () => {
      const stats = createFrameStats(3);
      pushFrame(stats, 30);
      pushFrame(stats, 10);
      pushFrame(stats, 20);
      framePercentiles(stats, out());
      expect(Array.from(stats.ring)).toEqual([30, 10, 20]);
   });
});
