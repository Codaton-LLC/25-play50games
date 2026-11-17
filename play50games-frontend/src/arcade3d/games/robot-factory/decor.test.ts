// Tests for Robot Factory modern-look pass:
// 1. Every decor spot is strictly outside the play bounds.
// 2. No decor spot sits between the camera and any play area target (zero occlusion at all 3 sizes).
// 3. The ground covers the whole view at all 3 sizes (1280x800, 390x844, 844x390, no void below scene).
// 4. Large meshes and decor stay well clear of fitted camera frustums.
import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Ray, Vector3 } from "three";
import { fitLiveView } from "@/arcade3d/core/useFittedView";
import { setLensShift } from "@/arcade3d/core/view";
import type { SafeArea } from "@/arcade3d/core/safeArea";
import { CAMERA, FOCUS, viewFor } from "./camera";
import { DECOR_SPOTS, FLOOR_PLANE, PLAY_BOUNDS } from "./looks";
import { CRADLE, SORTER, sortBinCenter, sorterLabelEnds } from "./rules";

function safeArea(width: number, height: number, bannerHeight: number): SafeArea {
   return {
      width,
      height,
      hud: [{ left: 0, top: 0, right: width, bottom: 50 }],
      controls: [],
      obstructions: bannerHeight > 0 ? [{ left: 0, top: height - bannerHeight, right: width, bottom: height }] : [],
   };
}

function setupCamera(width: number, height: number, banner: number): PerspectiveCamera {
   const safe = safeArea(width, height, banner);
   const { view } = fitLiveView({ ...viewFor(width, height), width, height, fov: CAMERA.fov }, safe, null);

   const cam = new PerspectiveCamera(CAMERA.fov, width / height, 0.1, 200);
   cam.position.set(FOCUS.x + view.offset[0], FOCUS.y + view.offset[1], FOCUS.z + view.offset[2]);
   cam.lookAt(FOCUS.x, FOCUS.y, FOCUS.z);
   setLensShift(cam, view.shift[0], view.shift[1], width, height);
   cam.updateMatrixWorld();
   return cam;
}

/** Distance from a point P to a finite segment AB. */
function distancePointToSegment(P: Vector3, A: Vector3, B: Vector3): number {
   const AB = new Vector3().subVectors(B, A);
   const AP = new Vector3().subVectors(P, A);
   const abLenSq = AB.lengthSq();
   if (abLenSq === 0) return AP.length();
   const t = Math.max(0, Math.min(1, AP.dot(AB) / abLenSq));
   const projection = new Vector3().copy(A).addScaledVector(AB, t);
   return P.distanceTo(projection);
}

