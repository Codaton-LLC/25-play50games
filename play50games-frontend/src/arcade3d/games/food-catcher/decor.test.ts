// Decor and modern look verification for Food Catcher:
// 1. Every decor spot is strictly outside the active play bounds.
// 2. No decor mesh sits between the fitted camera and any point in the play volume
//    at all three test resolutions (1280x800, 390x844, 844x390), banner open and closed.
// 3. Kitchen wall, cabinetry, and floor fully cover the screen at all three sizes without void.
// 4. Contrast ratios for falling food, junk items, and warning tells meet readability standards.
// 5. Level looks and lighting presets cover all 5 levels.
import { describe, expect, it } from "vitest";
import { Box3, PerspectiveCamera, Ray, Vector3 } from "three";
import { fitView, type ScreenRect } from "@/arcade3d/core/view";
import {
   ALL_DECOR_SPOTS,
   COLORS,
   LEVEL_LOOKS,
   OVERHEAD_PAN_SPOTS,
   PENDANT_LAMP_SPOTS,
   PLAY_AREA,
   contrastRatio,
   inPlayArea,
} from "./looks";

const VIEW_CONFIG = {
   area: {
      min: { x: PLAY_AREA.x0, y: PLAY_AREA.y0, z: PLAY_AREA.z0 },
      max: { x: PLAY_AREA.x1, y: PLAY_AREA.y1, z: PLAY_AREA.z1 },
   },
   pitch: 0,
   yaws: [0],
   focus: [{ x: 0, y: 3.25, z: 0 }],
   fov: 40,
   padding: 8,
   shift: true,
};

const TEST_RESOLUTIONS = [
   { name: "desktop 1280x800", width: 1280, height: 800 },
   { name: "portrait 390x844", width: 390, height: 844 },
   { name: "landscape 844x390", width: 844, height: 390 },
];

function getFittedCamera(width: number, height: number, banner = 0): { camera: PerspectiveCamera; camPos: Vector3 } {
   const hud: ScreenRect = { left: 0, top: 0, right: width, bottom: 56 };
   const avoid = banner > 0 ? [hud, { left: 0, top: height - banner, right: width, bottom: height }] : [hud];
   const fitted = fitView({ ...VIEW_CONFIG, width, height, avoid });
   const camera = new PerspectiveCamera(VIEW_CONFIG.fov, width / height, 0.1, 100);
   camera.position.set(fitted.offset[0], 3.25 + fitted.offset[1], fitted.offset[2]);
   camera.lookAt(0, 3.25, 0);
   camera.setViewOffset(width, height, (-fitted.shift[0] * width) / 2, (fitted.shift[1] * height) / 2, width, height);
   camera.updateMatrixWorld();
   camera.updateProjectionMatrix();
   return { camera, camPos: camera.position.clone() };
}

