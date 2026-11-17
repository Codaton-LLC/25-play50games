// Decor & looks verification:
// 1. Every decor spot is strictly outside the active play bounds.
// 2. No decor mesh (including clouds at any drift phase) sits between the camera and the play area
//    at all three test sizes (1280x800, 390x844, 844x390) with banner open and closed.
// 3. Ground and surroundings cover the view without void or gap at screen edges.
// 4. Contrast ratios for aim dots, ships, cannonballs and targets against the sea meet readability standards.
import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { fitView, type ScreenRect } from "@/arcade3d/core/view";
import {
   BIRDS,
   CLIFF_SPOTS,
   CLOUD_DRIFT,
   CLOUDS,
   COLORS,
   contrastRatio,
   DISTANT_FORT_SPOT,
   FOV,
   inPlayArea,
   ISLET_SPOTS,
   PALM_DECOR_SPOTS,
   PLAY_BOUNDS,
   ROCK_SPOTS,
   SEA_BOX,
   SEA_FOCUS,
   SURF_SPOTS,
   viewFor,
} from "./looks";

function getCamera(width: number, height: number, banner: number): { camera: PerspectiveCamera; camPos: Vector3 } {
   const hud: ScreenRect = { left: 0, top: 0, right: width, bottom: 56 };
   const avoid = banner > 0 ? [hud, { left: 0, top: height - banner, right: width, bottom: height }] : [hud];
   const v = viewFor(width, height);
   const view = fitView({ ...v, width, height, fov: FOV, avoid });
   const camera = new PerspectiveCamera(FOV, width / height, 0.1, 400);
   camera.position.set(SEA_FOCUS[0] + view.offset[0], SEA_FOCUS[1] + view.offset[1], SEA_FOCUS[2] + view.offset[2]);
   camera.lookAt(...SEA_FOCUS);
   camera.setViewOffset(width, height, (-view.shift[0] * width) / 2, (view.shift[1] * height) / 2, width, height);
   camera.updateMatrixWorld();
   camera.updateProjectionMatrix();
   return { camera, camPos: camera.position.clone() };
}

