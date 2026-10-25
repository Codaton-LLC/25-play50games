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
import { FARM, PLOTS } from "./rules";

describe("alien-farm look and decor bounds", () => {
   it("ensures decor bounds fall inside the camera window", () => {
      expect(DECOR.length).toBeGreaterThan(15);
      const xs = DECOR.map((d) => d.x);
      const zs = DECOR.map((d) => d.z);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minZ = Math.min(...zs);
      const maxZ = Math.max(...zs);

      // Verify decor bounds fall inside the camera-visible area around the beds and paths
      expect(minX).toBeGreaterThanOrEqual(-8.5);
      expect(maxX).toBeLessThanOrEqual(8.5);
      expect(minZ).toBeGreaterThanOrEqual(-7.5);
      expect(maxZ).toBeLessThanOrEqual(7.5);

      // Verify decor instances are visible within the camera window at desktop, portrait, and landscape
      const sizes = [
         { name: "desktop", width: 1280, height: 800 },
         { name: "portrait", width: 390, height: 844 },
         { name: "landscape", width: 844, height: 390 },
      ];
      for (const s of sizes) {
         const fit = fitView({ ...VIEW, fov: FOV, width: s.width, height: s.height });
         const cam = new PerspectiveCamera(VIEW.fov, s.width / s.height, 0.1, 100);
         cam.position.set(fit.offset[0], fit.offset[1], fit.offset[2]);
         cam.lookAt(new Vector3(0, 0, 0));
         cam.updateMatrixWorld();
         cam.updateProjectionMatrix();

         let visibleCount = 0;
         for (const spot of DECOR) {
            const v = new Vector3(spot.x, spot.y, spot.z).project(cam);
            if (Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z > 0 && v.z < 1) {
               visibleCount++;
            }
         }
         expect(visibleCount, `decor visible at ${s.name}`).toBeGreaterThanOrEqual(10);
      }
   });

   it("keeps every decor instance outside the play area", () => {
      expect(DECOR.length).toBeGreaterThan(20);
      for (const spot of DECOR) {
         expect(
            inPlayArea(spot.x, spot.z),
            `spot ${spot.kind} at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) is inside crop beds`
         ).toBe(false);
      }
   });

   it("keeps all rock spires and the silo out of the camera-to-target line of sight at all three screen sizes", () => {
      const sizes = [
         { name: "desktop", width: 1280, height: 800 },
         { name: "portrait", width: 390, height: 844 },
         { name: "landscape", width: 844, height: 390 },
      ];

      // Sampled farmer positions across beds and paths
      const farmerSpots = [
         { x: 0, z: 0 },
         { x: 0, z: 6 },
         ...PLOTS.map((p) => ({ x: p.x, z: p.z })),
      ];

      // Targets: all 9 plot centers
      const targets: Array<{ x: number; y: number; z: number }> = [
         ...PLOTS.map((p) => ({ x: p.x, y: 0.5, z: p.z })),
      ];

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
      // Outside play bounds, hills rise to the north and distant flanks
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
      // Contrast of mint crops against dark plum soil
      expect(contrastRatio(COLORS.mint, COLORS.soil)).toBeGreaterThanOrEqual(4.5);
      // Contrast of cyan crops against dark plum soil
      expect(contrastRatio(COLORS.cyan, COLORS.soil)).toBeGreaterThanOrEqual(4.5);
      // Contrast of gold perfect timing ring against dark plum soil
      expect(contrastRatio(COLORS.gold, COLORS.soil)).toBeGreaterThanOrEqual(7.0);
      // Contrast of coral burst cue against dark plum soil
      expect(contrastRatio(COLORS.coral, COLORS.soil)).toBeGreaterThanOrEqual(3.5);
      // Contrast of alien skin against dark plum soil
      expect(contrastRatio(COLORS.alien, COLORS.soil)).toBeGreaterThanOrEqual(4.5);
      // Contrast of mint crops against dark teal furrow ridges
      expect(contrastRatio(COLORS.mint, COLORS.furrowRidge)).toBeGreaterThanOrEqual(4.5);
   });

   it("ensures both moons project inside the camera frustum at all three screen sizes", () => {
      const sizes = [
         { name: "desktop", width: 1280, height: 800 },
         { name: "portrait", width: 390, height: 844 },
         { name: "landscape", width: 844, height: 390 },
      ];
      // Moons in camera local coordinates: primary at [-2.2, 5.5, -20], minor at [2.4, 6.2, -20]
      const moons = [
         { name: "primary", pos: new Vector3(-2.2, 5.5, -20) },
         { name: "minor", pos: new Vector3(2.4, 6.2, -20) },
      ];
      for (const s of sizes) {
         const cam = new PerspectiveCamera(VIEW.fov, s.width / s.height, 0.1, 100);
         for (const m of moons) {
            const v = m.pos.clone().project(cam);
            expect(Math.abs(v.x), `${m.name} moon x at ${s.name}`).toBeLessThan(1.0);
            expect(Math.abs(v.y), `${m.name} moon y at ${s.name}`).toBeLessThan(1.0);
            expect(v.y, `${m.name} moon y at ${s.name} in sky`).toBeGreaterThan(0.3);
         }
      }
   });

   it("places fog past the camera follow distance", () => {
      expect(FOG.near).toBeGreaterThan(25);
      expect(FOG.far).toBeGreaterThan(FOG.near);
   });
});
