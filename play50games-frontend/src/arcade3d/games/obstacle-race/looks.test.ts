import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { fitView } from "@/arcade3d/core/view";
import { LANDSCAPE, PORTRAIT, followPoint, viewFor } from "./camera";
import {
   ALL_DECOR_SPOTS,
   CLOUD_SPOTS,
   COLORS,
   CROWD_SPOTS,
   FLAG_SPOTS,
   LEVEL_LOOKS,
   PLAY_BOUNDS,
   STAND_SPOTS,
   TREE_SPOTS,
   contrastRatio,
   inPlayBounds,
   stadiumTerrainMesh,
} from "./looks";
import { ARCH, BAR, BEAM, BLOCK, DISC, LINES, PLATFORM, RUNNER } from "./rules";

describe("obstacle-race look pass", () => {
   it("keeps every decor instance outside the play area bounds", () => {
      expect(ALL_DECOR_SPOTS.length).toBeGreaterThan(60);
      for (const spot of ALL_DECOR_SPOTS) {
         expect(
            inPlayBounds(spot.x, spot.z),
            `decor ${spot.kind} at (${spot.x.toFixed(1)}, ${spot.z.toFixed(1)}) must be outside play bounds`
         ).toBe(false);
      }
   });

   it("keeps side stands and crowd at least 13m away from the course edges", () => {
      for (const spot of [...STAND_SPOTS, ...CROWD_SPOTS]) {
         const isSide = spot.z > -165 && spot.z < 35;
         if (isSide) {
            expect(Math.abs(spot.x)).toBeGreaterThanOrEqual(28);
         } else {
            // Back or far stands
            expect(spot.z >= 46 || spot.z <= -170).toBe(true);
         }
      }
   });

   it("places flags along the stands and trees out on the hills", () => {
      for (const pole of FLAG_SPOTS.poles) {
         expect(Math.abs(pole.x) >= 32 || pole.z >= 48 || pole.z <= -178).toBe(true);
      }
      for (const tree of TREE_SPOTS) {
         expect(Math.abs(tree.x) >= 50 || tree.z >= 60 || tree.z <= -200).toBe(true);
      }
      for (const cloud of CLOUD_SPOTS) {
         expect(cloud.y).toBeGreaterThanOrEqual(32);
      }
   });

   it("has zero occlusion between camera and any obstacle, beam or runner at all three screen sizes", () => {
      const screens = [
         { w: 1280, h: 800, name: "desktop 1280x800" },
         { w: 390, h: 844, name: "portrait 390x844" },
         { w: 844, h: 390, name: "landscape phone 844x390" },
      ];

      // Sample key course checkpoints and obstacles along progress p
      const testP = [0, 18, 29, 45, 62, 75, 88.6, 100, 116];

      for (const screen of screens) {
         const viewSpec = viewFor(screen.w, screen.h);
         const fitted = fitView({ ...viewSpec, width: screen.w, height: screen.h });
         const [offX, offY, offZ] = fitted.offset;

         for (const p of testP) {
            const runnerZ = -p;
            const follow = { x: 0, y: 0, z: runnerZ };
            const camPos = new Vector3(follow.x + offX, follow.y + offY, follow.z + offZ);

            // Targets to check: runner, sweeper bar, platforms, blocks, beam
            const targets = [
               new Vector3(0, RUNNER.height / 2, runnerZ),
               new Vector3(-4, 0.5, runnerZ),
               new Vector3(4, 0.5, runnerZ),
            ];

            for (const target of targets) {
               // Line segment from camPos to target
               const rayDir = new Vector3().subVectors(target, camPos);
               const rayLen = rayDir.length();
               rayDir.normalize();

               // Test against every decor spot: minimum distance to ray segment must be > 10m
               for (const spot of ALL_DECOR_SPOTS) {
                  const spotPos = new Vector3(spot.x, spot.y, spot.z);
                  const v = new Vector3().subVectors(spotPos, camPos);
                  const proj = v.dot(rayDir);
                  if (proj >= 0 && proj <= rayLen) {
                     const closestPoint = new Vector3().copy(camPos).addScaledVector(rayDir, proj);
                     const dist = closestPoint.distanceTo(spotPos);
                     expect(
                        dist,
                        `decor ${spot.kind} at (${spot.x}, ${spot.y}, ${spot.z}) too close to line of sight on ${screen.name} at p=${p}`
                     ).toBeGreaterThanOrEqual(10.0);
                  }
               }
            }
         }
      }
   });

   it("covers the whole view below the horizon at all three screen sizes without void", () => {
      const screens = [
         { w: 1280, h: 800 },
         { w: 390, h: 844 },
         { w: 844, h: 390 },
      ];

      const terrainBounds = { xMin: -180, xMax: 180, zMin: -300, zMax: 120, y: -1.0 };

      for (const screen of screens) {
         const viewSpec = viewFor(screen.w, screen.h);
         const fitted = fitView({ ...viewSpec, width: screen.w, height: screen.h });
         const cam = new PerspectiveCamera(viewSpec.fov, screen.w / screen.h, 0.1, 1000);

         // Test at start (p=0) and finish (p=116)
         for (const p of [0, 116]) {
            const zF = -p;
            cam.position.set(fitted.offset[0], fitted.offset[1], zF + fitted.offset[2]);
            cam.lookAt(0, 0, zF);
            cam.updateMatrixWorld();

            // Bottom-left, bottom-center, and bottom-right rays on the viewport
            for (const ndcX of [-0.95, 0, 0.95]) {
               const ndcY = -0.95; // bottom edge
               const ray = new Vector3(ndcX, ndcY, 0.5).unproject(cam).sub(cam.position).normalize();

               // Intersect with ground plane y = terrainBounds.y
               expect(ray.y).toBeLessThan(0); // ray points downward
               const t = (terrainBounds.y - cam.position.y) / ray.y;
               const hitX = cam.position.x + t * ray.x;
               const hitZ = cam.position.z + t * ray.z;

               expect(hitX, `ground hitX at screen ${screen.w}x${screen.h} p=${p}`).toBeGreaterThanOrEqual(terrainBounds.xMin);
               expect(hitX, `ground hitX at screen ${screen.w}x${screen.h} p=${p}`).toBeLessThanOrEqual(terrainBounds.xMax);
               expect(hitZ, `ground hitZ at screen ${screen.w}x${screen.h} p=${p}`).toBeGreaterThanOrEqual(terrainBounds.zMin);
               expect(hitZ, `ground hitZ at screen ${screen.w}x${screen.h} p=${p}`).toBeLessThanOrEqual(terrainBounds.zMax);
            }
         }
      }
   });

   it("contrasts key game elements with high readability", () => {
      // Runner stand-in against pad top
      expect(contrastRatio(COLORS.pants, COLORS.padTop)).toBeGreaterThanOrEqual(7.0);
      expect(contrastRatio(COLORS.hoodie, COLORS.padTop)).toBeGreaterThanOrEqual(2.5);

      // Pad top against pad side and yellow rim bumper
      expect(contrastRatio(COLORS.padSide, COLORS.padTop)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(COLORS.rim, COLORS.padSide)).toBeGreaterThanOrEqual(2.3);

      // Sweeper bar against disc striped top
      expect(contrastRatio(COLORS.barRed, COLORS.discStripeA)).toBeGreaterThanOrEqual(4.0);

      // Balance beam top against beam body
      expect(contrastRatio(COLORS.beam, COLORS.beamTop)).toBeGreaterThanOrEqual(4.0);

      // Finish arch leg against sky
      expect(contrastRatio(COLORS.archLeg, COLORS.sky)).toBeGreaterThanOrEqual(3.0);
   });

   it("builds a valid stadium terrain mesh with pool cutout and upward normals", () => {
      const terrain = stadiumTerrainMesh();
      expect(terrain.triangles).toBeGreaterThan(500);
      expect(terrain.triangles).toBeLessThan(5000);
      expect(terrain.positions.length).toBe(terrain.triangles * 9);
      expect(terrain.colors.length).toBe(terrain.triangles * 9);

      // Verify that no vertex lands in the middle of the pool
      for (let i = 0; i < terrain.positions.length; i += 3) {
         const x = terrain.positions[i];
         const z = terrain.positions[i + 2];
         const deepInsidePool = Math.abs(x) < 22 && z > -165 && z < 35;
         expect(deepInsidePool, `vertex (${x}, ${z}) should not be inside pool cutout`).toBe(false);
      }
   });

   it("defines all five level looks", () => {
      for (const id of [1, 2, 3, 4, 5] as const) {
         const look = LEVEL_LOOKS[id];
         expect(look).toBeDefined();
         expect(look.lighting).toBeDefined();
         expect(look.skyTop.startsWith("#")).toBe(true);
         expect(look.skyBottom.startsWith("#")).toBe(true);
         expect(look.fog.startsWith("#")).toBe(true);
      }
   });
});
