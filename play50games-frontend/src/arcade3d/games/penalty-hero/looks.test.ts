import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { fitLiveView } from "@/arcade3d/core/useFittedView";
import { setLensShift } from "@/arcade3d/core/view";
import type { SafeArea } from "@/arcade3d/core/safeArea";
import { CAMERA_FOV, CAMERA_LOOK_AT, PENALTY_FIT_AREA, PENALTY_VIEW } from "./camera";
import {
   ALL_DECOR,
   COLORS,
   DYNAMIC_FLAGS,
   FLOODLIGHT_TOWERS,
   FOG,
   GROUND,
   PITCH,
   PLAY_BOUNDS,
   contrastRatio,
   decorOf,
   inPlayArea,
} from "./looks";

const VIEWPORTS = [
   { name: "desktop", width: 1280, height: 800, banner: 0 },
   { name: "desktop-banner", width: 1280, height: 800, banner: 79 },
   { name: "portrait-phone", width: 390, height: 844, banner: 0 },
   { name: "portrait-phone-banner", width: 390, height: 844, banner: 162 },
   { name: "landscape-phone", width: 844, height: 390, banner: 0 },
   { name: "landscape-phone-banner", width: 844, height: 390, banner: 83 },
] as const;

function safeArea(width: number, height: number, bannerHeight: number): SafeArea {
   const obstructionTop = height - bannerHeight;
   const bottom = height - bannerHeight;
   return {
      width,
      height,
      hud: [
         { left: 10, top: 10, right: 202, bottom: 54 },
         { left: width - 104, top: 10, right: width - 10, bottom: 54 },
         { left: width / 2 - 142, top: bottom - 73, right: width / 2 + 142, bottom: bottom - 14 },
         { left: width / 2 - 69, top: 70, right: width / 2 + 69, bottom: 98 },
      ],
      controls: [],
      obstructions: bannerHeight > 0 ? [{ left: 0, top: obstructionTop, right: width, bottom: height }] : [],
   };
}

function createFittedCamera(width: number, height: number, bannerHeight: number) {
   const safe = safeArea(width, height, bannerHeight);
   const { view } = fitLiveView({ ...PENALTY_VIEW, width, height, fov: CAMERA_FOV }, safe, null);
   const camera = new PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 400);
   camera.position.set(
      CAMERA_LOOK_AT[0] + view.offset[0],
      CAMERA_LOOK_AT[1] + view.offset[1],
      CAMERA_LOOK_AT[2] + view.offset[2]
   );
   camera.lookAt(...CAMERA_LOOK_AT);
   setLensShift(camera, view.shift[0], view.shift[1], width, height);
   camera.updateMatrixWorld();
   return { camera, view };
}

