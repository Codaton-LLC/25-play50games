import { describe, expect, it } from "vitest";
import { fitView } from "@/arcade3d/core/view";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { AIM_Z, FOV, environment, kitchenBox, panHalf, viewFor, windowHalf } from "./looks";
import { TUNING, kitchenHalf, stations } from "./rules";

describe("pizza-kitchen-3d camera", () => {
   for (const portrait of [false, true]) {
      it(`${portrait ? "portrait" : "landscape"}: the window holds the station the cook stands at and both neighbours' fronts, and never pans past the row`, () => {
         for (const id of LEVEL_IDS) {
            const l = LEVELS[id];
            const w = windowHalf(l, portrait);
            const pan = panHalf(l, portrait);
            expect(pan + w).toBeCloseTo(Math.max(w, kitchenHalf(l)), 10);
            for (const s of stations(l)) {
               const aim = Math.max(-pan, Math.min(pan, s.x));
               expect(s.x - TUNING.spacing / 2).toBeGreaterThanOrEqual(aim - w - 1e-9);
               expect(s.x + TUNING.spacing / 2).toBeLessThanOrEqual(aim + w + 1e-9);
            }
            // the window is the kitchen strip itself: counters at the back, the cook's 2 m strip at the front
            const area = viewFor(id, portrait).area;
            expect(area.min.z).toBe(kitchenBox(l).min.z);
            expect(area.max.z).toBe(TUNING.maxZ + 0.3);
            expect((area.min.z + area.max.z) / 2).toBeCloseTo(AIM_Z, 10);
         }
      });
   }

   it("a phone fit of L5 shows stations at a readable size, and the fog starts behind the fitted camera's view", () => {
      for (const [width, height] of [[390, 844], [1280, 800]] as const) {
         for (const id of LEVEL_IDS) {
            const portrait = width < height;
            const v = fitView({ ...viewFor(id, portrait), width, height, fov: FOV });
            const fog = environment(LEVELS[id]).fog;
            // the far edge of the window (counter line) sits well inside the fog's near distance
            expect(v.distance + 6).toBeLessThan(fog[1]);
            // one station (1.6 m) spans at least 1/9 of the screen width
            const px = (TUNING.spacing / (2 * windowHalf(LEVELS[id], portrait))) * width;
            expect(px).toBeGreaterThanOrEqual(width / 9);
         }
      }
   });
});
