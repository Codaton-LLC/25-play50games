import { describe, expect, it } from "vitest";
import { landingPoint, launchForTime, solveLaunch, stepProjectile, trajectoryPoints } from "./ballistics";
const origin = { x: 0, y: 0, z: 0 };
const params = { gravity: 9.81 };
describe("ballistics", () => {
   it("hits three ranges within a millimetre on both arcs", () => {
      for (const range of [3, 15, 35]) for (const high of [false, true]) {
         const target = { x: range, y: 2, z: range / 3 };
         const v = solveLaunch(origin, target, 25, params, high)!;
         const time = target.x / v.x;
         expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(25, 10);
         expect(Math.hypot(v.x * time - target.x, v.y * time - 4.905 * time * time - target.y, v.z * time - target.z)).toBeLessThan(0.001);
      }
      expect(solveLaunch(origin, { x: 1000, y: 0, z: 0 }, 10, params)).toBeNull();
   });
   it("solves vertical shots, zero gravity and wind intercepts", () => {
      const target = { x: 0, y: 5, z: 0 };
      expect(solveLaunch(origin, target, 15, params)?.y).toBeCloseTo(15);
      expect(solveLaunch(origin, { x: 2, y: 0, z: 0 }, 2, { gravity: 0 })).toEqual({ x: 2, y: 0, z: 0 });
      const p = { gravity: 9.81, wind: { x: 2, z: -1 } }, to = { x: 10, y: 1, z: 3 };
      const v = solveLaunch(origin, to, 15, p)!;
      const t = (-v.x + Math.sqrt(v.x * v.x + 40)) / 2;
      expect(v.y * t - p.gravity * t * t / 2).toBeCloseTo(1, 10);
      expect(v.z * t - t * t / 2).toBeCloseTo(3, 10);
   });
   it("launchForTime supports aliasing and constant wind", () => {
      const from = { x: 1, y: 2, z: 3 }, to = { x: 9, y: 0, z: 1 };
      expect(launchForTime(from, to, 2, { gravity: 10, wind: { x: 2, z: -2 } }, from)).toBe(from);
      expect(from).toEqual({ x: 2, y: 9, z: 1 });
      expect(() => launchForTime(origin, to, 0, params)).toThrow();
   });
   it("steps semi-implicitly and shifts landing with wind", () => {
      const proj = { x: 0, y: 0, z: 0, vx: 3, vy: 10, vz: 0 };
      const p = { gravity: 10, wind: { x: 2, z: -1 } };
      expect(landingPoint(proj, params)?.x).toBeCloseTo(60 / 9.81);
      expect(landingPoint(proj, p)).toEqual({ x: expect.closeTo(10, 9), y: 0, z: expect.closeTo(-2, 9) });
      stepProjectile(proj, 0.1, p);
      expect(proj).toEqual({ x: expect.closeTo(0.32), y: 0.9, z: expect.closeTo(-0.01), vx: 3.2, vy: 9, vz: -0.1 });
   });
   it("bounds trajectory writes and stops exactly at ground", () => {
      const proj = { x: 0, y: 1, z: 0, vx: 2, vy: 0, vz: 0 };
      const out = new Float32Array(30).fill(99);
      const n = trajectoryPoints(proj, { gravity: 2 }, 10, 0.3, out);
      expect(n).toBe(5); expect(out[12]).toBe(2); expect(out[13]).toBe(0); expect(out[15]).toBe(99);
      expect(proj.y).toBe(1);
      expect(trajectoryPoints(proj, params, 99, 0.1, new Float32Array(6))).toBe(2);
      expect(landingPoint({ ...proj, vy: 1 }, { gravity: 0 })).toBeNull();
      expect(trajectoryPoints(proj, params, -1, 0.1, out)).toBe(0);
   });
   it("retains precision for fast downward landing", () => {
      const proj = { x: 0, y: 1, z: 0, vx: 1e8, vy: -1e8, vz: 0 };
      expect(landingPoint(proj, params)?.x).toBeCloseTo(1, 10);
   });
});
