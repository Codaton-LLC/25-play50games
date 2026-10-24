import { describe, expect, it } from "vitest";
import { ROOF_CAP, ROOFTOP_OVERLAY_Y } from "./visuals";
import {
   COLORS,
   GROUND_PLANE,
   OUTER_BUILDING_SPOTS,
   OUTER_CLOUDS,
   OUTER_TREE_SPOTS,
   PLAY_BOUNDS,
   RIVER,
   isOutsidePlayArea,
} from "./looks";
import { viewFor } from "./camera";
import { fitView } from "@/arcade3d/core/view";
import { CITY } from "./rules";

describe("rooftop overlays", () => {
   it("keeps every pad above the roof cap top with visible clearance", () => {
      expect(ROOFTOP_OVERLAY_Y - (ROOF_CAP.centerY + ROOF_CAP.thickness / 2)).toBeGreaterThanOrEqual(0.02);
   });
});

describe("decor outside play area bounds", () => {
   it("ensures all outer building spots are strictly outside the 60m x 60m play bounds", () => {
      for (const b of OUTER_BUILDING_SPOTS) {
         const halfW = b.w / 2;
         const halfD = b.d / 2;
         const minX = b.x - halfW;
         const maxX = b.x + halfW;
         const minZ = b.z - halfD;
         const maxZ = b.z + halfD;

         // Check that the building bounding box does not overlap PLAY_BOUNDS
         const overlapsX = maxX >= PLAY_BOUNDS.min.x && minX <= PLAY_BOUNDS.max.x;
         const overlapsZ = maxZ >= PLAY_BOUNDS.min.z && minZ <= PLAY_BOUNDS.max.z;
         const overlaps = overlapsX && overlapsZ;

         expect(overlaps).toBe(false);
         expect(isOutsidePlayArea(b.x, b.z, 0.5)).toBe(true);
      }
   });

   it("ensures all outer tree spots are strictly outside the play bounds", () => {
      for (const t of OUTER_TREE_SPOTS) {
         expect(isOutsidePlayArea(t.x, t.z, 0.5)).toBe(true);
         const insideX = t.x >= PLAY_BOUNDS.min.x && t.x <= PLAY_BOUNDS.max.x;
         const insideZ = t.z >= PLAY_BOUNDS.min.z && t.z <= PLAY_BOUNDS.max.z;
         expect(insideX && insideZ).toBe(false);
      }
   });

   it("ensures the river is strictly outside the play area", () => {
      expect(RIVER.maxX).toBeLessThan(PLAY_BOUNDS.min.x);
      expect(isOutsidePlayArea(RIVER.x, RIVER.z, 2.0)).toBe(true);
   });

   it("ensures distant clouds never enter the play bounds at any drift phase", () => {
      // Test 36 phases across a full 2*PI cycle for each cloud
      for (const c of OUTER_CLOUDS) {
         for (let step = 0; step < 36; step++) {
            const angle = (step / 36) * Math.PI * 2;
            const driftedX = c.x + Math.sin(angle) * c.drift;
            const halfW = c.sx / 2;
            const halfD = c.sz / 2;

            const minX = driftedX - halfW;
            const maxX = driftedX + halfW;
            const minZ = c.z - halfD;
            const maxZ = c.z + halfD;

            const overlapsX = maxX >= PLAY_BOUNDS.min.x && minX <= PLAY_BOUNDS.max.x;
            const overlapsZ = maxZ >= PLAY_BOUNDS.min.z && minZ <= PLAY_BOUNDS.max.z;
            const overlaps = overlapsX && overlapsZ;

            expect(overlaps).toBe(false);
         }
      }
   });
});

