// guide.ts: the beacon walks the list (nearest first, no flicker), then the checkout; read-only.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { PRODUCT_NAMES, SWITCH_SHARE, cartHint, hintCode, nextItem } from "./guide";
import { createRun, storeDistance } from "./rules";

describe("shopping-cart guide", () => {
   it("points at the nearest item first and at the checkout once the list is done", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(17, LEVELS[id]);
         const before = JSON.stringify(run);
         let next = nextItem(run, -1);
         expect(JSON.stringify(run)).toBe(before);
         const nearest = Math.min(...run.list.map((item) => storeDistance(run.cart, item)));
         expect(storeDistance(run.cart, run.list[next])).toBe(nearest);
         for (let n = 0; n < run.list.length; n++) {
            expect(next).toBeGreaterThanOrEqual(0);
            expect(run.list[next].collected).toBe(false);
            run.list[next].collected = true;
            run.cart.x = run.list[next].x;
            run.cart.z = run.list[next].z;
            run.collectedCount += 1;
            next = nextItem(run, next);
         }
         run.listComplete = true;
         expect(nextItem(run, next)).toBe(-1);
         expect(cartHint(run, hintCode(run, -1), false).tone).toBe("carry");
      }
   });

   it("keeps the current item unless another is clearly closer", () => {
      const run = createRun(5, LEVELS[1]);
      const first = nextItem(run, -1);
      const others = run.list.map((_, i) => i).filter((i) => i !== first);
      // a slightly closer other item does not steal the beacon
      const other = others[0];
      const keepD = storeDistance(run.cart, run.list[first]);
      const otherD = storeDistance(run.cart, run.list[other]);
      if (otherD > keepD * SWITCH_SHARE) expect(nextItem(run, first)).toBe(first);
   });

   it("names the item and the touch Ride button", () => {
      const run = createRun(8, LEVELS[1]);
      const next = nextItem(run, -1);
      const hint = cartHint(run, hintCode(run, next), true);
      expect(hint.text).toContain(PRODUCT_NAMES[run.list[next].kind]);
      expect(hint.text).toMatch(/hold Ride/);
      run.cart.stunTimer = 0.5;
      expect(cartHint(run, hintCode(run, next), false).tone).toBe("warn");
   });
});
