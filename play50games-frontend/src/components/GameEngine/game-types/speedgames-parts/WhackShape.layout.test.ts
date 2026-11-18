import { describe, expect, it } from "vitest";
import { WHACK_MIN_SIZE_FACTOR, whackArenaHeight, whackShapeBase } from "./WhackShape.layout";

describe("whackShapeBase", () => {
   it("keeps the classic 54 px on a mouse desktop", () => {
      expect(whackShapeBase({ isMobile: false, isTablet: false, isTouch: false })).toBe(54);
   });

   it("gives every touch device a shape that is still >= 44 px at the smallest size factor", () => {
      for (const vp of [
         { isMobile: true, isTablet: false, isTouch: true },
         { isMobile: false, isTablet: true, isTouch: true },
         { isMobile: false, isTablet: false, isTouch: true },
      ]) {
         expect(whackShapeBase(vp) * WHACK_MIN_SIZE_FACTOR).toBeGreaterThanOrEqual(44);
      }
   });
});

describe("whackArenaHeight", () => {
   const phone = { isMobile: true, isTablet: false, isTouch: true };
   const tablet = { isMobile: false, isTablet: true, isTouch: true };
   const desktop = { isMobile: false, isTablet: false, isTouch: false };

   it("keeps 380 on desktop whatever the height", () => {
      expect(whackArenaHeight({ ...desktop, height: 600 })).toBe(380);
      expect(whackArenaHeight({ ...desktop, height: 1200 })).toBe(380);
   });

   it("leaves room for the engine bar, controls and cookie banner on phones", () => {
      expect(whackArenaHeight({ ...phone, height: 844 })).toBe(306);
      expect(whackArenaHeight({ ...phone, height: 740 })).toBe(202);
      expect(whackArenaHeight({ ...phone, height: 1000 })).toBe(380);
   });

   it("never goes under 200 px on a short phone viewport", () => {
      expect(whackArenaHeight({ ...phone, height: 540 })).toBe(200);
      expect(whackArenaHeight({ ...phone, height: 390 })).toBe(200);
   });

   it("gives tablets the full arena in portrait and a bounded one when short", () => {
      expect(whackArenaHeight({ ...tablet, height: 1180 })).toBe(380);
      expect(whackArenaHeight({ ...tablet, height: 700 })).toBe(240);
   });
});