describe("food-catcher decor placement and safety bounds", () => {
   it("ensures every decor spot is strictly outside the active play bounds", () => {
      expect(ALL_DECOR_SPOTS.length).toBeGreaterThanOrEqual(20);

      for (const spot of ALL_DECOR_SPOTS) {
         // Center must not be inside play bounds
         expect(
            inPlayArea(spot.x, spot.y, spot.z),
            `spot ${spot.kind} at (${spot.x}, ${spot.y}, ${spot.z}) must be outside play bounds`
         ).toBe(false);

         // Bounding extent check: lateral spots must clear lateral play limits
         if (spot.x < 0 && spot.y < 7.0 && spot.y >= 0) {
            // Left shelving units: must be strictly to the left of x0 (-4.2)
            expect(spot.x + spot.sx * 0.5).toBeLessThanOrEqual(PLAY_AREA.x0);
         } else if (spot.x > 0 && spot.y < 7.0 && spot.y >= 0) {
            // Right prep station / window: must be strictly to the right of x1 (4.2)
            expect(spot.x - spot.sx * 0.5).toBeGreaterThanOrEqual(PLAY_AREA.x1);
         } else if (spot.y >= 7.0) {
            // Overhead hood, lamps, pans: must be strictly above top of play bounds (6.5)
            expect(spot.y - spot.sy * 0.5).toBeGreaterThanOrEqual(PLAY_AREA.y1);
         }
      }
   });

   it("ensures no decor mesh occludes any play target from the fitted camera at 1280x800, 390x844, and 844x390", () => {
      // Sample 3D grid of play targets where the chef, falling food and junk items live
      const playTargets: Vector3[] = [];
      for (const x of [-3.8, -2.0, 0, 2.0, 3.8]) {
         for (const y of [0.1, 1.6, 3.25, 4.8, 6.2]) {
            for (const z of [-0.6, 0.0, 0.2, 0.55, 0.85]) {
               playTargets.push(new Vector3(x, y, z));
            }
         }
      }

      for (const res of TEST_RESOLUTIONS) {
         for (const banner of [0, 110]) {
            const { camPos } = getFittedCamera(res.width, res.height, banner);

            // Camera is on +z side
            expect(camPos.z).toBeGreaterThan(PLAY_AREA.z1);

            for (const target of playTargets) {
               const rayDir = new Vector3().subVectors(target, camPos);
               const rayLength = rayDir.length();
               rayDir.normalize();
               const ray = new Ray(camPos, rayDir);

               for (const spot of ALL_DECOR_SPOTS) {
                  // Dynamic sway range for overhead elements
                  const swayOffsets = spot.kind === "overheadPan" || spot.kind === "pendantLamp" ? [-0.08, 0, 0.08] : [0];

                  for (const sway of swayOffsets) {
                     const spotBox = new Box3(
                        new Vector3(
                           spot.x + sway - spot.sx * 0.5,
                           spot.y - spot.sy * 0.5,
                           spot.z - spot.sz * 0.5
                        ),
                        new Vector3(
                           spot.x + sway + spot.sx * 0.5,
                           spot.y + spot.sy * 0.5,
                           spot.z + spot.sz * 0.5
                        )
                     );

                     const hit = ray.intersectBox(spotBox, new Vector3());
                     if (hit) {
                        const distToHit = camPos.distanceTo(hit);
                        // If any hit occurs, it must be strictly BEHIND the play target
                        // so it NEVER sits between camera and play target.
                        expect(
                           distToHit,
                           `decor ${spot.kind} at (${spot.x}, ${spot.y}, ${spot.z}) occludes target (${target.x}, ${target.y}, ${target.z}) at ${res.name} (banner: ${banner})`
                        ).toBeGreaterThan(rayLength);
                     }
                  }
               }
            }
         }
      }
   });

   it("ensures the kitchen wall and floor cover the camera view at all three screen sizes without void", () => {
      // Wall: z = -0.85, width 50, height 36, centered at y = 4.0
      // Floor: y = -10.0, width 60, depth 30
      // Base cabinets: y from 0 down to -11, width 48
      for (const res of TEST_RESOLUTIONS) {
         const { camera, camPos } = getFittedCamera(res.width, res.height, 0);

         // Check 4 screen corners at the back wall depth (z = -0.85)
         const depth = Math.abs(camPos.z - (-0.85));
         const vFovRad = (camera.fov * Math.PI) / 180;
         const halfHeight = Math.tan(vFovRad / 2) * depth;
         const halfWidth = halfHeight * (res.width / res.height);

         const leftScreen = camPos.x - halfWidth;
         const rightScreen = camPos.x + halfWidth;
         const topScreen = camPos.y + halfHeight;
         const bottomScreen = camPos.y - halfHeight;

         // Wall spans x in [-25, 25], y in [-14, 22]
         expect(leftScreen, `wall must cover left at ${res.name}`).toBeGreaterThanOrEqual(-25);
         expect(rightScreen, `wall must cover right at ${res.name}`).toBeLessThanOrEqual(25);
         expect(topScreen, `wall must cover top at ${res.name}`).toBeLessThanOrEqual(22);

         // Under the counter (y <= 0), cabinetry and floor cover the view:
         // Cabinet spans width 48 (x [-24, 24]), height down to -11, floor at -10 down to -12
         expect(bottomScreen, `cabinet/floor must cover bottom at ${res.name}`).toBeGreaterThanOrEqual(-14);
      }
   });

   it("guarantees strong WCAG contrast for all falling items and indicators against the kitchen background", () => {
      const tileBg = COLORS.wallTile; // #f8fafc

      // Good food items
      const appleContrast = contrastRatio(COLORS.apple, tileBg);
      expect(appleContrast, "apple contrast against wall tile").toBeGreaterThanOrEqual(4.0);

      const burgerPattyContrast = contrastRatio(COLORS.patty, tileBg);
      expect(burgerPattyContrast, "burger patty contrast against wall tile").toBeGreaterThanOrEqual(4.5);

      const bananaStemContrast = contrastRatio(COLORS.bananaStem, tileBg);
      expect(bananaStemContrast, "banana dark stem contrast").toBeGreaterThanOrEqual(4.5);

      // Bad junk items
      const sockStripeContrast = contrastRatio(COLORS.sockStripe, tileBg);
      expect(sockStripeContrast, "sock stripe contrast").toBeGreaterThanOrEqual(3.5);

      const tinBandContrast = contrastRatio(COLORS.tinBand, tileBg);
      expect(tinBandContrast, "tin band contrast").toBeGreaterThanOrEqual(3.5);

      // Warning junk tell ring
      const ringContrast = contrastRatio(COLORS.ring, tileBg);
      expect(ringContrast, "junk tell ring contrast").toBeGreaterThanOrEqual(4.5);

      const ringRimContrast = contrastRatio(COLORS.ringRim, tileBg);
      expect(ringRimContrast, "junk tell ring rim contrast").toBeGreaterThanOrEqual(3.0);
   });

   it("verifies level looks and lighting presets cover all 5 levels", () => {
      const expectedPresets = ["indoor", "day", "sunset", "night", "sunset"];
      for (let i = 1; i <= 5; i++) {
         const look = LEVEL_LOOKS[i as 1 | 2 | 3 | 4 | 5];
         expect(look, `level ${i} look must be defined`).toBeDefined();
         expect(look.lighting, `level ${i} lighting preset`).toBe(expectedPresets[i - 1]);
         expect(look.background).toMatch(/^#[0-9a-f]{6}$/i);
         expect(look.fog).toMatch(/^#[0-9a-f]{6}$/i);
         expect(look.skyTop).toMatch(/^#[0-9a-f]{6}$/i);
         expect(look.skyBottom).toMatch(/^#[0-9a-f]{6}$/i);
      }
   });
});