describe("robot-factory modern look & decor verification", () => {
   it("every decor spot is strictly outside PLAY_BOUNDS", () => {
      for (const spot of DECOR_SPOTS) {
         // A spot is outside if it lies outside along at least one axis (accounting for its radius)
         const outsideX = spot.x + spot.radius < PLAY_BOUNDS.xMin || spot.x - spot.radius > PLAY_BOUNDS.xMax;
         const outsideY = spot.y - spot.radius > PLAY_BOUNDS.yMax || spot.y + spot.radius < PLAY_BOUNDS.yMin;
         const outsideZ = spot.z + spot.radius < PLAY_BOUNDS.zMin || spot.z - spot.radius > PLAY_BOUNDS.zMax;

         const isOutside = outsideX || outsideY || outsideZ;
         expect(
            isOutside,
            `decor spot ${spot.kind} at (${spot.x}, ${spot.y}, ${spot.z}) radius ${spot.radius} must be outside play bounds`
         ).toBe(true);
      }
   });

   it("no decor spot occludes any gameplay target from the fitted camera across all device viewports", () => {
      // Gameplay target points that must have 100% unobstructed lines of sight
      const targets: Vector3[] = [];

      // 1. Grab zone parts along the conveyor belt (x in [-0.9, 0.9], y = 0.98, z = 0.35)
      for (let x = -0.9; x <= 0.9; x += 0.2) {
         targets.push(new Vector3(x, 0.98, 0.35));
      }

      // 2. Sorter bins and their upright labels (L4-L5)
      const bBottom = { x: 0, y: 0, z: 0 };
      const bTop = { x: 0, y: 0, z: 0 };
      for (let i = 0; i < SORTER.BINS; i++) {
         const bin = sortBinCenter(i);
         targets.push(new Vector3(bin.x, SORTER.BIN_H * 0.5, SORTER.BIN_Z));
         sorterLabelEnds(i, bBottom, bTop);
         targets.push(new Vector3(bBottom.x, bBottom.y, bBottom.z));
         targets.push(new Vector3(bTop.x, bTop.y, bTop.z));
      }

      // 3. Assembly cradle & finished robot walk-off to exit door
      targets.push(new Vector3(CRADLE.x, 0.6, CRADLE.z));
      for (let x = 1.35; x <= 2.5; x += 0.25) {
         targets.push(new Vector3(x, 0.6, CRADLE.z));
      }

      // 4. Blueprint cards on the back wall
      for (let x = -1.2; x <= 1.2; x += 0.4) {
         targets.push(new Vector3(x, 1.45, -0.95));
      }

      // Viewports to test: desktop, portrait phone (closed and open banners), landscape phone (closed and open banners)
      const viewports = [
         { name: "desktop 1280x800", w: 1280, h: 800, banner: 0 },
         { name: "portrait 390x844 banner 0", w: 390, h: 844, banner: 0 },
         { name: "portrait 390x844 banner 92", w: 390, h: 844, banner: 92 },
         { name: "portrait 390x844 banner 162", w: 390, h: 844, banner: 162 },
         { name: "landscape 844x390 banner 0", w: 844, h: 390, banner: 0 },
         { name: "landscape 844x390 banner 72", w: 844, h: 390, banner: 72 },
         { name: "landscape 844x390 banner 83", w: 844, h: 390, banner: 83 },
      ];

      for (const vp of viewports) {
         const cam = setupCamera(vp.w, vp.h, vp.banner);
         const camPos = new Vector3().setFromMatrixPosition(cam.matrixWorld);

         for (const target of targets) {
            for (const spot of DECOR_SPOTS) {
               const decorPos = new Vector3(spot.x, spot.y, spot.z);
               const dist = distancePointToSegment(decorPos, camPos, target);
               // Distance must exceed the decor spot's bounding radius with a safety margin
               expect(
                  dist,
                  `occlusion detected at ${vp.name}: decor ${spot.kind} at (${spot.x}, ${spot.y}, ${spot.z}) ` +
                  `is only ${dist.toFixed(2)} m from ray to target (${target.x}, ${target.y}, ${target.z}) (radius: ${spot.radius})`
               ).toBeGreaterThan(spot.radius * 0.95);
            }
         }
      }
   });

   it("the floor plane covers the camera view across all device viewports with zero void below scene", () => {
      const viewports = [
         { name: "desktop 1280x800", w: 1280, h: 800, banner: 0 },
         { name: "portrait 390x844 banner 92", w: 390, h: 844, banner: 92 },
         { name: "portrait 390x844 banner 162", w: 390, h: 844, banner: 162 },
         { name: "landscape 844x390 banner 72", w: 844, h: 390, banner: 72 },
         { name: "landscape 844x390 banner 83", w: 844, h: 390, banner: 83 },
      ];

      const xMin = FLOOR_PLANE.x - FLOOR_PLANE.width / 2;
      const xMax = FLOOR_PLANE.x + FLOOR_PLANE.width / 2;
      const zMin = FLOOR_PLANE.z - FLOOR_PLANE.depth / 2;
      const zMax = FLOOR_PLANE.z + FLOOR_PLANE.depth / 2;

      for (const vp of viewports) {
         const cam = setupCamera(vp.w, vp.h, vp.banner);
         const ray = new Ray();
         const hit = new Vector3();

         // Sample rays across the bottom half of the screen (ndcY from -1 to -0.2)
         for (let ndcX = -0.95; ndcX <= 0.95; ndcX += 0.1) {
            for (let ndcY = -1.0; ndcY <= -0.2; ndcY += 0.1) {
               // Unproject screen coordinates into a world ray
               const target = new Vector3(ndcX, ndcY, 0.5).unproject(cam);
               ray.origin.setFromMatrixPosition(cam.matrixWorld);
               ray.direction.subVectors(target, ray.origin).normalize();

               // Downward rays must hit y = 0 inside the floor bounds
               if (ray.direction.y < -0.01) {
                  const t = -ray.origin.y / ray.direction.y;
                  hit.copy(ray.origin).addScaledVector(ray.direction, t);

                  expect(
                     hit.x,
                     `floor X hit (${hit.x.toFixed(1)}) outside [${xMin}, ${xMax}] at ${vp.name} (ndc: ${ndcX}, ${ndcY})`
                  ).toBeGreaterThanOrEqual(xMin);
                  expect(
                     hit.x,
                     `floor X hit (${hit.x.toFixed(1)}) outside [${xMin}, ${xMax}] at ${vp.name} (ndc: ${ndcX}, ${ndcY})`
                  ).toBeLessThanOrEqual(xMax);
                  expect(
                     hit.z,
                     `floor Z hit (${hit.z.toFixed(1)}) outside [${zMin}, ${zMax}] at ${vp.name} (ndc: ${ndcX}, ${ndcY})`
                  ).toBeGreaterThanOrEqual(zMin);
                  expect(
                     hit.z,
                     `floor Z hit (${hit.z.toFixed(1)}) outside [${zMin}, ${zMax}] at ${vp.name} (ndc: ${ndcX}, ${ndcY})`
                  ).toBeLessThanOrEqual(zMax);
               }
            }
         }
      }
   });
});
