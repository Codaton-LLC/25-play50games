import { describe, expect, it } from "vitest";
import { fillStars } from "./Starfield";
import { fillSnow, stepSnow } from "./SnowFall";
import { waterDetail } from "./Water";

describe("starfield", () => {
   it("is seeded and lies on the shell", () => {
      const a = new Float32Array(30);
      const b = new Float32Array(30);
      const ca = new Float32Array(30);
      const cb = new Float32Array(30);
      fillStars(a, ca, 10, 7, 100, false);
      fillStars(b, cb, 10, 7, 100, false);
      expect(Array.from(a)).toEqual(Array.from(b));
      for (let i = 0; i < 10; i++) expect(Math.hypot(a[i * 3], a[i * 3 + 1], a[i * 3 + 2])).toBeCloseTo(100, 2);
   });
   it("keeps stars above the horizon on request", () => {
      const p = new Float32Array(300);
      fillStars(p, new Float32Array(300), 100, 3, 50, true);
      for (let i = 0; i < 100; i++) expect(p[i * 3 + 1]).toBeGreaterThan(0);
   });
});

describe("snowfall", () => {
   const area = [10, 6, 10] as const;
   it("falls, sways and stays inside the box", () => {
      const pos = new Float32Array(3 * 50);
      const traits = new Float32Array(2 * 50);
      fillSnow(pos, traits, 50, area, 5);
      const y0 = pos[1];
      stepSnow(pos, traits, 50, area, 1.2, 0.016, 0);
      expect(pos[1]).toBeLessThan(y0 + 1e-9);
      for (let k = 0; k < 2000; k++) stepSnow(pos, traits, 50, area, 1.2, 0.05, k * 0.05);
      for (let i = 0; i < 50; i++) {
         expect(Math.abs(pos[i * 3])).toBeLessThanOrEqual(5 + 1e-4);
         expect(Math.abs(pos[i * 3 + 1])).toBeLessThanOrEqual(3 + 1e-4);
         expect(Math.abs(pos[i * 3 + 2])).toBeLessThanOrEqual(5 + 1e-4);
      }
   });
   it("is frozen at dt 0 and moves only the drawn flakes", () => {
      const pos = new Float32Array(3 * 4);
      const traits = new Float32Array(2 * 4);
      fillSnow(pos, traits, 4, area, 1);
      const before = Array.from(pos);
      stepSnow(pos, traits, 4, area, 1, 0, 0);
      expect(Array.from(pos)).toEqual(before);
      stepSnow(pos, traits, 2, area, 1, 0.1, 0);
      expect(Array.from(pos.subarray(6))).toEqual(before.slice(6));
   });
});

describe("water detail", () => {
   it("follows the quality tier", () => {
      expect(waterDetail("flat", 0.2, [40, 40])).toEqual({ segments: [1, 1], amplitude: 0 });
      const full = waterDetail("full", 0.2, [40, 40]);
      const reduced = waterDetail("reduced", 0.2, [40, 40]);
      expect(full.amplitude).toBe(0.2);
      expect(reduced.amplitude).toBeCloseTo(0.12, 6);
      expect(full.segments[0]).toBeGreaterThan(reduced.segments[0]);
      expect(waterDetail("full", 0.2, [400, 2]).segments).toEqual([96, 4]);
   });
   it("caps a long sea by tier and leaves the desktop grid unchanged", () => {
      // pirate bay 500 x 360 and the treasure sea 180 x 180 both hit the old shared cap of 96
      for (const size of [[500, 360], [180, 180]] as const) {
         expect(waterDetail("full", 0.18, size).segments).toEqual([96, 96]);
         expect(waterDetail("reduced", 0.18, size).segments).toEqual([48, 48]);
         expect(waterDetail("flat", 0.18, size).segments).toEqual([1, 1]);
      }
      // under the reduced cap the 1.2 m step is the same as before (a 40 m pond, a 14 m river)
      expect(waterDetail("full", 0.2, [40, 40]).segments).toEqual([67, 67]);
      expect(waterDetail("reduced", 0.2, [40, 40]).segments).toEqual([33, 33]);
      expect(waterDetail("reduced", 0.2, [14, 220]).segments).toEqual([12, 48]);
      expect(waterDetail("full", 0.2, [14, 220]).segments).toEqual([23, 96]);
      expect(waterDetail("reduced", 0.2, [400, 2]).segments).toEqual([48, 4]);
      // full amplitude and the 0.6 m step still produce the previous desktop grid
      expect(waterDetail("full", 0.2, [60, 60]).segments).toEqual([96, 96]);
      expect(waterDetail("full", 0.2, [60, 60]).amplitude).toBe(0.2);
   });
});
