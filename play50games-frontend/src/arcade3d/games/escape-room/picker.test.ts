import { describe, expect, it } from "vitest";
import { BADGE_PX, MARKER_PX, hitsBillboard, screenSpriteSize } from "./picker";

describe("escape-room picker", () => {
   it("a 44 px badge is 44 css pixels tall at the given depth", () => {
      const fov = 45;
      const height = 812;
      const depth = 20;
      const side = screenSpriteSize(depth, fov, height, BADGE_PX);
      const css = (side * height) / (2 * depth * Math.tan((fov * Math.PI) / 360));
      expect(css).toBeCloseTo(BADGE_PX, 6);
      expect(screenSpriteSize(depth, fov, height, MARKER_PX) / side).toBeCloseTo(MARKER_PX / BADGE_PX, 6);
      expect(screenSpriteSize(0, fov, height, BADGE_PX)).toBe(0);
   });

   it("hits the square, including the edge, and misses behind the camera and outside the corner", () => {
      // plane at the origin, facing +z, right = +x, up = +y, half-side 0.5
      const hit = (ox: number, oz: number, dx: number, dz: number, px = 0, half = 0.5) =>
         hitsBillboard(ox, 0, oz, dx, 0, dz, px, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, half);
      expect(hit(0, 2, 0, -1)).toBe(true);
      expect(hit(0.5, 2, 0, -1)).toBe(true);
      expect(hit(0.501, 2, 0, -1)).toBe(false);
      expect(hit(0, -2, 0, -1)).toBe(false);
      expect(hit(0, 2, 0, 0)).toBe(false);
      expect(hit(0, 2, 0, -1, 3)).toBe(false);
   });
});
