import { describe, expect, it } from "vitest";
import { Box3, Vector3 } from "three";
import { fitView } from "@/arcade3d/core/view";
import { FOV, PITCH, WINDOWS, screenKind, stageBounds, viewFor, windowHalf } from "./camera";
import { STAGES, type StageIndex } from "./level";
import { CLOUD_DRIFT, COLORS, DECOR, FOG, contrastRatio, decorOf, inPlayArea } from "./looks";
import { MEADOW_BLOTCH_ALPHA, TERRAIN_LAYERS } from "./Terrain";
import {
   bambooPieces,
   benchPieces,
   binPieces,
   bridgePieces,
   bundlePieces,
   bushPieces,
   carPieces,
   cloudPieces,
   gatePieces,
   hedgePieces,
   hillPieces,
   keeperPieces,
   kioskPieces,
   lampPieces,
   mergePieces,
   palmPieces,
   pandaPieces,
   pinePieces,
   rockPieces,
   signpostPieces,
   snackPieces,
   torchPieces,
   towerPieces,
   treePieces,
} from "./Primitives";

describe("zoo-escape look and visual contract", () => {
   it("keeps every decor instance strictly outside the playable zoo area", () => {
      expect(DECOR.length).toBeGreaterThan(30);
      for (const spot of DECOR) {
         if (spot.kind === "cloud") continue; // clouds drift overhead in the sky
         const inside = inPlayArea(spot.x, spot.z, 0);
         expect(inside, `decor ${spot.kind} at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) must be outside play area`).toBe(false);
      }
   });

   it("keeps drifting clouds high in the sky and away from camera sightlines", () => {
      const clouds = decorOf("cloud");
      expect(clouds.length).toBeGreaterThanOrEqual(4);
      for (const c of clouds) {
         // Clouds sit at y >= 26 m, far above the camera height
         expect(c.y).toBeGreaterThanOrEqual(26);
         // Check that drift doesn't produce invalid positions
         expect(Number.isFinite(c.x + CLOUD_DRIFT)).toBe(true);
         expect(Number.isFinite(c.x - CLOUD_DRIFT)).toBe(true);
      }
   });

   it("starts fog well past the fitted camera focus so the entire play area stays crisp", () => {
      expect(FOG.day.near).toBeGreaterThanOrEqual(40);
      expect(FOG.day.far).toBeGreaterThan(FOG.day.near);
      expect(FOG.dusk.near).toBeGreaterThanOrEqual(35);
      expect(FOG.dusk.far).toBeGreaterThan(FOG.dusk.near);
   });

   it("guarantees high visual contrast for panda, keepers, flashlight cones and escape indicators", () => {
      // Panda white fur reads clearly against zoo lawn
      expect(contrastRatio(COLORS.white, COLORS.grass)).toBeGreaterThanOrEqual(2.0);
      // Panda black markings read strongly against zoo lawn and paving
      expect(contrastRatio(COLORS.black, COLORS.grass)).toBeGreaterThanOrEqual(3.5);
      expect(contrastRatio(COLORS.black, COLORS.paving)).toBeGreaterThanOrEqual(3.5);

      // Flashlight cone (amber/yellow) stands out against lawn, paving, and asphalt
      expect(contrastRatio(COLORS.cone, COLORS.grass)).toBeGreaterThanOrEqual(3.0);
      expect(contrastRatio(COLORS.cone, COLORS.asphalt)).toBeGreaterThanOrEqual(3.5);
      expect(contrastRatio(COLORS.cone, COLORS.grassDeep)).toBeGreaterThanOrEqual(2.5);

      // Suspicion alert coral stands out strongly
      expect(contrastRatio(COLORS.alert, COLORS.asphalt)).toBeGreaterThanOrEqual(2.5);

      // Exit mint accent reads clearly
      expect(contrastRatio(COLORS.accent, COLORS.asphalt)).toBeGreaterThanOrEqual(3.5);
   });

   it("ensures ground covers the entire viewport across 1280x800, 390x844, and 844x390", () => {
      // Ground plane is 160 x 200 centred at [0, -0.02, -13], covering x [-80, 80] and z [-113, 87]
      const groundMinX = -80, groundMaxX = 80;
      const groundMinZ = -113, groundMaxZ = 87;

      for (const [w, h] of [[1280, 800], [390, 844], [844, 390]]) {
         const { hx, hz } = windowHalf(w, h);
         for (const s of [0, 1, 2] as StageIndex[]) {
            const b = stageBounds(s, hx, hz, { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } });
            // Viewport window edges on ground from any valid camera aim point
            expect(b.min.x - hx).toBeGreaterThan(groundMinX);
            expect(b.max.x + hx).toBeLessThan(groundMaxX);
            expect(b.min.z - hz).toBeGreaterThan(groundMinZ);
            expect(b.max.z + hz).toBeLessThan(groundMaxZ);
         }
      }
   });

   it("ensures no decor object occludes the panda or keepers from the fitted camera", () => {
      // For each screen size and stage, check that no decor object sits between the camera and any point in the play area
      const testScreens = [
         [1280, 800],
         [390, 844],
         [844, 390],
      ] as const;

      for (const [w, h] of testScreens) {
         const v = viewFor(w, h);
         const fit = fitView({ ...v, width: w, height: h, fov: FOV });
         const camDistY = fit.distance * Math.sin(PITCH);
         const camDistZ = fit.distance * Math.cos(PITCH);

         for (const spot of DECOR) {
            if (spot.kind === "cloud") continue; // clouds at y >= 26 m are above camera

            // Decor bounding box approximate
            const halfW = (spot.sx || 1) / 2;
            const halfD = (spot.sz || 1) / 2;
            const height = spot.sy || 2;
            const decorBox = new Box3(
               new Vector3(spot.x - halfW, spot.y, spot.z - halfD),
               new Vector3(spot.x + halfW, spot.y + height, spot.z + halfD)
            );

            // Test across stage bounds: camera is at aim.x, camDistY, aim.z + camDistZ
            for (const s of STAGES) {
               for (const px of [s.bounds.x0 + 0.5, (s.bounds.x0 + s.bounds.x1) / 2, s.bounds.x1 - 0.5]) {
                  for (const pz of [s.bounds.z0 + 0.5, (s.bounds.z0 + s.bounds.z1) / 2, s.bounds.z1 - 0.5]) {
                     // Camera looking at this aim point
                     const camPos = new Vector3(px, camDistY, pz + camDistZ);
                     const targetPos = new Vector3(px, 0.8, pz); // panda / keeper eye height

                     // Ray from camera to target: does decorBox intersect the line segment?
                     // A box occludes only if it sits between camPos and targetPos
                     if (camPos.z > decorBox.max.z && targetPos.z < decorBox.min.z) {
                        // Ray is passing along z through decor's z range: check X alignment
                        const t = (decorBox.min.z - camPos.z) / (targetPos.z - camPos.z);
                        const rayX = camPos.x + t * (targetPos.x - camPos.x);
                        const rayY = camPos.y + t * (targetPos.y - camPos.y);

                        const inX = rayX >= decorBox.min.x && rayX <= decorBox.max.x;
                        const inY = rayY >= decorBox.min.y && rayY <= decorBox.max.y;
                        expect(inX && inY, `decor ${spot.kind} at (${spot.x}, ${spot.z}) must not occlude ray`).toBe(false);
                     }
                  }
               }
            }
         }
      }
   });

   it("builds valid vertex-colored procedural geometries with clean attributes", () => {
      const generators = [
         ["panda", pandaPieces],
         ["keeper", keeperPieces],
         ["torch", torchPieces],
         ["rock", rockPieces],
         ["bamboo", bambooPieces],
         ["bench", benchPieces],
         ["bin", binPieces],
         ["lamp", lampPieces],
         ["palm", palmPieces],
         ["car", () => carPieces(0)],
         ["tree", treePieces],
         ["pine", pinePieces],
         ["hedge", hedgePieces],
         ["signpost", signpostPieces],
         ["hill", hillPieces],
         ["cloud", cloudPieces],
         ["bush", bushPieces],
         ["snack", snackPieces],
         ["bundle", bundlePieces],
         ["kiosk", kioskPieces],
         ["gate", gatePieces],
         ["tower", towerPieces],
         ["bridge", bridgePieces],
      ] as const;

      for (const [name, fn] of generators) {
         const geo = mergePieces(fn());
         expect(geo, `${name} geometry`).toBeDefined();
         const pos = geo.getAttribute("position");
         expect(pos, `${name} positions`).toBeDefined();
         expect(pos.count, `${name} vertex count`).toBeGreaterThan(10);
         const col = geo.getAttribute("color");
         expect(col, `${name} colors`).toBeDefined();
         expect(col.count).toBe(pos.count);
         geo.dispose();
      }
   });
   it("pins the terrain layer order (y elevation and polygon offset) to prevent z-fighting across cameras", () => {
      // Outer ground sits at y <= -0.08, well below stage grounds
      expect(TERRAIN_LAYERS.outerGround.y).toBeLessThanOrEqual(-0.08);

      // Base stage surfaces (meadow, plaza, asphalt) sit at y >= 0 with negative polygon offset (-1)
      expect(TERRAIN_LAYERS.meadow.y).toBeGreaterThan(TERRAIN_LAYERS.outerGround.y);
      expect(TERRAIN_LAYERS.plaza.y).toBeGreaterThanOrEqual(TERRAIN_LAYERS.meadow.y);
      expect(TERRAIN_LAYERS.asphalt.y).toBeGreaterThanOrEqual(TERRAIN_LAYERS.meadow.y);

      expect(TERRAIN_LAYERS.meadow.offsetFactor).toBe(-1);
      expect(TERRAIN_LAYERS.meadow.offsetUnits).toBe(-1);
      expect(TERRAIN_LAYERS.plaza.offsetFactor).toBe(-1);
      expect(TERRAIN_LAYERS.plaza.offsetUnits).toBe(-1);
      expect(TERRAIN_LAYERS.asphalt.offsetFactor).toBe(-1);
      expect(TERRAIN_LAYERS.asphalt.offsetUnits).toBe(-1);

      // Paths sit physically on top of stage surfaces and have a stronger negative offset (-2)
      expect(TERRAIN_LAYERS.paths.y).toBeGreaterThan(TERRAIN_LAYERS.meadow.y);
      expect(TERRAIN_LAYERS.paths.offsetFactor).toBe(-2);
      expect(TERRAIN_LAYERS.paths.offsetUnits).toBe(-2);

      // Overlay markings (lines and crosswalk) sit on top of paths and have the strongest offset (-3)
      expect(TERRAIN_LAYERS.crosswalk.y).toBeGreaterThan(TERRAIN_LAYERS.paths.y);
      expect(TERRAIN_LAYERS.parkingLines.y).toBeGreaterThan(TERRAIN_LAYERS.paths.y);
      expect(TERRAIN_LAYERS.crosswalk.offsetFactor).toBe(-3);
      expect(TERRAIN_LAYERS.crosswalk.offsetUnits).toBe(-3);
      expect(TERRAIN_LAYERS.parkingLines.offsetFactor).toBe(-3);
      expect(TERRAIN_LAYERS.parkingLines.offsetUnits).toBe(-3);
   });

   it("keeps outer-ground blotch alpha subtle (~0.08) to prevent dark splotches showing through", () => {
      expect(MEADOW_BLOTCH_ALPHA).toBeLessThanOrEqual(0.1);
      expect(MEADOW_BLOTCH_ALPHA).toBeGreaterThanOrEqual(0.06);
   });
});
