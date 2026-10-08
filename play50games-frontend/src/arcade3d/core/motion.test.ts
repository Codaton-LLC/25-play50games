import { describe, expect, it } from "vitest";
import { bank, hop, hover, spring, squashStretch, waddle } from "./motion";
describe("motion", () => {
   it("fills and resets reusable offsets", () => {
      const out = { y: 9, roll: 9, yaw: 9, squash: 9 };
      expect(hop(Math.PI / 2, 2, out)).toBe(out); expect(out.y).toBe(2); expect(out.roll).toBe(0);
      expect(waddle(Math.PI / 2, 0.2, out)).toBe(out); expect(out.roll).toBeCloseTo(0.2);
      expect(hover(0, 1, out)).toBe(out); expect(out).toEqual({ y: 0, roll: 0, yaw: 0, squash: 1 });
      expect(Math.abs(bank(1000, 0.4))).toBe(0.4);
   });
   it("critical damping converges without overshoot", () => {
      for (const hz of [30, 60, 144]) {
         const state = { x: 0, v: 0 };
         for (let i = 0; i < hz * 3; i++) { spring(state, 1, 25, -1, 1 / hz); expect(state.x).toBeLessThanOrEqual(1); }
         expect(state.x).toBeCloseTo(1, 4);
      }
   });
   it("solves all damping regimes independently of frame split", () => {
      for (const damping of [0, 1, 10, 20]) {
         const a = { x: 2, v: 1 }, b = { ...a };
         spring(a, 0, 25, damping, 1);
         for (let i = 0; i < 100; i++) spring(b, 0, 25, damping, 0.01);
         expect(a.x).toBeCloseTo(b.x, 10); expect(a.v).toBeCloseTo(b.v, 10);
      }
      const free = { x: 2, v: 1 }; spring(free, 0, 0, 0, 3); expect(free.x).toBe(5);
   });
   it("preserves volume during squash/stretch", () => {
      const out = { x: 0, y: 0, z: 0 };
      for (const scale of [0.5, 1, 2]) { expect(squashStretch(scale, out)).toBe(out); expect(out.x * out.y * out.z).toBeCloseTo(1); }
   });
   it("ignores invalid or nonpositive spring time", () => {
      const state = { x: 2, v: 3 };
      for (const dt of [NaN, 0, -1]) { spring(state, 0, 25, 1, dt); expect(state).toEqual({ x: 2, v: 3 }); }
   });
});
