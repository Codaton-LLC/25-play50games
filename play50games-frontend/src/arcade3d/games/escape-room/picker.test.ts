import { describe, expect, it } from "vitest";
import { BADGE_LOOK, BADGE_PX, MARKER_PX, badgeShowsLoot, hitsBillboard, screenSpriteSize } from "./picker";
import { DOOR_ID, NONE, createRun } from "./rules";

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

   it("the badge turns see-through only over an opened container's loot that is on show", () => {
      const run = createRun(5050);
      const filled = run.layout.stations.findIndex((s) => s.item !== NONE);
      const empty = run.layout.stations.findIndex((s) => s.item === NONE);
      const item = run.layout.stations[filled].item;
      expect(badgeShowsLoot(run, filled)).toBe(false);
      run.stations[filled].phase = "opening";
      expect(badgeShowsLoot(run, filled)).toBe(false);
      run.stations[filled].phase = "open";
      run.items[item].visible = true;
      expect(badgeShowsLoot(run, filled)).toBe(true);
      run.stations[filled].phase = "collected";
      run.items[item].visible = false;
      expect(badgeShowsLoot(run, filled)).toBe(false);
      run.stations[empty].phase = "open";
      expect(badgeShowsLoot(run, empty)).toBe(false);
      expect(badgeShowsLoot(run, DOOR_ID)).toBe(false);
      expect(badgeShowsLoot(run, NONE)).toBe(false);
      // see-through enough for the loot under it, still a visible target
      expect(BADGE_LOOK.takeFill).toBeLessThan(0.35);
      expect(BADGE_LOOK.takeRing).toBeGreaterThan(0.3);
   });
});
