import { describe, expect, it } from "vitest";
import { AVOID_RED_DESKTOP_HEIGHT, AVOID_RED_MAX_COMPACT_HEIGHT, AVOID_RED_MIN_HEIGHT, arenaHeightFor } from "./AvoidRed.layout";

describe("arenaHeightFor", () => {
   it("keeps the classic 380 px on desktops and tablets", () => {
      expect(arenaHeightFor(1280, 800)).toBe(AVOID_RED_DESKTOP_HEIGHT);
      expect(arenaHeightFor(820, 1180)).toBe(AVOID_RED_DESKTOP_HEIGHT);
      expect(arenaHeightFor(1180, 820)).toBe(AVOID_RED_DESKTOP_HEIGHT);
   });

   it("sizes a phone arena from the viewport, never below the old 300 px on the usual phones", () => {
      expect(arenaHeightFor(390, 844)).toBe(414);
      expect(arenaHeightFor(390, 900)).toBe(AVOID_RED_MAX_COMPACT_HEIGHT); // 470 capped to 420
      expect(arenaHeightFor(360, 740)).toBe(310);
      expect(arenaHeightFor(360, 640)).toBeGreaterThanOrEqual(AVOID_RED_MIN_HEIGHT);
   });

   it("keeps a short landscape phone at the minimum height so the HUD and banner still fit", () => {
      expect(arenaHeightFor(390, 540)).toBe(AVOID_RED_MIN_HEIGHT);
      expect(arenaHeightFor(844, 390)).toBe(AVOID_RED_MIN_HEIGHT);
   });

   it("never leaves the [220, 420] band on compact screens", () => {
      for (let vh = 300; vh <= 1200; vh += 50) {
         const h = arenaHeightFor(390, vh);
         expect(h).toBeGreaterThanOrEqual(AVOID_RED_MIN_HEIGHT);
         expect(h).toBeLessThanOrEqual(AVOID_RED_MAX_COMPACT_HEIGHT);
      }
   });
});
