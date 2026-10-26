import { describe, expect, it } from "vitest";
import { fitView } from "@/arcade3d/core/view";
import { LEVEL_IDS } from "@/arcade3d/types";
import { FOG_NEAR_MIN, FOG_SPAN, FOV, VIEW_WINDOW, fogRange, viewFor } from "./looks";

describe("mars-rover-mission fog and camera", () => {
   it("at 390 x 844 and 1280 x 800 the fog starts past the aim on every level, so the rover is never fogged; L4's dust is the thickest", () => {
      for (const id of LEVEL_IDS) {
         for (const [w, h] of [[390, 844], [1280, 800]]) {
            const { distance } = fitView({ ...viewFor(id), width: w, height: h, fov: FOV });
            const fog = fogRange(id, distance);
            // the rover sits at the aim, `distance` from the camera; the window's near half is clear too
            expect(fog.near).toBeGreaterThan(distance);
            expect(fog.near).toBeGreaterThanOrEqual(distance + VIEW_WINDOW.z * 0.5 - 1e-9);
            expect(fog.near).toBeGreaterThanOrEqual(FOG_NEAR_MIN[id]);
            expect(fog.far - fog.near).toBe(FOG_SPAN[id]);
         }
      }
      for (const id of [1, 2, 3, 5] as const) expect(FOG_SPAN[4]).toBeLessThan(FOG_SPAN[id]);
   });
   it("a portrait phone fits from farther back than a desk, and the fog moves out with it", () => {
      for (const id of LEVEL_IDS) {
         const phone = fitView({ ...viewFor(id), width: 390, height: 844, fov: FOV }).distance;
         const desk = fitView({ ...viewFor(id), width: 1280, height: 800, fov: FOV }).distance;
         expect(phone).toBeGreaterThan(desk);
         expect(fogRange(id, phone).near).toBeGreaterThanOrEqual(fogRange(id, desk).near);
      }
   });
});
