// The ball-roll's shell, built in code from each hero's colours: two geometries (two draw calls),
// shingled plates between radius 1 and 1 + the step, its colours between the plate and its dark.
import { describe, expect, it } from "vitest";
import { Color } from "three";
import { M2_HERO_IDS } from "@/arcade3d/menu2/heroModels";
import { BALL_PLATES, buildHeroBallGeometry } from "./HeroBall";
import { HERO_LOOK } from "./heroAnimLandmarks";

describe("the hero ball", () => {
   for (const id of M2_HERO_IDS) {
      it(`${id}: plates in its own colours, seams round the roll axis`, () => {
         const { plates, seams } = buildHeroBallGeometry(HERO_LOOK[id]);
         const pos = plates.getAttribute("position");
         const col = plates.getAttribute("color");
         expect(col.count).toBe(pos.count);
         let rMin = Infinity;
         let rMax = 0;
         for (let i = 0; i < pos.count; i++) {
            const r = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i));
            rMin = Math.min(rMin, r);
            rMax = Math.max(rMax, r);
         }
         expect(rMin).toBeGreaterThan(0.999);
         expect(rMax).toBeLessThan(1.05);
         const plate = new Color(HERO_LOOK[id].plate);
         const dark = new Color(HERO_LOOK[id].plateDark);
         let brightest = 0;
         for (let i = 0; i < col.count; i++) {
            const g = col.getX(i) + col.getY(i) + col.getZ(i);
            brightest = Math.max(brightest, g);
            expect(g).toBeGreaterThanOrEqual(Math.min(dark.r + dark.g + dark.b, plate.r + plate.g + plate.b) - 1e-4);
         }
         expect(brightest).toBeCloseTo(plate.r + plate.g + plate.b, 1);
         // four great circles through the poles + the equator, merged into one geometry
         expect(seams.getAttribute("position").count).toBe(5 * 7 * 65);
         expect(BALL_PLATES).toBe(8);
         plates.dispose();
         seams.dispose();
      });
   }
});