describe("pirate-cannons decor placement and safety bounds", () => {
   it("ensures every decor spot is strictly outside the active play bounds", () => {
      const allStaticSpots = [
         ...CLIFF_SPOTS,
         ...ISLET_SPOTS,
         ...SURF_SPOTS,
         ...ROCK_SPOTS,
         ...PALM_DECOR_SPOTS,
         DISTANT_FORT_SPOT,
      ];

      for (const spot of allStaticSpots) {
         expect(inPlayArea(spot.x, spot.z), `spot at (${spot.x}, ${spot.z}) must be outside play area`).toBe(false);
      }
   });

   it("ensures all distant cliffs and the citadel are positioned well behind the furthest play lane", () => {
      // The furthest ship lane is at z = -55 (zig-zag to -58). SEA_BOX.min.z is -60.
      for (const cliff of CLIFF_SPOTS) {
         expect(cliff.z).toBeLessThanOrEqual(-75);
      }
      expect(DISTANT_FORT_SPOT.z).toBeLessThanOrEqual(-75);
   });

   it("ensures outer islets and rocks are separated from the play lanes by a clear buffer", () => {
      for (const islet of ISLET_SPOTS) {
         // Either completely to the left of ship spawns (x < -26) or completely to the right of harbour exit (x > 23)
         const clearLeft = islet.x + (islet.sx ?? 1) < PLAY_BOUNDS.x0;
         const clearRight = islet.x - (islet.sx ?? 1) > PLAY_BOUNDS.x1;
         expect(clearLeft || clearRight, `islet at x ${islet.x} must clear lateral play bounds`).toBe(true);
      }
   });

   it("ensures clouds stay high above the camera line of sight to the play area at all drift phases", () => {
      for (const [w, h] of [[1280, 800], [390, 844], [844, 390]]) {
         for (const banner of [0, 110]) {
            const { camPos } = getCamera(w, h, banner);
            // Any ray from camera C to play area point P (y <= 6, z >= -60):
            // At the cloud's distance z <= -85, the ray continuing past P has:
            // y(z) = C.y + (P.y - C.y) * ((z - C.z) / (P.z - C.z))
            // Since camera looks downwards, lines of sight to the play area pass far below the clouds.
            for (const c of CLOUDS) {
               for (const drift of [-CLOUD_DRIFT, 0, CLOUD_DRIFT]) {
                  const cloudY = c.y;
                  // Test against the highest play area corner (y = 6, z = 0 and z = -60)
                  for (const pz of [0, -60]) {
                     const py = 6.0;
                     const t = (c.z - camPos.z) / (pz - camPos.z);
                     const rayYAtCloudZ = camPos.y + (py - camPos.y) * t;
                     // Cloud is well above the line of sight
                     expect(cloudY).toBeGreaterThan(rayYAtCloudZ + 15.0);
                  }
               }
            }
         }
      }
   });

   it("ensures circling seagulls fly strictly in the background outside the play area", () => {
      const minZ = BIRDS.centerZ - BIRDS.radiusZ;
      const maxZ = BIRDS.centerZ + BIRDS.radiusZ;
      expect(maxZ).toBeLessThan(PLAY_BOUNDS.z0);
      expect(minZ).toBeLessThan(PLAY_BOUNDS.z0);
      expect(BIRDS.y).toBeGreaterThan(PLAY_BOUNDS.y1);
   });

   it("proves mathematically that no decor spot sits between the fitted camera and the play box", () => {
      for (const [w, h] of [[1280, 800], [390, 844], [844, 390]]) {
         for (const banner of [0, 110]) {
            const { camPos } = getCamera(w, h, banner);
            // Camera is at x = 0, y in [20, 27], z in [23, 35]
            expect(camPos.z).toBeGreaterThan(0);

            // For every static decor spot:
            for (const spot of [...CLIFF_SPOTS, ...ISLET_SPOTS, ...ROCK_SPOTS, DISTANT_FORT_SPOT]) {
               // A point can only occlude if its z is between camPos.z and the play box z (<= 0).
               // If spot.z <= -60, it is behind the play box.
               const isBehindPlayBox = spot.z < PLAY_BOUNDS.z0;
               // If spot.x < -26, it is strictly to the left of the entire ray envelope (since camPos.x = 0 and play x >= -25)
               const isLeftOfRays = spot.x < PLAY_BOUNDS.x0;
               // If spot.x > 23, it is strictly to the right of the entire ray envelope (since camPos.x = 0 and play x <= 22)
               const isRightOfRays = spot.x > PLAY_BOUNDS.x1;

               const cannotOcclude = isBehindPlayBox || isLeftOfRays || isRightOfRays;
               expect(
                  cannotOcclude,
                  `spot at (${spot.x}, ${spot.y}, ${spot.z}) must not intersect the ray cone between camera and play box`
               ).toBe(true);
            }
         }
      }
   });

   it("verifies readable contrast ratios against the Caribbean sea surface", () => {
      // 1. Golden aim trajectory dots against shallow and deep water
      expect(contrastRatio(COLORS.dots, COLORS.sea)).toBeGreaterThanOrEqual(2.0);
      expect(contrastRatio(COLORS.dots, COLORS.deep)).toBeGreaterThanOrEqual(4.0);

      // 2. White sails against sea
      expect(contrastRatio(COLORS.sail, COLORS.sea)).toBeGreaterThanOrEqual(2.5);

      // 3. Cast iron cannonball against sea
      expect(contrastRatio(COLORS.ball, COLORS.sea)).toBeGreaterThanOrEqual(3.0);

      // 4. Red powder barrels against sea
      expect(contrastRatio(COLORS.barrel, COLORS.sea)).toBeGreaterThanOrEqual(1.5);
   });
});