describe("fitted camera visibility & occlusion safety", () => {
   const SIZES = [
      { name: "desktop 1280x800", w: 1280, h: 800, coarse: false },
      { name: "phone portrait 390x844", w: 390, h: 844, coarse: true },
      { name: "phone landscape 844x390", w: 844, h: 390, coarse: true },
   ];

   const TEST_TARGETS = [
      { name: "depot", x: 0, y: 0.1, z: 0 },
      { name: "center air", x: 0, y: 3, z: 0 },
      { name: "ceiling air", x: 0, y: 11, z: 0 },
      { name: "north-west roof", x: -26.25, y: 8, z: -26.25 },
      { name: "north-east roof", x: 26.25, y: 8, z: -26.25 },
      { name: "south-west boundary", x: -29.5, y: 3, z: 29.5 },
      { name: "south-east boundary", x: 29.5, y: 3, z: 29.5 },
   ];

   it("guarantees the 280m ground plane covers the screen at all three viewport sizes", () => {
      for (const s of SIZES) {
         const fitOpts = viewFor(s.w, s.h, s.coarse);
         const fitted = fitView({ ...fitOpts, width: s.w, height: s.h, fov: fitOpts.fov ?? 45 });

         // Camera distance and pitch (60 deg from horizontal)
         const pitch = fitOpts.pitch;
         const camDist = fitted.distance;
         const camY = camDist * Math.sin(pitch);
         const camZ = camDist * Math.cos(pitch);

         // Camera position when following the center
         expect(camDist).toBeGreaterThan(10);
         expect(camDist).toBeLessThan(50);

         // Half fov
         const halfFov = ((fitOpts.fov ?? 45) * Math.PI) / 360;
         const bottomRayAngle = pitch + halfFov; // steeper angle to ground
         const topRayAngle = pitch - halfFov; // flatter angle to ground

         // Intersections with y = 0 along z
         const bottomGroundZ = camZ - camY / Math.tan(bottomRayAngle);
         const topGroundZ = camZ - camY / Math.tan(topRayAngle);

         // Check ground coverage spans well within the 280m ground plane ([-140, 140])
         expect(bottomGroundZ).toBeGreaterThan(GROUND_PLANE.minZ);
         expect(bottomGroundZ).toBeLessThan(GROUND_PLANE.maxZ);
         expect(topGroundZ).toBeGreaterThan(GROUND_PLANE.minZ);
         expect(topGroundZ).toBeLessThan(GROUND_PLANE.maxZ);
      }
   });

   it("verifies that no decor mesh occludes line-of-sight from camera to gameplay targets at any size", () => {
      // Helper: check if a 3D ray segment from A to B intersects an AABB
      function segmentIntersectsAabb(
         ax: number,
         ay: number,
         az: number,
         bx: number,
         by: number,
         bz: number,
         minX: number,
         maxX: number,
         minY: number,
         maxY: number,
         minZ: number,
         maxZ: number
      ): boolean {
         const dx = bx - ax;
         const dy = by - ay;
         const dz = bz - az;

         let tmin = 0;
         let tmax = 1;

         for (const [p, d, min, max] of [
            [ax, dx, minX, maxX],
            [ay, dy, minY, maxY],
            [az, dz, minZ, maxZ],
         ] as const) {
            if (Math.abs(d) < 1e-8) {
               if (p < min || p > max) return false;
            } else {
               let t1 = (min - p) / d;
               let t2 = (max - p) / d;
               if (t1 > t2) {
                  const tmp = t1;
                  t1 = t2;
                  t2 = tmp;
               }
               tmin = Math.max(tmin, t1);
               tmax = Math.min(tmax, t2);
               if (tmin > tmax) return false;
            }
         }
         return true;
      }

      for (const s of SIZES) {
         const fitOpts = viewFor(s.w, s.h, s.coarse);
         const fitted = fitView({ ...fitOpts, width: s.w, height: s.h, fov: fitOpts.fov ?? 45 });

         for (const target of TEST_TARGETS) {
            // Camera position when following target
            const camX = target.x + (fitted.offset[0] ?? 0);
            const camY = target.y + fitted.offset[1];
            const camZ = target.z + fitted.offset[2];

            // 1. Check all outer buildings
            for (const b of OUTER_BUILDING_SPOTS) {
               const halfW = b.w / 2;
               const halfD = b.d / 2;
               const hit = segmentIntersectsAabb(
                  camX,
                  camY,
                  camZ,
                  target.x,
                  target.y,
                  target.z,
                  b.x - halfW,
                  b.x + halfW,
                  0,
                  b.h,
                  b.z - halfD,
                  b.z + halfD
               );
               expect(hit, `Building at (${b.x}, ${b.z}) occludes ${target.name} at ${s.name}`).toBe(false);
            }

            // 2. Check all outer trees
            for (const t of OUTER_TREE_SPOTS) {
               const halfW = t.w / 2;
               const hit = segmentIntersectsAabb(
                  camX,
                  camY,
                  camZ,
                  target.x,
                  target.y,
                  target.z,
                  t.x - halfW,
                  t.x + halfW,
                  0,
                  t.h,
                  t.z - halfW,
                  t.z + halfW
               );
               expect(hit, `Tree at (${t.x}, ${t.z}) occludes ${target.name} at ${s.name}`).toBe(false);
            }

            // 3. Check all clouds across drift phases
            for (const c of OUTER_CLOUDS) {
               for (let step = 0; step < 8; step++) {
                  const angle = (step / 8) * Math.PI * 2;
                  const driftedX = c.x + Math.sin(angle) * c.drift;
                  const halfW = c.sx / 2;
                  const halfH = c.sy / 2;
                  const halfD = c.sz / 2;

                  const hit = segmentIntersectsAabb(
                     camX,
                     camY,
                     camZ,
                     target.x,
                     target.y,
                     target.z,
                     driftedX - halfW,
                     driftedX + halfW,
                     c.y - halfH,
                     c.y + halfH,
                     c.z - halfD,
                     c.z + halfD
                  );
                  expect(hit, `Cloud at (${c.x}, ${c.z}) occludes ${target.name} at ${s.name}`).toBe(false);
               }
            }
         }
      }
   });
});