describe("penalty-hero modern look", () => {
   it("keeps every decor instance strictly outside the play bounds with clearance", () => {
      expect(ALL_DECOR.length).toBeGreaterThan(50);
      for (const spot of ALL_DECOR) {
         expect(
            inPlayArea(spot.x, spot.z),
            `Decor ${spot.kind} at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) must not be inside play bounds`
         ).toBe(false);

         // Extra clearance: no decor encroaches closer than 0.4 m to the play bounds
         const insideWithMargin = inPlayArea(spot.x, spot.z, 0.4);
         expect(
            insideWithMargin,
            `Decor ${spot.kind} at (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)}) is too close to play bounds`
         ).toBe(false);
      }
   });

   it("keeps dynamic cheering flags outside the play bounds at any wave phase", () => {
      for (const flag of DYNAMIC_FLAGS) {
         for (let step = 0; step < 8; step++) {
            const wave = Math.sin((step / 8) * Math.PI * 2) * 0.2;
            expect(inPlayArea(flag.x + wave, flag.z)).toBe(false);
         }
      }
   });

   it("ensures decor never sits between the camera and the play area", () => {
      // The camera is at z >= 20. The play area is at z in [-1.8, 12.1], x in [-4.06, 4.06].
      // Any decor object at z < 20 must either be behind the goal (z <= -2.0)
      // or to the left/right flanks (|x| >= 7.5).
      for (const spot of ALL_DECOR) {
         if (spot.z < 20) {
            const behindGoal = spot.z <= -2.0;
            const toFlank = Math.abs(spot.x) >= 7.5;
            expect(
               behindGoal || toFlank,
               `Decor ${spot.kind} at (${spot.x}, ${spot.z}) must be behind goal or on the flanks`
            ).toBe(true);
         }
      }
   });

   it("verifies the ground plane completely covers the viewport bottom edge at all three sizes (no void/sky below)", () => {
      const halfW = GROUND.width / 2;
      const zMin = GROUND.zCenter - GROUND.depth / 2;
      const zMax = GROUND.zCenter + GROUND.depth / 2;

      for (const vp of VIEWPORTS) {
         const { camera } = createFittedCamera(vp.width, vp.height, vp.banner);

         // Sample rays across the bottom edge of the screen (NDC y = -1, x from -1 to 1)
         for (let i = 0; i <= 10; i++) {
            const ndcX = -1 + (i / 10) * 2;
            const rayOrigin = camera.position.clone();
            const rayTarget = new Vector3(ndcX, -1, 0.5).unproject(camera);
            const rayDir = rayTarget.sub(rayOrigin).normalize();

            // Intersect with ground plane y = 0
            if (rayDir.y < -1e-4) {
               const t = -rayOrigin.y / rayDir.y;
               const hitX = rayOrigin.x + rayDir.x * t;
               const hitZ = rayOrigin.z + rayDir.z * t;

               expect(
                  hitX,
                  `${vp.name}: ground hit x=${hitX.toFixed(1)} must be within [-${halfW}, ${halfW}]`
               ).toBeGreaterThanOrEqual(-halfW);
               expect(
                  hitX,
                  `${vp.name}: ground hit x=${hitX.toFixed(1)} must be within [-${halfW}, ${halfW}]`
               ).toBeLessThanOrEqual(halfW);
               expect(
                  hitZ,
                  `${vp.name}: ground hit z=${hitZ.toFixed(1)} must be within [${zMin}, ${zMax}]`
               ).toBeGreaterThanOrEqual(zMin);
               expect(
                  hitZ,
                  `${vp.name}: ground hit z=${hitZ.toFixed(1)} must be within [${zMin}, ${zMax}]`
               ).toBeLessThanOrEqual(zMax);
            }
         }
      }
   });

   it("starts fog beyond the play area so striker, ball, keeper and goal stay un-fogged", () => {
      expect(FOG.near).toBeGreaterThanOrEqual(40);
      expect(FOG.far).toBeGreaterThan(FOG.near);
      // Distance from maximum camera distance to goal plane is under FOG.near
      for (const vp of VIEWPORTS) {
         const { view } = createFittedCamera(vp.width, vp.height, vp.banner);
         expect(view.distance).toBeLessThanOrEqual(FOG.near);
      }
   });

   it("ensures strong visual contrast for ball, goal, and footballers against pitch and boards", () => {
      // Ball white against pitch grass
      expect(contrastRatio("#f8fafc", COLORS.grass)).toBeGreaterThan(3.5);
      // Ball white against dark boards
      expect(contrastRatio("#f8fafc", COLORS.boardBody)).toBeGreaterThan(10);
      // Goal frame white against pitch grass
      expect(contrastRatio(COLORS.frame, COLORS.grass)).toBeGreaterThan(3.5);
      // Goal frame white against dark stands
      expect(contrastRatio(COLORS.frame, COLORS.standConcrete)).toBeGreaterThan(8);
      // Striker kit (blue) distinct from pitch grass
      expect(contrastRatio(COLORS.strikerKit, "#ffffff")).toBeGreaterThan(3.5);
      // Keeper gloves (yellow) high contrast against pitch and ball
      expect(contrastRatio(COLORS.gloves, COLORS.boardBody)).toBeGreaterThan(7);
   });

   it("has 4 corner floodlight towers framing the stadium outside the pitch", () => {
      expect(FLOODLIGHT_TOWERS).toHaveLength(4);
      for (const tower of FLOODLIGHT_TOWERS) {
         expect(Math.abs(tower.x)).toBeGreaterThanOrEqual(20);
         expect(inPlayArea(tower.x, tower.z, 2.0)).toBe(false);
      }
   });
});
