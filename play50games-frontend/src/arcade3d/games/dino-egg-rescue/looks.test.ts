import { describe, expect, it } from "vitest";
import { viewFor } from "./camera";
import {
   CLOUD_DRIFT,
   COLORS,
   DECOR,
   FOG,
   PTEROSAURS,
   VALLEY_FIELD,
   contrastRatio,
   farValleyDistance,
   inValley,
   pterosaurPosition,
   ridgeHeight,
   valleyRidgeMesh,
} from "./looks";

describe("dino-egg-rescue look (modern-look pass)", () => {
   it("keeps every decor instance strictly outside the valley play area", () => {
      expect(DECOR.length).toBeGreaterThanOrEqual(40);
      for (const spot of DECOR) {
         expect(
            inValley(spot.x, spot.z, 0.4),
            `${spot.kind} at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) is inside valley`
         ).toBe(false);
      }
   });

   it("keeps the pterosaur flight loop and drifting clouds outside the valley bounds", () => {
      for (let i = 0; i < PTEROSAURS.count; i++) {
         for (let k = 0; k < 16; k++) {
            const p = pterosaurPosition(i, (k / 16) * Math.PI * 2);
            expect(
               inValley(p.x, p.z, 0),
               `pterosaur ${i} at (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) inside valley`
            ).toBe(false);
            expect(p.z).toBeLessThan(-15);
         }
      }
      for (const cloud of DECOR.filter((s) => s.kind === "cloud")) {
         expect(inValley(cloud.x - CLOUD_DRIFT, cloud.z, 0)).toBe(false);
         expect(inValley(cloud.x + CLOUD_DRIFT, cloud.z, 0)).toBe(false);
         expect(cloud.z).toBeLessThan(-15);
      }
   });

   it("starts fog beyond the far valley distance so the play area stays crisp and unfogged", () => {
      const maxDist = farValleyDistance();
      expect(maxDist).toBeGreaterThan(35);
      expect(FOG.near).toBeGreaterThan(maxDist);
      expect(FOG.far).toBeGreaterThan(FOG.near);
   });

   it("ensures strong contrast for the player, eggs, golden egg, and boulders against grass and mud", () => {
      // Eggs against dark mud pit
      expect(contrastRatio(COLORS.eggShell, COLORS.mudDark)).toBeGreaterThan(8);
      expect(contrastRatio(COLORS.goldenEgg, COLORS.mudDark)).toBeGreaterThan(6);

      // Eggs against grass floor
      expect(contrastRatio(COLORS.eggShell, COLORS.grass)).toBeGreaterThanOrEqual(2.2);
      expect(contrastRatio(COLORS.goldenEgg, COLORS.grass)).toBeGreaterThanOrEqual(2.0);

      // Boulders against grass floor (dark volcanic rock on vibrant lime grass)
      expect(contrastRatio(COLORS.boulderDark, COLORS.grass)).toBeGreaterThan(4.5);
      expect(contrastRatio(COLORS.boulder, COLORS.grass)).toBeGreaterThan(2.0);

      // Player dino frill and belly contrast against terrain
      expect(contrastRatio(COLORS.dinoFrill, COLORS.grassDeep)).toBeGreaterThan(2.5);
      expect(contrastRatio(COLORS.dinoBelly, COLORS.grassShade)).toBeGreaterThan(3.0);
   });

   it("verifies that no decor item occludes the play area from fitted cameras (1280x800, 390x844, 844x390)", () => {
      // In dino-egg-rescue, camera yaw is strictly 0 and the camera sits at +z (South), looking down
      // towards -z (North) at pitch 50 deg (desktop & phone portrait) or 60 deg (phone landscape).
      //
      // For any camera position (camX, camY, camZ) with camZ >= 11 and yaw 0, and any target point
      // (px, py, pz) in the play area (|px| <= 15, |pz| <= 11):
      // Every point on the line of sight S(t) = C + t * (P - C) for t in [0, 1] has:
      //   - x coordinate in [-15, 15] (since camX = dinoX in [-15, 15] and px in [-15, 15])
      //   - z coordinate >= -11 (since camZ >= 11 and pz >= -11)
      //
      // Therefore, any decor item with:
      //   (x_max < -15) OR (x_min > 15) OR (z_max < -11)
      // CAN NEVER intersect any sightline ray between camera and playfield!
      //
      // Verify this geometric invariance for every single decor spot in DECOR:
      for (const spot of DECOR) {
         const isWestFlank = spot.x < VALLEY_FIELD.x0;
         const isEastFlank = spot.x > VALLEY_FIELD.x1;
         const isNorthBackground = spot.z < VALLEY_FIELD.z0;

         expect(
            isWestFlank || isEastFlank || isNorthBackground,
            `decor spot ${spot.kind} at (${spot.x}, ${spot.z}) must be in West, East, or North exterior`
         ).toBe(true);

         // Crucial safety check: NO tall decor is placed in the South foreground (z > 11)
         expect(spot.z).toBeLessThanOrEqual(VALLEY_FIELD.z1);
      }

      // Check view options for all 3 required viewports exist and are valid
      const desktop = viewFor(1280, 800);
      const phoneP = viewFor(390, 844);
      const phoneL = viewFor(844, 390);

      expect(desktop.yaws?.[0]).toBe(0);
      expect(phoneP.yaws?.[0]).toBe(0);
      expect(phoneL.yaws?.[0]).toBe(0);
   });

   it("leaves the valley floor flat in valleyRidgeMesh and only rises outside the valley", () => {
      // Inside valley: height is strictly 0
      for (const x of [-15, -10, 0, 10, 15]) {
         for (const z of [-11, -5, 0, 5, 11]) {
            expect(ridgeHeight(x, z)).toBe(0);
         }
      }

      // Outside valley: knolls rise
      expect(ridgeHeight(-20, 0)).toBeGreaterThan(0.5);
      expect(ridgeHeight(20, 0)).toBeGreaterThan(0.5);
      expect(ridgeHeight(0, -18)).toBeGreaterThan(0.5);

      const mesh = valleyRidgeMesh();
      expect(mesh.triangles).toBeGreaterThan(100);
      expect(mesh.triangles).toBeLessThan(3000);
      expect(mesh.positions.length).toBe(mesh.triangles * 9);
      expect(mesh.colors.length).toBe(mesh.triangles * 9);

      // Verify all normals point upward
      for (let i = 0; i < mesh.positions.length; i += 9) {
         const ax = mesh.positions[i + 3] - mesh.positions[i];
         const ay = mesh.positions[i + 4] - mesh.positions[i + 1];
         const az = mesh.positions[i + 5] - mesh.positions[i + 2];
         const bx = mesh.positions[i + 6] - mesh.positions[i];
         const by = mesh.positions[i + 7] - mesh.positions[i + 1];
         const bz = mesh.positions[i + 8] - mesh.positions[i + 2];
         const ny = az * bx - ax * bz;
         expect(ny).toBeGreaterThan(0);
         expect(Number.isFinite(ay + by)).toBe(true);
      }
   });
});
