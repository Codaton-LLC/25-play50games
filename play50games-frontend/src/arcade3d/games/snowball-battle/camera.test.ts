// Kid >= 40 CSS px, a 0.50 m ball >= 14, the 0.92 m landing ring >= 24.
// Desktop (banner open) keeps the whole yard, every fort and both opening rivals on screen.
import { describe, expect, it } from "vitest";
import { PerspectiveCamera } from "three";
import { BEANIE, SCARF } from "./looks";
import { FOV, aimAt, fitScreen, pixelsTall, placeFollowCamera, projectPoint } from "./camera";
import { KID, THROW, YARD, createRun } from "./rules";

const CAM = new PerspectiveCamera(FOV, 1, 0.1, 200);
/** Outer radius of the landing ring in Balls.tsx (ringGeometry 0.28–0.46). */
const RING = 0.46;
/** Open cookie banner: phone portrait 92, phone landscape 72, desktop 80. */
const VIEWS: ReadonlyArray<readonly [number, number, number]> = [
   [390, 844, 92],
   [844, 390, 72],
   [1280, 800, 80],
];

function place(width: number, height: number, banner: number, x: number, z: number) {
   const view = fitScreen(width, height, banner);
   const aim = aimAt(x, z, width, height);
   placeFollowCamera(CAM, view, aim.x, aim.z, width, height);
   return view;
}

function onScreen(x: number, y: number, z: number, width: number, height: number, banner: number): boolean {
   const p = projectPoint(CAM, x, y, z, width, height);
   return p !== null && p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height - banner;
}

describe("snowball-battle camera", () => {
   it("keeps the kid, a rival and the ball readable at 390×844 with the cookie banner open", () => {
      const width = 390;
      const height = 844;
      const view = place(width, height, 92, YARD.startX, YARD.startZ);
      expect(view.yaw).toBe(0);
      const kid = pixelsTall(CAM, width, height, YARD.startX, 0, KID.height, YARD.startZ);
      const ball = pixelsTall(CAM, width, height, YARD.startX, 0.15, 0.15 + THROW.ballR * 2, YARD.startZ);
      const ringL = projectPoint(CAM, YARD.startX - RING, 0.04, YARD.startZ, width, height);
      const ringR = projectPoint(CAM, YARD.startX + RING, 0.04, YARD.startZ, width, height);
      const ring = ringL && ringR ? Math.abs(ringL.x - ringR.x) : 0;
      const rivalZ = YARD.startZ - 4;
      const rival = pixelsTall(CAM, width, height, YARD.startX, 0, KID.height, rivalZ);
      const beanie = pixelsTall(
         CAM,
         width,
         height,
         YARD.startX,
         1.05,
         1.05 + BEANIE.radius * 2 * BEANIE.scaleY,
         YARD.startZ,
      );
      const scarf = pixelsTall(CAM, width, height, YARD.startX, 0.7, 0.7 + SCARF.tube * 2, YARD.startZ);
      expect(kid, `dist ${view.distance.toFixed(2)}`).toBeGreaterThanOrEqual(40);
      expect(ball, `kid ${kid.toFixed(1)} ball ${ball.toFixed(1)} dist ${view.distance.toFixed(2)}`).toBeGreaterThanOrEqual(14);
      expect(ring, `ring ${ring.toFixed(1)}`).toBeGreaterThanOrEqual(24);
      expect(rival).toBeGreaterThanOrEqual(40);
      expect(beanie).toBeGreaterThanOrEqual(12);
      expect(scarf).toBeGreaterThanOrEqual(4);
      const head = projectPoint(CAM, YARD.startX, KID.height, YARD.startZ, width, height);
      const feet = projectPoint(CAM, YARD.startX, 0, YARD.startZ, width, height);
      expect(head).toBeTruthy();
      expect(feet).toBeTruthy();
      expect(head!.y).toBeGreaterThan(96);
      expect(feet!.y).toBeLessThan(height - 92);
   });

   it("stays readable in landscape and on the desktop window with the banner open", () => {
      for (const [w, h, banner] of [[844, 390, 72], [1280, 800, 80]] as const) {
         const view = place(w, h, banner, 0, 0);
         const aim = aimAt(0, 0, w, h);
         expect(view.yaw).toBe(0);
         const kidPx = pixelsTall(CAM, w, h, aim.x, 0, KID.height, aim.z);
         const ballPx = pixelsTall(CAM, w, h, aim.x, 0.15, 0.15 + THROW.ballR * 2, aim.z);
         const ringL = projectPoint(CAM, aim.x - RING, 0.04, aim.z, w, h);
         const ringR = projectPoint(CAM, aim.x + RING, 0.04, aim.z, w, h);
         const ring = ringL && ringR ? Math.abs(ringL.x - ringR.x) : 0;
         expect(kidPx, `${w}x${h} dist ${view.distance.toFixed(2)}`).toBeGreaterThanOrEqual(40);
         expect(ballPx, `${w}x${h} kid ${kidPx.toFixed(1)} ball ${ballPx.toFixed(1)}`).toBeGreaterThanOrEqual(14);
         expect(ring, `${w}x${h} ring ${ring.toFixed(1)}`).toBeGreaterThanOrEqual(24);
      }
   });

   it("holds the whole yard and every fort on screen at the three sizes with the banner open", () => {
      const corners = [
         [YARD.minX, YARD.minZ],
         [YARD.maxX, YARD.minZ],
         [YARD.minX, YARD.maxZ],
         [YARD.maxX, YARD.maxZ],
      ] as const;
      const spots = [[YARD.startX, YARD.startZ], [0, 0], [-8, -6], [8, 4]] as const;
      for (const [w, h, banner] of VIEWS) {
         const desktop = Math.min(w, h) >= 600;
         for (const seed of [1, 2, 7]) {
            const run = createRun(seed, false);
            const poses = desktop ? spots : ([[YARD.startX, YARD.startZ]] as const);
            for (const at of poses) {
               place(w, h, banner, at[0], at[1]);
               const aim = aimAt(at[0], at[1], w, h);
               const kid = pixelsTall(CAM, w, h, aim.x, 0, KID.height, aim.z);
               expect(kid, `${w}x${h} seed ${seed} at ${at}`).toBeGreaterThanOrEqual(40);
               let forts = 0;
               for (const fort of run.forts) {
                  if (onScreen(fort.x, 0.7, fort.z, w, h, banner)) forts += 1;
               }
               let yard = 0;
               for (const [x, z] of corners) if (onScreen(x, 0, z, w, h, banner)) yard += 1;
               if (desktop) {
                  expect(forts, `${w}x${h} seed ${seed} at ${at}`).toBe(7);
                  expect(yard, `${w}x${h} seed ${seed} at ${at}`).toBe(4);
                  for (let i = 1; i <= 2; i++) {
                     const rival = run.kids[i];
                     expect(onScreen(rival.x, KID.height * 0.5, rival.z, w, h, banner), `${w} rival ${i} seed ${seed}`).toBe(true);
                  }
               } else {
                  expect(forts, `${w}x${h} seed ${seed} f${forts} y${yard}`).toBeGreaterThanOrEqual(h >= w ? 2 : 5);
               }
            }
         }
      }
   });
});
