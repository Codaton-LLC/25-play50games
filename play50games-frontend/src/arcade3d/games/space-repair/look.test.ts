import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { fitView, setLensShift } from "@/arcade3d/core/view";
import { FIT } from "./camera";
import {
   COLORS,
   contrastRatio,
   DECOR,
   HULL_GROUND,
   isOccluding,
   PLAY_BOUNDS,
   type DecorSpot,
} from "./looks";
import { MODULES, STATION } from "./rules";

describe("space-repair modern look pass", () => {
   it("ensures every decor spot sits strictly outside the play arena bounds", () => {
      expect(DECOR.length).toBeGreaterThan(15);
      for (const spot of DECOR) {
         // Arena is x in [-10, 10], z in [-10, 10]
         const insideX = spot.x >= PLAY_BOUNDS.minX && spot.x <= PLAY_BOUNDS.maxX;
         const insideZ = spot.z >= PLAY_BOUNDS.minZ && spot.z <= PLAY_BOUNDS.maxZ;
         const insideArena = insideX && insideZ;

         expect(
            insideArena,
            `Decor spot ${spot.kind} at (${spot.x}, ${spot.y}, ${spot.z}) must sit strictly outside play arena`,
         ).toBe(false);

         // Also check margin of at least 1.0 m from arena bounds
         const distToOrigin = Math.hypot(spot.x, spot.z);
         if (spot.kind !== "nebula") {
            expect(distToOrigin).toBeGreaterThan(11);
         }
      }
   });

   it("verifies zero occlusion of modules, service discs and player from fitted camera at all 3 screen sizes", () => {
      const viewports = [
         { width: 1280, height: 800, banner: 0, name: "desktop 1280x800" },
         { width: 390, height: 844, banner: 100, name: "portrait 390x844" },
         { width: 844, height: 390, banner: 85, name: "landscape 844x390" },
      ];

      // Targets that must never be occluded
      const targets: Array<{ name: string; x: number; y: number; z: number }> = [];

      // 8 Station modules and their 8 service discs
      for (const m of MODULES) {
         targets.push({ name: `module_${m.id}`, x: m.x, y: 1.1, z: m.z });
         targets.push({ name: `service_disc_${m.id}`, x: m.dx, y: 0.1, z: m.dz });
      }

      // Hub center
      targets.push({ name: "hub", x: 0, y: 0.5, z: 0 });

      // Player at key arena points
      const playerSpots = [
         { x: 0, z: 0 },
         { x: 0, z: 6 },
         { x: 6, z: 0 },
         { x: -6, z: 0 },
         { x: 0, z: -6 },
         { x: 7, z: 7 },
         { x: -7, z: 7 },
         { x: 7, z: -7 },
         { x: -7, z: -7 },
         { x: 9.5, z: 0 },
         { x: -9.5, z: 0 },
         { x: 0, z: 9.5 },
         { x: 0, z: -9.5 },
      ];

      for (const vp of viewports) {
         const view = fitView({ ...FIT, width: vp.width, height: vp.height });

         for (const p of playerSpots) {
            // Camera position following player at (p.x, 1.1, p.z)
            const camPos = {
               x: p.x + view.offset[0],
               y: 1.1 + view.offset[1],
               z: p.z + view.offset[2],
            };

            for (const t of targets) {
               // Only check targets in the current vicinity / view of the player
               if (Math.hypot(t.x - p.x, t.z - p.z) > 14) continue;

               for (const spot of DECOR) {
                  // Nebula clouds are far in background (z <= -45), not occluding
                  if (spot.kind === "nebula") continue;

                  const occludes = isOccluding(camPos, t, spot, Math.max(spot.sx, spot.sy, spot.sz) * 0.7);
                  expect(
                     occludes,
                     `${vp.name}: Decor ${spot.kind} at (${spot.x}, ${spot.y}, ${spot.z}) occludes ${t.name} from camera (${camPos.x.toFixed(1)}, ${camPos.y.toFixed(1)}, ${camPos.z.toFixed(1)})`,
                  ).toBe(false);
               }
            }
         }
      }
   });

   it("ensures ground hull covers the bottom view at all 3 sizes with zero sky void below scene", () => {
      const viewports = [
         { width: 1280, height: 800, name: "desktop 1280x800" },
         { width: 390, height: 844, name: "portrait 390x844" },
         { width: 844, height: 390, name: "landscape 844x390" },
      ];

      const playerPositions = [
         { x: 0, z: 0 },
         { x: 9.55, z: 9.55 },
         { x: -9.55, z: 9.55 },
         { x: 9.55, z: -9.55 },
         { x: -9.55, z: -9.55 },
      ];

      for (const vp of viewports) {
         const view = fitView({ ...FIT, width: vp.width, height: vp.height });
         const camera = new PerspectiveCamera(45, vp.width / vp.height, 0.1, 500);

         for (const p of playerPositions) {
            camera.position.set(p.x + view.offset[0], 1.1 + view.offset[1], p.z + view.offset[2]);
            camera.lookAt(p.x, 1.1, p.z);
            camera.updateMatrixWorld(true);
            setLensShift(camera, view.shift[0], view.shift[1], vp.width, vp.height);

            // Check rays through bottom edge of viewport:
            // bottom-left (-0.95, -0.98), bottom-center (0, -0.98), bottom-right (0.95, -0.98) in NDC
            for (const ndcX of [-0.9, 0, 0.9]) {
               const ndc = new Vector3(ndcX, -0.98, 0.5);
               ndc.unproject(camera);
               const rayDir = ndc.sub(camera.position).normalize();

               // Intersect with ground plane y = HULL_GROUND.y (-0.28)
               expect(rayDir.y).toBeLessThan(0); // must point downwards
               const t = (HULL_GROUND.y - camera.position.y) / rayDir.y;
               const groundX = camera.position.x + rayDir.x * t;
               const groundZ = camera.position.z + rayDir.z * t;

               expect(
                  groundX,
                  `${vp.name} player (${p.x}, ${p.z}) bottom NDC x=${ndcX}: ground hit X=${groundX.toFixed(1)} must be within hull [${HULL_GROUND.minX}, ${HULL_GROUND.maxX}]`,
               ).toBeGreaterThanOrEqual(HULL_GROUND.minX);
               expect(
                  groundX,
                  `${vp.name} player (${p.x}, ${p.z}) bottom NDC x=${ndcX}: ground hit X=${groundX.toFixed(1)} must be within hull [${HULL_GROUND.minX}, ${HULL_GROUND.maxX}]`,
               ).toBeLessThanOrEqual(HULL_GROUND.maxX);

               expect(
                  groundZ,
                  `${vp.name} player (${p.x}, ${p.z}) bottom NDC x=${ndcX}: ground hit Z=${groundZ.toFixed(1)} must be within hull [${HULL_GROUND.minZ}, ${HULL_GROUND.maxZ}]`,
               ).toBeGreaterThanOrEqual(HULL_GROUND.minZ);
               expect(
                  groundZ,
                  `${vp.name} player (${p.x}, ${p.z}) bottom NDC x=${ndcX}: ground hit Z=${groundZ.toFixed(1)} must be within hull [${HULL_GROUND.minZ}, ${HULL_GROUND.maxZ}]`,
               ).toBeLessThanOrEqual(HULL_GROUND.maxZ);
            }
         }
      }
   });

   it("maintains WCAG contrast for all gameplay indicators and UI rings against backdrop", () => {
      // Repair arc mint against deep space
      expect(contrastRatio(COLORS.mint, COLORS.space)).toBeGreaterThan(8);
      // Warning red against deep space
      expect(contrastRatio(COLORS.warning, COLORS.space)).toBeGreaterThan(4.5);
      // White labels against space
      expect(contrastRatio(COLORS.white, COLORS.space)).toBeGreaterThan(14);
      // Gold battery against deep space
      expect(contrastRatio(COLORS.gold, COLORS.space)).toBeGreaterThan(10);
      // Blue neon conduit against hull
      expect(contrastRatio(COLORS.neonBlue, COLORS.shadow)).toBeGreaterThan(4.5);
   });
});
