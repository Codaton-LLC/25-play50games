import { describe, expect, it } from "vitest";
import { leadPoint, offsetPitchDeg, portraitFollowOffset } from "./portraitFollow";

describe("portraitFollowOffset", () => {
   it("keeps the fitted overview on landscape and square screens", () => {
      const fitted: [number, number, number] = [3, 20, 12];
      expect(portraitFollowOffset(fitted, 1.6, 9, 35)).toBe(fitted);
      expect(portraitFollowOffset(fitted, 1, 9, 35)).toBe(fitted);
   });
   it("sits behind the hero on the fitted heading, at the set distance and a lower pitch", () => {
      // a steep fitted view (about 57 degrees down) becomes a behind-and-forward 35 degrees
      const fitted: [number, number, number] = [0, 30, 20];
      const o = portraitFollowOffset(fitted, 0.46, 9, 35);
      expect(Math.hypot(...o)).toBeCloseTo(9);
      expect(offsetPitchDeg(o)).toBeCloseTo(35);
      expect(o[0]).toBeCloseTo(0);
      expect(o[2]).toBeGreaterThan(0);
      // a turned fitted view keeps its compass heading
      const turned = portraitFollowOffset([12, 25, 5], 0.46, 8, 30);
      expect(Math.atan2(turned[0], turned[2])).toBeCloseTo(Math.atan2(12, 5));
   });
   it("falls back to behind on +z for a straight-down fitted view", () => {
      const o = portraitFollowOffset([0, 25, 0], 0.5, 8, 40);
      expect(o[0]).toBe(0);
      expect(o[2]).toBeGreaterThan(0);
      expect(offsetPitchDeg(o)).toBeCloseTo(40);
   });
});

describe("leadPoint", () => {
   it("aims past the hero, away from the camera, so the level ahead fills the top of the screen", () => {
      const out = { x: 0, y: 0, z: 0 };
      leadPoint({ x: 1, y: 0, z: 2 }, [0, 5, 7], 2, 0.5, out);
      expect(out.x).toBeCloseTo(1);
      expect(out.y).toBeCloseTo(0.5);
      expect(out.z).toBeCloseTo(0); // camera on +z, ahead is -z
   });
});

describe("portraitFollowOffset with a look-ahead", () => {
   it("keeps the camera at the set distance and pitch from the hero while it aims ahead", () => {
      const hero = { x: 2, y: 0, z: -1 };
      const fitted: [number, number, number] = [4, 20, 9];
      const rig = portraitFollowOffset(fitted, 0.46, 9, 35, 2.5, 0.4);
      const aim = leadPoint(hero, rig, 2.5, 0.4, { x: 0, y: 0, z: 0 });
      const cam = [aim.x + rig[0] - hero.x, aim.y + rig[1] - hero.y, aim.z + rig[2] - hero.z] as [number, number, number];
      expect(Math.hypot(...cam)).toBeCloseTo(9);
      expect(offsetPitchDeg(cam)).toBeCloseTo(35);
      // the view itself looks lower than 35 degrees: forward, at the level ahead
      expect(offsetPitchDeg(rig)).toBeLessThan(35);
   });
});
