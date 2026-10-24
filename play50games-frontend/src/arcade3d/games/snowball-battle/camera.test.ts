// The kid, a nearby rival and a snowball stay at least 24 CSS px tall on a phone with the banner open.
import { describe, expect, it } from "vitest";
import { PerspectiveCamera } from "three";
import { BEANIE, SCARF } from "./looks";
import { FOV, fitScreen, pixelsTall, placeFollowCamera, projectPoint } from "./camera";
import { KID, THROW, YARD } from "./rules";

const CAM = new PerspectiveCamera(FOV, 1, 0.1, 200);

describe("snowball-battle camera", () => {
   it("keeps the kid, a rival and the ball readable at 390×844 with the cookie banner open", () => {
      const width = 390;
      const height = 844;
      const view = fitScreen(width, height, 92);
      expect(view.yaw).toBe(0);
      placeFollowCamera(CAM, view, YARD.startX, YARD.startZ, width, height);
      const kid = pixelsTall(CAM, width, height, YARD.startX, 0, KID.height, YARD.startZ);
      const ball = pixelsTall(CAM, width, height, YARD.startX, 0.15, 0.15 + THROW.ballR * 2, YARD.startZ);
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
      expect(kid, `dist ${view.distance.toFixed(2)}`).toBeGreaterThanOrEqual(24);
      expect(ball, `kid ${kid.toFixed(1)} ball ${ball.toFixed(1)} dist ${view.distance.toFixed(2)}`).toBeGreaterThanOrEqual(24);
      expect(rival).toBeGreaterThanOrEqual(24);
      expect(beanie).toBeGreaterThanOrEqual(12);
      expect(scarf).toBeGreaterThanOrEqual(8);
      const head = projectPoint(CAM, YARD.startX, KID.height, YARD.startZ, width, height);
      const feet = projectPoint(CAM, YARD.startX, 0, YARD.startZ, width, height);
      expect(head).toBeTruthy();
      expect(feet).toBeTruthy();
      expect(head!.y).toBeGreaterThan(96);
      expect(feet!.y).toBeLessThan(height - 92);
   });

   it("stays readable in landscape and on the desktop window", () => {
      for (const [w, h] of [[844, 390], [1280, 800]] as const) {
         const view = fitScreen(w, h);
         expect(view.yaw).toBe(0);
         placeFollowCamera(CAM, view, 0, 0, w, h);
         const kidPx = pixelsTall(CAM, w, h, 0, 0, KID.height, 0);
         const ballPx = pixelsTall(CAM, w, h, 0, 0.15, 0.15 + THROW.ballR * 2, 0);
         expect(kidPx, `${w}x${h} dist ${view.distance.toFixed(2)}`).toBeGreaterThanOrEqual(24);
         expect(ballPx, `${w}x${h} kid ${kidPx.toFixed(1)} ball ${ballPx.toFixed(1)}`).toBeGreaterThanOrEqual(24);
      }
   });
});
