import { describe, expect, it } from "vitest";
import { PITCH, PITCH_LANDSCAPE, viewFor } from "./camera";

// Window sizes measured in the headless playtest (README "Camera"): phones need the
// tighter window for >= 24 CSS px objects with the cookie banner open.
describe("dino-egg-rescue camera windows", () => {
   it("phone portrait: 8.0 x 10.8 m at pitch 50 deg", () => {
      const v = viewFor(390, 844);
      expect(v.area.max.x - v.area.min.x).toBeCloseTo(8.0);
      expect(v.area.max.z - v.area.min.z).toBeCloseTo(10.8);
      expect(v.pitch).toBe(PITCH);
   });

   it("phone landscape: 10.6 x 7.4 m at pitch 60 deg", () => {
      const v = viewFor(844, 390);
      expect(v.area.max.x - v.area.min.x).toBeCloseTo(10.6);
      expect(v.area.max.z - v.area.min.z).toBeCloseTo(7.4);
      expect(v.pitch).toBe(PITCH_LANDSCAPE);
   });

   it("desktop keeps the wide 16 x 11 m window at pitch 50 deg", () => {
      const v = viewFor(1280, 800);
      expect(v.area.max.x - v.area.min.x).toBeCloseTo(16);
      expect(v.area.max.z - v.area.min.z).toBeCloseTo(11);
      expect(v.pitch).toBe(PITCH);
   });

   it("returns the same options object for the same size (no refit churn)", () => {
      expect(viewFor(390, 844)).toBe(viewFor(390, 844));
   });
});
