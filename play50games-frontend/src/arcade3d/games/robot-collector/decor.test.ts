import { describe, expect, it } from "vitest";
import { fitView } from "@/arcade3d/core/view";
import {
   allDecorSpots,
   ARENA_BOUNDS,
   COLORS,
   contrastRatio,
   isInsidePlayArea,
   PLAY_AREA_OUTER,
   segmentIntersectsBox,
   type BoundingBox,
   type Point3D,
} from "./looks";

describe("robot-collector decor & visual pass", () => {
   const decor = allDecorSpots();

   it("every decor spot is strictly outside the play area and perimeter walls", () => {
      expect(decor.length).toBeGreaterThan(15);
      for (const item of decor) {
         const { spot, box, name } = item;
         // Center point must not be inside playfield
         expect(isInsidePlayArea(spot.x, spot.z), `${name} center is inside play area`).toBe(false);

         // Bounding box must not overlap the active playfield bounds
         const overlapsX = box.maxX > PLAY_AREA_OUTER.minX && box.minX < PLAY_AREA_OUTER.maxX;
         const overlapsZ = box.maxZ > PLAY_AREA_OUTER.minZ && box.minZ < PLAY_AREA_OUTER.maxZ;
         const overlaps = overlapsX && overlapsZ;
         expect(overlaps, `${name} box overlaps play area outer perimeter`).toBe(false);
      }
   });

   it("key game elements have strong contrast against the floor", () => {
      // Robot, battery, crates, and barrels should clearly stand out against the floor
      const robotContrast = contrastRatio(COLORS.robot, COLORS.floor);
      const batteryContrast = contrastRatio(COLORS.battery, COLORS.floor);
      const crateContrast = contrastRatio(COLORS.crate, COLORS.floor);
      const barrelContrast = contrastRatio(COLORS.barrel, COLORS.floor);

      expect(robotContrast).toBeGreaterThan(2.5);
      expect(batteryContrast).toBeGreaterThan(2.5);
      expect(crateContrast).toBeGreaterThan(2.5);
      expect(barrelContrast).toBeGreaterThan(1.5);
   });

   describe("fitted camera occlusion checks at 1280x800, 390x844, and 844x390", () => {
      const PITCH = (56 * Math.PI) / 180;
      const WAREHOUSE = {
         min: { x: -12.4, y: 0, z: -8.4 },
         max: { x: 12.4, y: 0.9, z: 8.4 },
      };

      const testSizes: Array<{ name: string; width: number; height: number }> = [
         { name: "desktop 1280x800", width: 1280, height: 800 },
         { name: "portrait 390x844", width: 390, height: 844 },
         { name: "landscape 844x390", width: 844, height: 390 },
      ];

      // Sample points across the active play area (corners, edges, center, robot heights 0 to 1.5)
      const testTargets: Point3D[] = [];
      for (const x of [-11, -5, 0, 5, 11]) {
         for (const z of [-7, -3, 0, 3, 7]) {
            for (const y of [0, 0.5, 1.4]) {
               testTargets.push({ x, y, z });
            }
         }
      }

      for (const { name, width, height } of testSizes) {
         it(`no decor occludes any point of the play area at ${name}`, () => {
            const fitted = fitView({
               width,
               height,
               fov: 45,
               area: WAREHOUSE,
               pitch: PITCH,
               yaws: [0, Math.PI / 2],
               margin: { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 },
               padding: 8,
               shift: true,
            });

            // Camera world position for this fit
            const cameraPos: Point3D = {
               x: fitted.offset[0],
               y: fitted.offset[1],
               z: fitted.offset[2],
            };

            // Test every sample point in the playfield against all decor bounding boxes
            for (const target of testTargets) {
               for (const item of decor) {
                  const occludes = segmentIntersectsBox(cameraPos, target, item.box);
                  expect(
                     occludes,
                     `Decor ${item.name} occludes target (${target.x}, ${target.y}, ${target.z}) at ${name} from camera (${cameraPos.x.toFixed(1)}, ${cameraPos.y.toFixed(1)}, ${cameraPos.z.toFixed(1)})`
                  ).toBe(false);
               }
            }
         });
      }
   });

   it("outer ground plane covers the viewport below the playfield at all three sizes", () => {
      // The outer ground is 80 x 70 at y = -0.27
      const GROUND = { halfX: 40, halfZ: 35 };

      const PITCH = (56 * Math.PI) / 180;
      const WAREHOUSE = {
         min: { x: -12.4, y: 0, z: -8.4 },
         max: { x: 12.4, y: 0.9, z: 8.4 },
      };

      const testSizes = [
         { width: 1280, height: 800 },
         { width: 390, height: 844 },
         { width: 844, height: 390 },
      ];

      for (const { width, height } of testSizes) {
         const fitted = fitView({
            width,
            height,
            fov: 45,
            area: WAREHOUSE,
            pitch: PITCH,
            yaws: [0, Math.PI / 2],
            margin: { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 },
            padding: 8,
            shift: true,
         });

         // Camera looks down at PITCH (56°). The bottom of the frustum looks down even steeper:
         // angle = 56° + 22.5° = 78.5°. The ray hits ground at distance:
         // yCam / tan(angle) <= yCam / tan(56°) ≈ 19 / 1.48 ≈ 13 units from focus.
         // With ground extending 35 units in Z and 40 units in X, ground easily covers the bottom.
         expect(GROUND.halfX).toBeGreaterThanOrEqual(fitted.distance * Math.sin(0.4) + ARENA_BOUNDS.maxX);
         expect(GROUND.halfZ).toBeGreaterThanOrEqual(ARENA_BOUNDS.maxZ + 15);
      }
   });
});
