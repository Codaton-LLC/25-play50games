import { describe, expect, it } from "vitest";
import { fitEyeShift } from "@/arcade3d/core/view";
import {
   BAND,
   BEAM_CLEAR_RAD,
   EYE_Y,
   FOV,
   PADDING,
   figurePixels,
   pointInRect,
   projectWorld,
   radarRect,
   rectsOverlap,
   shellHud,
} from "./looks";
import { makePedestal, wrapAngle } from "./rules";

const BANNER = 85;
const SIZES = [
   [390, 844],
   [844, 390],
] as const;
const YAWS = [0, 0.4, Math.PI / 2, 1.2, Math.PI, -1.1, 2.4, -2.2];

describe("museum-guard eye", () => {
   it("fits the far band at phone portrait and landscape with the banner open", () => {
      for (const [width, height] of SIZES) {
         const eye = fitEyeShift({
            band: BAND,
            fov: FOV,
            eyeY: EYE_Y,
            padding: PADDING,
            width,
            height,
            avoid: [...shellHud(width, height, BANNER), radarRect(width, height, BANNER)],
         });
         expect(eye.fits).toBe(true);
         expect(eye.overflow).toBe(0);
      }
   });

   it("keeps a far penguin at least 24 CSS px tall", () => {
      const portrait = figurePixels(0.8, 6, 390, 844);
      const landscape = figurePixels(0.8, 6, 844, 390);
      expect(portrait).toBeGreaterThanOrEqual(24);
      expect(landscape).toBeGreaterThanOrEqual(24);
      expect(portrait).toBeGreaterThan(landscape);
      expect(portrait).toBeGreaterThan(60);
      expect(landscape).toBeGreaterThan(30);
   });

   it("puts the radar clear of the shell HUD and of statues inside the beam", () => {
      for (const [width, height] of SIZES) {
         const radar = radarRect(width, height, BANNER);
         for (const panel of shellHud(width, height, BANNER)) expect(rectsOverlap(radar, panel)).toBe(false);
         for (const yaw of YAWS) {
            for (let i = 0; i < 8; i += 1) {
               const ped = makePedestal(i);
               if (Math.abs(wrapAngle(ped.angle - yaw)) > BEAM_CLEAR_RAD) continue;
               const body = projectWorld(ped.x, 1.2, ped.z, width, height, yaw);
               expect(pointInRect(body, radar)).toBe(false);
            }
         }
      }
   });
});
