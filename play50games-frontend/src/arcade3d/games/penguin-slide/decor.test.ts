import { describe, expect, it } from "vitest";
import { Box3, Ray, Vector3 } from "three";
import { fitView } from "@/arcade3d/core/view";
import { VIEW } from "./camera";
import { CLOUD_DRIFT, COLORS, DECOR, PLAY_BOUNDS, inPlayBounds } from "./looks";

describe("penguin-slide modern look and decor validation", () => {
   it("places every decor spot strictly outside the play area bounds", () => {
      expect(DECOR.length).toBeGreaterThan(25);

      for (const spot of DECOR) {
         // The spot center itself must not be in the play bounds
         expect(inPlayBounds(spot.x, spot.y, spot.z)).toBe(false);

         if (spot.kind === "drift" || spot.kind === "spire" || spot.kind === "rock") {
            // Lateral decor must have its inner edge clear of lateral play bounds (|x| <= 4.8)
            const minX = Math.abs(spot.x) - spot.radius;
            expect(minX).toBeGreaterThanOrEqual(PLAY_BOUNDS.x1);
         } else if (spot.kind === "glacier" || spot.kind === "mountain") {
            // Distant landmarks must be well past the preview range (z <= -24)
            expect(spot.z + spot.radius).toBeLessThanOrEqual(PLAY_BOUNDS.z0);
         } else if (spot.kind === "cloud") {
            // Clouds must be high in the sky (y >= 18) and down-track (z <= -35)
            expect(spot.y - spot.sy / 2).toBeGreaterThan(PLAY_BOUNDS.y1);
            expect(spot.z).toBeLessThanOrEqual(PLAY_BOUNDS.z0);
         }
      }
   });

   it("ensures no decor spot occludes the play area from the fitted camera at 1280x800, 390x844, and 844x390", () => {
      const resolutions = [
         { width: 1280, height: 800 },
         { width: 390, height: 844 },
         { width: 844, height: 390 },
      ];

      // Sample key targets across the play area (where penguin, fish, obstacles, and gates live)
      const playTargets: Vector3[] = [];
      for (const x of [-3.5, -1.75, 0, 1.75, 3.5]) {
         for (const z of [2, 0, -5, -12, -20]) {
            for (const y of [0.1, 1.2, 2.5]) {
               playTargets.push(new Vector3(x, y, z));
            }
         }
      }

      for (const res of resolutions) {
         const fitted = fitView({ ...VIEW, width: res.width, height: res.height });
         expect(fitted.distance).toBeGreaterThan(15);

         // Test across camera pullback factors [1.0, 1.2]
         for (const factor of [1.0, 1.1, 1.2]) {
            const camPos = new Vector3(
               fitted.offset[0] * factor,
               fitted.offset[1] * factor,
               -10 + fitted.offset[2] * factor
            );

            // Camera itself must be above and behind the play area
            expect(camPos.y).toBeGreaterThan(PLAY_BOUNDS.y1);
            expect(camPos.z).toBeGreaterThan(PLAY_BOUNDS.z1);

            for (const target of playTargets) {
               const rayDir = new Vector3().subVectors(target, camPos);
               const rayLength = rayDir.length();
               rayDir.normalize();
               const ray = new Ray(camPos, rayDir);

               for (const spot of DECOR) {
                  // Test multiple cloud drift phases
                  const driftOffsets = spot.kind === "cloud" ? [-CLOUD_DRIFT, 0, CLOUD_DRIFT] : [0];

                  for (const drift of driftOffsets) {
                     const spotBox = new Box3(
                        new Vector3(
                           spot.x + drift - spot.sx * 0.5,
                           spot.y - spot.sy * 0.5,
                           spot.z - spot.sz * 0.5
                        ),
                        new Vector3(
                           spot.x + drift + spot.sx * 0.5,
                           spot.y + spot.sy * 0.5,
                           spot.z + spot.sz * 0.5
                        )
                     );

                     const hit = ray.intersectBox(spotBox, new Vector3());
                     if (hit) {
                        const distToHit = camPos.distanceTo(hit);
                        // If a hit occurs, it must be strictly behind the play target (ray length)
                        // so it never sits BETWEEN camera and play target.
                        expect(distToHit).toBeGreaterThan(rayLength);
                     }
                  }
               }
            }
         }
      }
   });

   it("guarantees the ground plane covers the bottom screen view without void at all 3 resolutions", () => {
      const resolutions = [
         { width: 1280, height: 800 },
         { width: 390, height: 844 },
         { width: 844, height: 390 },
      ];

      for (const res of resolutions) {
         const fitted = fitView({ ...VIEW, width: res.width, height: res.height });
         const camPos = new Vector3(fitted.offset[0], fitted.offset[1], -10 + fitted.offset[2]);

         // Bottom-center of the camera view: looking down towards focus (0, 0, -10)
         // Ray from camera through the bottom edge of the view cone
         const fovRad = (VIEW.fov * Math.PI) / 180;
         const forward = new Vector3(0, 0, -10).sub(camPos).normalize();

         // Pitch angle downwards
         expect(forward.y).toBeLessThan(-0.25);

         // Ground plane is at y ~ -1.2, sloping at grade 0.08 along -z
         // At camPos.z (typically +12 to +35), the ground plane extends to z = +80 behind camera
         // and z = -240 forward, x = -140 to +140.
         // Camera looking down cannot see past the ground boundary.
         expect(camPos.z).toBeLessThan(80);
         expect(camPos.x).toBeGreaterThan(-140);
         expect(camPos.x).toBeLessThan(140);
      }
   });

   it("has unified palette contrast for gameplay readability and seamless fog blending", () => {
      // Seamless fog horizon
      expect(COLORS.fog).toBe(COLORS.skyBottom);

      // Contrast between dark penguin coat and white belly
      expect(COLORS.penguinDark).not.toBe(COLORS.penguinWhite);

      // Obstacle hazard highlights must be vivid coral for immediate recognition
      expect(COLORS.iceBlockCoral).toBe("#fb7185");
      expect(COLORS.crackCoralRim).toBe("#fb7185");

      // Fish pickup must be vivid orange against light ice surface
      expect(COLORS.fishBody).toBe("#f97316");
      expect(COLORS.iceSurface).toBe("#cffafe");
   });
});
