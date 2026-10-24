import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { fitView } from "@/arcade3d/core/view";
import {
   COLORS,
   DECOR,
   FOG,
   FOV,
   VIEW,
   contrastRatio,
   hillHeight,
   hillMesh,
   inPlayArea,
} from "./looks";
import { FARM, PLOTS, SHIP } from "./rules";

describe("alien-farm look and decor bounds", () => {
   it("keeps every decor instance outside the play area", () => {
      expect(DECOR.length).toBeGreaterThan(20);
      for (const spot of DECOR) {
         expect(
            inPlayArea(spot.x, spot.z),
            `spot ${spot.kind} at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) is inside play area`
         ).toBe(false);
      }
   });

   it("keeps all rock spires and the silo out of the camera-to-target line of sight at all three screen sizes", () => {
      const sizes = [
         { name: "desktop", width: 1280, height: 800 },
         { name: "portrait", width: 390, height: 844 },
         { name: "landscape", width: 844, height: 390 },
      ];

      const maxX = FARM.bounds.max.x;
      const maxZ = FARM.bounds.max.z;

      // Sampled farmer positions across bounds
      const farmerSpots = [
         { x: 0, z: 0 },
         { x: -maxX, z: -maxZ },
         { x: maxX, z: -maxZ },
         { x: -maxX, z: maxZ },
         { x: maxX, z: maxZ },
         { x: 0, z: maxZ },
         { x: 0, z: -maxZ },
      ];

      // Targets: all 9 plot centers and sample points along UFO route
      const targets: Array<{ x: number; y: number; z: number }> = [
         ...PLOTS.map((p) => ({ x: p.x, y: 0.5, z: p.z })),
      ];
      for (let s = 0; s < 16; s++) {
         const t = s / 16;
         const seg = Math.floor(t * 4);
         const frac = (t * 4) % 1;
         const p0 = SHIP.waypoints[seg];
         const p1 = SHIP.waypoints[(seg + 1) % 4];
         targets.push({
            x: p0.x + (p1.x - p0.x) * frac,
            y: 3.2,
            z: p0.z + (p1.z - p0.z) * frac,
         });
      }

      for (const s of sizes) {
         const fit = fitView({ ...VIEW, fov: FOV, width: s.width, height: s.height });

         for (const f of farmerSpots) {
            // Camera position following farmer
            const camPos = new Vector3(
               f.x + fit.offset[0],
               fit.offset[1],
               f.z + fit.offset[2]
            );

            // Targets also include the farmer
            const allTargets = [{ x: f.x, y: 0.7, z: f.z }, ...targets];

            for (const target of allTargets) {
               const rayDir = new Vector3(
                  target.x - camPos.x,
                  target.y - camPos.y,
                  target.z - camPos.z
               );
               const rayLen = rayDir.length();
               rayDir.normalize();

               // Test each decor spot against the segment (camPos -> target)
               for (const spot of DECOR) {
                  // Only large meshes (silo, spires) need check
                  if (spot.kind !== "silo" && spot.kind !== "spire") continue;

                  const decorRadius = spot.kind === "silo" ? 1.4 : 0.6 * spot.sx;
                  const decorHeight = spot.kind === "silo" ? 5.0 : 3.5 * spot.sy;

                  // Vector from camPos to decor base
                  const vX = spot.x - camPos.x;
                  const vZ = spot.z - camPos.z;

                  // Project onto ray in XZ
                  const dotXZ = (vX * rayDir.x + vZ * rayDir.z) / (rayDir.x * rayDir.x + rayDir.z * rayDir.z);
                  if (dotXZ > 0 && dotXZ < rayLen) {
                     // Closest point along ray
                     const rayPointY = camPos.y + rayDir.y * dotXZ;
                     if (rayPointY >= 0 && rayPointY <= decorHeight) {
                        const perpDistSq =
                           (vX - rayDir.x * dotXZ) ** 2 + (vZ - rayDir.z * dotXZ) ** 2;
                        expect(
                           perpDistSq,
                           `decor ${spot.kind} at (${spot.x}, ${spot.z}) occludes target (${target.x}, ${target.z}) at ${s.name}`
                        ).toBeGreaterThan(decorRadius * decorRadius);
                     }
                  }
               }
            }
         }
      }
   });

   it("ensures ground soil disc covers the entire screen frustum with no void below the scene", () => {
      const sizes = [
         { name: "desktop", width: 1280, height: 800 },
         { name: "portrait", width: 390, height: 844 },
         { name: "landscape", width: 844, height: 390 },
      ];
      const frustumCorners = [
         [-1, -1], [1, -1], [-1, 1], [1, 1],
         [0, -1], [0, 1], [-1, 0], [1, 0],
      ];
      const maxX = FARM.bounds.max.x;
      const maxZ = FARM.bounds.max.z;
      const farmerCorners = [
         { x: -maxX, z: -maxZ },
         { x: maxX, z: -maxZ },
         { x: -maxX, z: maxZ },
         { x: maxX, z: maxZ },
      ];

      const GROUND_RADIUS = 90;

      for (const s of sizes) {
         const fit = fitView({ ...VIEW, fov: FOV, width: s.width, height: s.height });
         const cam = new PerspectiveCamera(VIEW.fov, s.width / s.height, 0.1, 1000);

         for (const fc of farmerCorners) {
            cam.position.set(fc.x + fit.offset[0], fit.offset[1], fc.z + fit.offset[2]);
            cam.lookAt(new Vector3(fc.x, 0, fc.z));
            cam.updateMatrixWorld();

            for (const [ndcX, ndcY] of frustumCorners) {
               const rayOrigin = cam.position.clone();
               const rayTarget = new Vector3(ndcX, ndcY, 0.5).unproject(cam);
               const rayDir = rayTarget.sub(rayOrigin).normalize();

               // Downward pointing rays (including the bottom of the screen) must intersect ground within GROUND_RADIUS
               if (rayDir.y < 0) {
                  const t = -rayOrigin.y / rayDir.y;
                  const hitDist = Math.hypot(
                     rayOrigin.x + rayDir.x * t,
                     rayOrigin.z + rayDir.z * t
                  );
                  expect(
                     hitDist,
                     `Frustum corner [${ndcX}, ${ndcY}] at ${s.name} exceeds ground radius`
                  ).toBeLessThan(GROUND_RADIUS);
               }
            }
         }
      }
   });

   it("leaves the play area flat and points hill normals upward", () => {
      // Inside play bounds, hill height must be 0
      for (const x of [-10, -5, 0, 5, 10]) {
         for (const z of [-8, -4, 0, 4, 8]) {
            expect(hillHeight(x, z)).toBe(0);
         }
      }
      // Outside play bounds, hills rise
      expect(hillHeight(-20, -20)).toBeGreaterThan(0.5);
      expect(hillHeight(20, -20)).toBeGreaterThan(0.5);
      expect(hillHeight(0, -25)).toBeGreaterThan(0.5);

      const hills = hillMesh();
      expect(hills.triangles).toBeGreaterThan(100);
      expect(hills.triangles).toBeLessThan(5000);

      // Verify normals point upward
      const pos = hills.positions;
      for (let i = 0; i < pos.length; i += 9) {
         const ax = pos[i + 3] - pos[i];
         const az = pos[i + 5] - pos[i + 2];
         const bx = pos[i + 6] - pos[i];
         const bz = pos[i + 8] - pos[i + 2];
         const ny = az * bx - ax * bz;
         expect(ny).toBeGreaterThanOrEqual(0);
      }
   });

   it("verifies strong contrast between key game elements and the purple soil", () => {
      // Contrast of mint crops against dark soil
      expect(contrastRatio(COLORS.mint, COLORS.soil)).toBeGreaterThanOrEqual(4.5);
      // Contrast of cyan crops against dark soil
      expect(contrastRatio(COLORS.cyan, COLORS.soil)).toBeGreaterThanOrEqual(4.5);
      // Contrast of gold perfect timing ring against dark soil
      expect(contrastRatio(COLORS.gold, COLORS.soil)).toBeGreaterThanOrEqual(7.0);
      // Contrast of coral burst cue against dark soil
      expect(contrastRatio(COLORS.coral, COLORS.soil)).toBeGreaterThanOrEqual(3.5);
      // Contrast of alien skin against dark soil
      expect(contrastRatio(COLORS.alien, COLORS.soil)).toBeGreaterThanOrEqual(4.5);
   });

   it("places fog past the camera follow distance", () => {
      expect(FOG.near).toBeGreaterThan(25);
      expect(FOG.far).toBeGreaterThan(FOG.near);
   });
});
