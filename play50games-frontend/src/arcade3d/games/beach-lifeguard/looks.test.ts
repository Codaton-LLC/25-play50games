import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { DECOR_BACK_Z, aimBounds, beachBox, decorSpots } from "./looks";
import { SAND_DEPTH } from "./rules";

describe("beach-lifeguard decor and camera", () => {
   it("decor stands behind the sand or past the beach's ends, never where the lifeguard walks", () => {
      for (const id of LEVEL_IDS) {
         const half = LEVELS[id].width / 2;
         const { palms, huts } = decorSpots(id);
         for (const s of [...palms, ...huts]) {
            const behind = s.z >= DECOR_BACK_Z;
            const pastEnds = Math.abs(s.x) >= half + 3.5;
            expect(behind || pastEnds).toBe(true);
            expect(s.z).toBeGreaterThanOrEqual(0);
            expect(s.scale).toBeGreaterThan(1);
         }
         // a 4.6 m palm behind the sand never reaches over the lifeguard at the back of the sand (50 deg pitch)
         expect(DECOR_BACK_Z - SAND_DEPTH).toBeGreaterThan(4.6 / Math.tan((50 * Math.PI) / 180) - 0.5);
      }
   });

   it("the camera aim stays over the beach", () => {
      for (const id of LEVEL_IDS) {
         const a = aimBounds(LEVELS[id]);
         const b = beachBox(LEVELS[id]);
         expect(a.min.x).toBeGreaterThanOrEqual(b.min.x);
         expect(a.max.x).toBeLessThanOrEqual(b.max.x);
         expect(a.min.z).toBeGreaterThanOrEqual(b.min.z);
         expect(a.max.z).toBeLessThanOrEqual(b.max.z);
      }
   });
});
