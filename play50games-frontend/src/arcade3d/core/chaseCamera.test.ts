import { describe, expect, it } from "vitest";
import { angleDelta, chaseFov, createChaseState, portraitPullback, stepChase, type ChaseOptions } from "./chaseCamera";

const OPTS: ChaseOptions = { distance: 8, height: 4, lookAhead: 3, lookHeight: 1, yawRate: 3, followRate: 6 };

describe("chase camera", () => {
   it("places itself behind the heading on the first frame and looks ahead of the target", () => {
      const s = stepChase(createChaseState(), { x: 2, y: 0, z: 5, yaw: 0 }, OPTS, 1 / 60);
      // yaw 0 faces +z: the camera is on the -z side
      expect(s.x).toBeCloseTo(2, 9);
      expect(s.z).toBeCloseTo(5 - 8, 9);
      expect(s.y).toBeCloseTo(4, 9);
      expect(s.lookZ).toBeCloseTo(8, 9);
      expect(s.lookY).toBeCloseTo(1, 9);
   });

   it("screen left is the vehicle's left: a left turn (yaw up) swings the camera so the view turns left", () => {
      // a camera behind heading y looks along (sin y, cos y); its right is (-cos y, sin y). A heading
      // turned by +e then points to the camera's left (negative along its right), at every heading
      for (const y of [0, 1, 2.5, -2, Math.PI]) {
         const s = stepChase(createChaseState(), { x: 0, y: 0, z: 0, yaw: y }, OPTS, 1 / 60);
         const rightX = -Math.cos(s.yaw);
         const rightZ = Math.sin(s.yaw);
         const e = 0.2;
         expect(Math.sin(y + e) * rightX + Math.cos(y + e) * rightZ).toBeLessThan(0);
         expect(Math.sin(y - e) * rightX + Math.cos(y - e) * rightZ).toBeGreaterThan(0);
      }
   });

   it("follows a heading change the shortest way round, with a lag", () => {
      const s = stepChase(createChaseState(), { x: 0, y: 0, z: 0, yaw: Math.PI - 0.1 }, OPTS, 1 / 60);
      stepChase(s, { x: 0, y: 0, z: 0, yaw: -Math.PI + 0.1 }, OPTS, 1 / 60);
      // it went through PI (+0.2 the short way), not back through 0
      expect(Math.abs(angleDelta(s.yaw, Math.PI))).toBeLessThan(0.11);
      for (let i = 0; i < 300; i++) stepChase(s, { x: 0, y: 0, z: 0, yaw: -Math.PI + 0.1 }, OPTS, 1 / 60);
      expect(Math.abs(angleDelta(s.yaw, -Math.PI + 0.1))).toBeLessThan(1e-3);
   });

   it("never dips under the ground and stays clear of it", () => {
      const hill = () => 10;
      const s = stepChase(createChaseState(), { x: 0, y: 0, z: 0, yaw: 0 }, OPTS, 1 / 60, hill);
      expect(s.y).toBeGreaterThanOrEqual(11.5 - 1e-9);
   });

   it("widens the lens and pulls back on a portrait phone only", () => {
      expect(chaseFov(1280 / 800, 55, 62, 75)).toBe(55);
      expect(chaseFov(390 / 844, 55, 62, 75)).toBe(75);
      expect(portraitPullback(1.6)).toBe(1);
      expect(portraitPullback(390 / 844)).toBeCloseTo(1.4, 2);
      expect(portraitPullback(0.8)).toBeGreaterThan(1);
   });
});
