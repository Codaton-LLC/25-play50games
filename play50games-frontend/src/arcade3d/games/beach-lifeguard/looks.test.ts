import { describe, expect, it } from "vitest";
import { fitView } from "@/arcade3d/core/view";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { END_GAP, FOG_NEAR, FOV, SOUTH_DECOR_MAX_H, aimBounds, beachBox, decorSpots, fogFor, viewFor, viewWindow } from "./looks";
import { SAND_DEPTH } from "./rules";

describe("beach-lifeguard decor and camera", () => {
   it("decor is outside the play rectangle: tall only past the beach ends, low on the camera side, none in the sea", () => {
      for (const id of LEVEL_IDS) {
         const half = LEVELS[id].width / 2;
         const d = decorSpots(id);
         for (const s of [...d.palms, ...d.huts]) {
            expect(Math.abs(s.x)).toBeGreaterThanOrEqual(half + END_GAP);
            expect(s.z).toBeGreaterThanOrEqual(0);
         }
         for (const s of [...d.castles, ...d.coolers]) {
            expect(s.z).toBeGreaterThan(SAND_DEPTH);
            expect(s.scale ?? 1).toBeLessThan(SOUTH_DECOR_MAX_H);
         }
         expect(d.palms.length).toBeGreaterThan(6);
         expect(d.castles.length + d.coolers.length).toBeGreaterThan(4);
      }
   });

   it("the camera aim stays over the beach on both window shapes", () => {
      for (const id of LEVEL_IDS) {
         for (const portrait of [false, true]) {
            const a = aimBounds(LEVELS[id], portrait);
            const b = beachBox(LEVELS[id]);
            expect(a.min.x).toBeGreaterThanOrEqual(b.min.x);
            expect(a.max.x).toBeLessThanOrEqual(b.max.x);
            expect(a.min.z).toBeGreaterThanOrEqual(b.min.z);
            expect(a.max.z).toBeLessThanOrEqual(b.max.z);
         }
      }
   });

   it("fog starts past the aim at 390 x 844 and 1280 x 800, so the lifeguard is never fogged; portrait comes in closer", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const distances = [
            { w: 390, h: 844, portrait: true },
            { w: 1280, h: 800, portrait: false },
         ].map(({ w, h, portrait }) => {
            const { distance } = fitView({ ...viewFor(id, portrait), width: w, height: h, fov: FOV });
            const fog = fogFor(level, distance, portrait);
            expect(fog.near).toBeGreaterThanOrEqual(distance + viewWindow(level, portrait).z * 0.5 - 1e-9);
            expect(fog.near).toBeGreaterThanOrEqual(FOG_NEAR);
            expect(fog.far - fog.near).toBeCloseTo(level.fogFar - FOG_NEAR, 9);
            return distance;
         });
         // the old 18 m window put the portrait camera this far back: the narrow one comes in to well under it
         const old = fitView({ ...viewFor(id, false), width: 390, height: 844, fov: FOV }).distance;
         expect(distances[0]).toBeLessThan(old * 0.6);
         expect(viewWindow(level, true).x * 2).toBeLessThanOrEqual(9);
      }
   });
});
