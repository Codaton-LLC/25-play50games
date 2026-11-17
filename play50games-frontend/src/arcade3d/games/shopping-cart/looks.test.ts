import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { fitView, setLensShift } from "@/arcade3d/core/view";
import { FOV, STORE_BOUNDS, viewFor } from "./camera";
import {
   COLORS,
   DECOR,
   FLOOR,
   GROUND_BOUNDS,
   PLAY_BOUNDS,
   contrastRatio,
   decorAABB,
   decorOf,
   inPlayArea,
   segmentIntersectsAABB,
} from "./looks";

describe("shopping-cart looks & modern visual pass", () => {
   it("all decor spots sit strictly outside the play bounds", () => {
      expect(DECOR.length).toBeGreaterThan(15);
      for (const spot of DECOR) {
         // Spot centre must not be in play area
         expect(inPlayArea(spot.x, spot.z)).toBe(false);

         // Decor bounding box must not enter play bounds
         const box = decorAABB(spot);
         const insideX = box.max.x >= PLAY_BOUNDS.x0 && box.min.x <= PLAY_BOUNDS.x1;
         const insideZ = box.max.z >= PLAY_BOUNDS.z0 && box.min.z <= PLAY_BOUNDS.z1;
         // If overlapping X and Z, it must be either outside height or outside bounds
         expect(insideX && insideZ).toBe(false);
      }
   });

   it("has decor instances across all planned categories", () => {
      expect(decorOf("wall_shelving").length).toBeGreaterThanOrEqual(10);
      expect(decorOf("entrance_door").length).toBeGreaterThanOrEqual(4);
      expect(decorOf("promo_sign").length).toBeGreaterThanOrEqual(6);
      expect(decorOf("cart_corral").length).toBeGreaterThanOrEqual(2);
      expect(decorOf("checkout_decor").length).toBeGreaterThanOrEqual(2);
      expect(decorOf("ceiling_light").length).toBeGreaterThanOrEqual(6);
      expect(decorOf("parked_car").length).toBeGreaterThanOrEqual(6);
   });

   it("no decor spot occludes play targets from the fitted camera at 1280x800, 390x844, and 844x390", () => {
      const viewports = [
         { name: "desktop", w: 1280, h: 800 },
         { name: "portrait phone", w: 390, h: 844 },
         { name: "landscape phone", w: 844, h: 390 },
      ];

      // Sample follow positions across STORE_BOUNDS
      const followPoints = [
         { x: STORE_BOUNDS.min.x, z: STORE_BOUNDS.min.z },
         { x: STORE_BOUNDS.max.x, z: STORE_BOUNDS.min.z },
         { x: STORE_BOUNDS.min.x, z: STORE_BOUNDS.max.z },
         { x: STORE_BOUNDS.max.x, z: STORE_BOUNDS.max.z },
         { x: 0, z: 0 },
         { x: -9, z: 4.8 }, // near pyramid / shelf corner
         { x: 6, z: -7.8 },
         { x: 0, z: 9 },    // near checkouts
      ];

      // Sample target points in play area (cart, runner, shoppers, shelf items)
      const targetPoints = [
         { x: -14, y: 0.5, z: -10 },
         { x: 14, y: 0.5, z: 10 },
         { x: 0, y: 0.5, z: 0 },
         { x: -9, y: 0.8, z: -1.5 },
         { x: 6, y: 0.8, z: 2.0 },
         { x: 0, y: 0.1, z: 10.5 },
         { x: -12, y: 1.5, z: 6 },
         { x: 13, y: 1.0, z: 0 },
      ];

      const decorBoxes = DECOR.map(decorAABB);

      for (const vp of viewports) {
         const fitted = fitView({ ...viewFor(vp.w, vp.h), width: vp.w, height: vp.h, fov: FOV });
         const [ox, oy, oz] = fitted.offset;

         for (const fp of followPoints) {
            const camPos = { x: fp.x + ox, y: oy, z: fp.z + oz };

            for (const tp of targetPoints) {
               // Only test targets within reasonable sight distance of follow point
               const dist = Math.hypot(tp.x - fp.x, tp.z - fp.z);
               if (dist > 18) continue;

               for (let i = 0; i < DECOR.length; i++) {
                  const box = decorBoxes[i];
                  const hit = segmentIntersectsAABB(camPos, tp, box);
                  if (hit) {
                     throw new Error(
                        `Occlusion in ${vp.name} from cam (${camPos.x.toFixed(1)}, ${camPos.y.toFixed(1)}, ${camPos.z.toFixed(1)}) to target (${tp.x}, ${tp.y}, ${tp.z}) by ${DECOR[i].kind} at (${DECOR[i].x}, ${DECOR[i].y}, ${DECOR[i].z})`
                     );
                  }
                  expect(hit).toBe(false);
               }
            }
         }
      }
   });

   it("concourse floor covers the entire camera viewport without voids", () => {
      // Concourse floor extends 120 x 120 m around center
      expect(FLOOR.concourseWidth).toBeGreaterThanOrEqual(100);
      expect(FLOOR.concourseDepth).toBeGreaterThanOrEqual(100);
      expect(FLOOR.concourseY).toBeLessThan(0); // sits below store floor to avoid z-fighting
   });

   it("palette provides strong WCAG contrast for gameplay clarity", () => {
      // Floor is bright porcelain
      const floor = COLORS.floorTile;

      // Cart elements contrast against floor
      expect(contrastRatio(floor, COLORS.cartHandle)).toBeGreaterThan(4.5);
      expect(contrastRatio(floor, COLORS.cartWheel)).toBeGreaterThan(7.0);

      // Shoppers stand out on floor
      expect(contrastRatio(floor, COLORS.shopperDark)).toBeGreaterThan(7.0);

      // Finish zone line contrast against dark concourse / store background
      expect(contrastRatio(COLORS.finishGreen, COLORS.concourseFloor)).toBeGreaterThan(6.0);

      // Glowing halo and beacons
      expect(COLORS.halo).toBe("#fb923c");
      expect(COLORS.badge).toBe("#f97316");
   });

   it("bottom and side screen-corner rays of the fitted camera hit the ground at all three sizes and nothing lies between camera and play targets", () => {
      const SIZES = [
         { name: "desk 1280x800", w: 1280, h: 800 },
         { name: "phone portrait 390x844", w: 390, h: 844 },
         { name: "phone landscape 844x390", w: 844, h: 390 },
      ] as const;

      const FOLLOW_TARGETS = [
         { name: "center (0, 0)", x: 0, z: 0 },
         { name: "NW corner (-14, -10)", x: STORE_BOUNDS.min.x, z: STORE_BOUNDS.min.z },
         { name: "NE corner (14, -10)", x: STORE_BOUNDS.max.x, z: STORE_BOUNDS.min.z },
         { name: "SW corner (-14, 10)", x: STORE_BOUNDS.min.x, z: STORE_BOUNDS.max.z },
         { name: "SE corner (14, 10)", x: STORE_BOUNDS.max.x, z: STORE_BOUNDS.max.z },
      ] as const;

      // Screen-corner and edge rays in NDC: bottom corners, bottom center, and side edges
      const SCREEN_RAYS = [
         { name: "bottom-left corner", x: -1.0, y: -1.0 },
         { name: "bottom-right corner", x: 1.0, y: -1.0 },
         { name: "bottom-center", x: 0.0, y: -1.0 },
         { name: "middle-left edge", x: -1.0, y: 0.0 },
         { name: "middle-right edge", x: 1.0, y: 0.0 },
         { name: "top-left corner", x: -1.0, y: 1.0 },
         { name: "top-right corner", x: 1.0, y: 1.0 },
      ] as const;

      const cam = new PerspectiveCamera();

      for (const { w, h, name: sizeName } of SIZES) {
         const opts = viewFor(w, h);
         const fitted = fitView({ ...opts, fov: opts.fov ?? FOV, width: w, height: h });
         cam.fov = opts.fov ?? FOV;
         cam.aspect = w / h;
         cam.near = 0.1;
         cam.far = 400;

         if (fitted.shift && (fitted.shift[0] !== 0 || fitted.shift[1] !== 0)) {
            setLensShift(cam, fitted.shift[0], fitted.shift[1], w, h);
         } else {
            cam.clearViewOffset();
         }

         for (const target of FOLLOW_TARGETS) {
            cam.position.set(target.x + fitted.offset[0], fitted.offset[1], target.z + fitted.offset[2]);
            cam.lookAt(target.x, 0, target.z);
            cam.updateMatrixWorld();
            cam.updateProjectionMatrix();

            for (const ray of SCREEN_RAYS) {
               const rayOrigin = cam.position.clone();
               const rayDir = new Vector3(ray.x, ray.y, 0.5).unproject(cam).sub(rayOrigin).normalize();

               // Ray must point downwards towards ground plane
               expect(rayDir.y, `${sizeName} ${ray.name} rayDir.y`).toBeLessThan(0);

               // Intersection with ground plane y = 0
               const t = -rayOrigin.y / rayDir.y;
               const hitX = rayOrigin.x + t * rayDir.x;
               const hitZ = rayOrigin.z + t * rayDir.z;

               expect(
                  hitX,
                  `${sizeName} ${target.name} ${ray.name} hitX ${hitX.toFixed(1)} outside [${GROUND_BOUNDS.x0}, ${GROUND_BOUNDS.x1}]`
               ).toBeGreaterThanOrEqual(GROUND_BOUNDS.x0);
               expect(
                  hitX,
                  `${sizeName} ${target.name} ${ray.name} hitX ${hitX.toFixed(1)} outside [${GROUND_BOUNDS.x0}, ${GROUND_BOUNDS.x1}]`
               ).toBeLessThanOrEqual(GROUND_BOUNDS.x1);
               expect(
                  hitZ,
                  `${sizeName} ${target.name} ${ray.name} hitZ ${hitZ.toFixed(1)} outside [${GROUND_BOUNDS.z0}, ${GROUND_BOUNDS.z1}]`
               ).toBeGreaterThanOrEqual(GROUND_BOUNDS.z0);
               expect(
                  hitZ,
                  `${sizeName} ${target.name} ${ray.name} hitZ ${hitZ.toFixed(1)} outside [${GROUND_BOUNDS.z0}, ${GROUND_BOUNDS.z1}]`
               ).toBeLessThanOrEqual(GROUND_BOUNDS.z1);
            }
         }
      }

      // Verify all decor stands directly on the ground (no floating decor in void)
      for (const spot of DECOR) {
         const groundClearance = Math.abs(spot.y - spot.sy / 2);
         expect(
            groundClearance,
            `${spot.kind} at (${spot.x.toFixed(1)}, ${spot.z.toFixed(1)}) clearance ${groundClearance.toFixed(2)} must be 0`
         ).toBeLessThan(1e-4);
      }

      // Verify that no decor item lies between the camera and the play bounds (cart/shoppers/items)
      const playTargets = [
         { x: -14, y: 0.5, z: -10 },
         { x: 14, y: 0.5, z: -10 },
         { x: -14, y: 0.5, z: 10 },
         { x: 14, y: 0.5, z: 10 },
         { x: 0, y: 0.5, z: 0 },
         { x: -9, y: 0.8, z: -1.5 },
         { x: 6, y: 0.8, z: 2.0 },
         { x: 0, y: 0.1, z: 10.5 },
      ];
      const decorBoxes = DECOR.map(decorAABB);

      for (const { w, h } of SIZES) {
         const opts = viewFor(w, h);
         const fitted = fitView({ ...opts, fov: opts.fov ?? FOV, width: w, height: h });
         const [ox, oy, oz] = fitted.offset;

         for (const fp of FOLLOW_TARGETS) {
            const camPos = { x: fp.x + ox, y: oy, z: fp.z + oz };
            for (const tp of playTargets) {
               for (let i = 0; i < DECOR.length; i++) {
                  const box = decorBoxes[i];
                  const hit = segmentIntersectsAABB(camPos, tp, box);
                  expect(
                     hit,
                     `Decor ${DECOR[i].kind} at (${DECOR[i].x}, ${DECOR[i].z}) lies between camera and play target (${tp.x}, ${tp.y}, ${tp.z})`
                  ).toBe(false);
               }
            }
         }
      }
   });
});
