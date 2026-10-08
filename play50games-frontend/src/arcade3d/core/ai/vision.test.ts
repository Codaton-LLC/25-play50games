import { describe, expect, it } from "vitest";
import { hasLineOfSightXZ, inViewCone } from "./vision";
const v = (x: number, z: number) => ({ x, y: 0, z });
describe("vision", () => {
   it("distinguishes cone edges just inside/outside, including yaw wrap", () => {
      for (const yaw of [0, 1, Math.PI * 2 - 0.1]) {
         const half = Math.PI / 4;
         for (const sign of [-1, 1]) {
            const target = (delta: number) => v(Math.sin(yaw + sign * delta), Math.cos(yaw + sign * delta));
            expect(inViewCone(v(0, 0), yaw, half, 2, target(half - 1e-6))).toBe(true);
            expect(inViewCone(v(0, 0), yaw, half, 2, target(half))).toBe(true);
            expect(inViewCone(v(0, 0), yaw, half, 2, target(half + 1e-6))).toBe(false);
         }
      }
      expect(inViewCone(v(0, 0), 0, 1, 1, v(0, 2))).toBe(false);
      expect(inViewCone(v(0, 0), 0, 0, 0, v(0, 0))).toBe(true);
   });
   it("blocks box corner grazing and permits a near miss", () => {
      const box = { min: { x: 1, y: -1, z: 1 }, max: { x: 2, y: 1, z: 2 } };
      expect(hasLineOfSightXZ(v(0, 2), v(2, 0), [box])).toBe(false);
      expect(hasLineOfSightXZ(v(0, 2 - 1e-6), v(2 - 1e-6, 0), [box])).toBe(true);
      expect(hasLineOfSightXZ(v(1.5, 1.5), v(3, 3), [box])).toBe(false);
      expect(hasLineOfSightXZ(v(0, 0), v(0, 3), [box])).toBe(true);
      expect(hasLineOfSightXZ(v(3, 3), v(0, 0), [box])).toBe(false);
   });
   it("rejects non-finite sight endpoints even without blockers", () => {
      for (const value of [NaN, Infinity, -Infinity]) {
         expect(hasLineOfSightXZ(v(value, 0), v(1, 0), [])).toBe(false);
         expect(hasLineOfSightXZ(v(0, 0), { x: 1, y: value, z: 0 }, [])).toBe(false);
      }
   });
});
