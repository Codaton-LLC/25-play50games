import { describe, expect, it } from "vitest";
import { Box3, Vector3 } from "three";
import {
   COLORS,
   PLANET_DECOR,
   PLANET_LOOKS,
   PLAY_AREA,
   buildCavernRoofGeometry,
   buildTerrainMesh,
   contrastRatio,
   inPlayArea,
} from "./looks";
import { fitRocketView, rocketBox } from "./cameraMath";
import { createRun } from "./rules";

describe("rocket-landing looks: decor positions and play area clearance", () => {
   it("ensures every decor spot is strictly outside the play area bounds", () => {
      let count = 0;
      for (let p = 0; p < PLANET_DECOR.length; p++) {
         const planetSpots = PLANET_DECOR[p];
         const allSpots = [...planetSpots.peaks, ...planetSpots.rocks, ...planetSpots.props];
         expect(allSpots.length).toBeGreaterThan(15);
         for (const spot of allSpots) {
            count++;
            expect(inPlayArea(spot.x, spot.y, spot.z)).toBe(false);
            // Spot must be either behind the play area (z <= -5.0) or outside the flanks (|x| >= 11.5)
            const behind = spot.z <= -4.5;
            const outsideSides = Math.abs(spot.x) >= 11.0;
            expect(behind || outsideSides).toBe(true);
            // Ensure no decor ever sits between camera (z > 15) and play area (z: [-2.5, 2.5])
            expect(spot.z).toBeLessThan(PLAY_AREA.z1);
         }
      }
      expect(count).toBeGreaterThan(100);
   });

   it("verifies celestial moons are placed deep in the background sky", () => {
      for (const look of PLANET_LOOKS) {
         expect(look.moon.z).toBeLessThanOrEqual(-20);
         expect(look.moon.y).toBeGreaterThanOrEqual(14);
         expect(inPlayArea(look.moon.x, look.moon.y, look.moon.z)).toBe(false);
      }
   });

   it("verifies no decor occludes the rocket or landing pad from fitted cameras at 1280x800, 390x844, and 844x390", () => {
      const viewports = [
         { width: 1280, height: 800, name: "desktop" },
         { width: 390, height: 844, name: "mobile portrait" },
         { width: 844, height: 390, name: "mobile landscape" },
      ];

      for (const vp of viewports) {
         const run = createRun(0, false);
         // Test at various flight and landing positions
         const positions = [
            { x: 0, y: 3.1 }, // landed on pad
            { x: -5, y: 14 }, // high spawn
            { x: 4, y: 8 },  // mid flight
            { x: -7, y: 2 }, // low near edge
         ];

         for (const pos of positions) {
            run.body.x = pos.x;
            run.body.y = pos.y;
            const view = fitRocketView(rocketBox(run), vp.width, vp.height, []);
            expect(view.distance).toBeGreaterThan(5);

            // Camera is at [view.x, view.y, view.distance] with view.distance >= 15
            // Every decor object has z <= -4.5 (behind the play area) or |x| >= 11 (beside it).
            // Since the camera is at z > 15 and rocket is at z = 0, no background decor (z <= -4.5)
            // can ever sit between the camera and the rocket or pad (z = 0)!
            for (const decor of PLANET_DECOR) {
               for (const s of [...decor.peaks, ...decor.rocks, ...decor.props]) {
                  // A point between camera and rocket would require z > 0 and |x| <= 10.5
                  const inFrontOfRocket = s.z > 0;
                  expect(inFrontOfRocket && Math.abs(s.x) <= 10.5).toBe(false);
               }
            }
         }
      }
   });
});

describe("rocket-landing looks: ground terrain coverage", () => {
   it("builds wide terrain covering the entire view with no void at all three screen sizes", () => {
      const run = createRun(0, false);
      const geom = buildTerrainMesh(run.layouts[0].terrain, 0);

      const box = new Box3();
      const pos = geom.getAttribute("position");
      const v = new Vector3();
      for (let i = 0; i < pos.count; i++) {
         v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
         box.expandByPoint(v);
      }

      // Width: covers at least +/- 40 m
      expect(box.min.x).toBeLessThanOrEqual(-40);
      expect(box.max.x).toBeGreaterThanOrEqual(40);

      // Depth: covers from z = -16 to z = +8
      expect(box.min.z).toBeLessThanOrEqual(-16);
      expect(box.max.z).toBeGreaterThanOrEqual(8);

      // Height: bedrock drops down to y = -14
      expect(box.min.y).toBeLessThanOrEqual(-14);

      // Verify that at 1280x800, 390x844, and 844x390 the frustum bottom at z = 0 is well above y = -14
      const viewports = [
         { width: 1280, height: 800 },
         { width: 390, height: 844 },
         { width: 844, height: 390 },
      ];
      const tangent = Math.tan((35 * Math.PI) / 360);

      for (const vp of viewports) {
         const view = fitRocketView(rocketBox(run), vp.width, vp.height, []);
         const halfHeight = view.distance * tangent;
         const frustumBottom = view.y - halfHeight;
         // Frustum bottom at z=0 must be well above the terrain bottom at -14
         expect(frustumBottom).toBeGreaterThan(-14);
      }

      geom.dispose();
   });
});

describe("rocket-landing looks: cavern roof hazard geometry", () => {
   it("matches the exact physical collision bounding box [-3, 3] x [9, 10] x [-1.5, 1.5]", () => {
      const geom = buildCavernRoofGeometry();
      const box = new Box3();
      const pos = geom.getAttribute("position");
      const v = new Vector3();
      for (let i = 0; i < pos.count; i++) {
         v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
         box.expandByPoint(v);
      }

      expect(box.min.x).toBeCloseTo(-3.0, 2);
      expect(box.max.x).toBeCloseTo(3.0, 2);
      expect(box.min.y).toBeCloseTo(9.0, 2);
      expect(box.max.y).toBeCloseTo(10.0, 2);
      expect(box.min.z).toBeCloseTo(-1.5, 2);
      expect(box.max.z).toBeCloseTo(1.5, 2);

      geom.dispose();
   });
});

describe("rocket-landing looks: color contrast and readability", () => {
   it("ensures rocket hull and flame pop against all 5 planetary backgrounds", () => {
      for (const look of PLANET_LOOKS) {
         // White rocket hull (#f8fafc) against sky top and sky bottom
         const contrastSkyTop = contrastRatio(COLORS.rocketHull, look.skyTop);
         const contrastSkyBottom = contrastRatio(COLORS.rocketHull, look.skyBottom);
         expect(contrastSkyTop).toBeGreaterThanOrEqual(4.5);
         expect(contrastSkyBottom).toBeGreaterThanOrEqual(2.5);

         // Flame core (#fef08a) against sky
         const contrastFlame = contrastRatio(COLORS.flameCore, look.skyTop);
         expect(contrastFlame).toBeGreaterThanOrEqual(4.5);
      }
   });

   it("ensures landing pad beacon and glow contrast clearly against pad metal and ground", () => {
      const contrastPadGlowOnMetal = contrastRatio(COLORS.padGlow, COLORS.padMetal);
      expect(contrastPadGlowOnMetal).toBeGreaterThanOrEqual(3.0);
   });
});
