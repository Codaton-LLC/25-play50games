import { describe, expect, it } from "vitest";
import {
   TAP_BUTTON_DESKTOP,
   TAP_BUTTON_MIN,
   TAP_BUTTON_TOUCH_MAX,
   ringStroke,
   tapButtonSize,
} from "./TapCounter.layout";

const phone = (width: number, height: number) => ({ width, height, isMobile: true, isTablet: false });
const tablet = (width: number, height: number) => ({ width, height, isMobile: false, isTablet: true });
const desktop = (width: number, height: number) => ({ width, height, isMobile: false, isTablet: false });

describe("tapButtonSize", () => {
   it("grows the phone button to the 300 px cap when the screen is tall enough, never wider than the screen", () => {
      expect(tapButtonSize(phone(390, 844))).toBe(TAP_BUTTON_TOUCH_MAX);
      expect(tapButtonSize(phone(390, 900))).toBe(TAP_BUTTON_TOUCH_MAX);
      expect(tapButtonSize(phone(320, 900))).toBe(264); // 320 - 56 side room
   });

   it("sizes a small phone from its height so the ring stays above the cookie banner", () => {
      expect(tapButtonSize(phone(360, 740))).toBe(205);
      expect(tapButtonSize(phone(360, 740))).toBeGreaterThanOrEqual(200);
   });

   it("keeps a short landscape phone at the minimum and lets the page scroll", () => {
      expect(tapButtonSize(phone(390, 540))).toBe(TAP_BUTTON_MIN);
      expect(tapButtonSize(phone(844, 390))).toBe(TAP_BUTTON_MIN);
   });

   it("gives tablets the 300 px cap and desktops the classic 280", () => {
      expect(tapButtonSize(tablet(820, 1180))).toBe(TAP_BUTTON_TOUCH_MAX);
      expect(tapButtonSize(desktop(1180, 820))).toBe(TAP_BUTTON_DESKTOP);
      expect(tapButtonSize(desktop(1280, 800))).toBe(TAP_BUTTON_DESKTOP);
   });

   it("shrinks a short wide window instead of pushing the ring under the banner", () => {
      expect(tapButtonSize(desktop(1180, 700))).toBe(230);
      expect(tapButtonSize(tablet(1024, 600))).toBe(TAP_BUTTON_MIN);
   });

   it("never leaves the [160, 300] band", () => {
      for (let vh = 300; vh <= 1400; vh += 50) {
         for (const vp of [phone(360, vh), phone(390, vh), tablet(820, vh), desktop(1180, vh)]) {
            const s = tapButtonSize(vp);
            expect(s).toBeGreaterThanOrEqual(TAP_BUTTON_MIN);
            expect(s).toBeLessThanOrEqual(TAP_BUTTON_TOUCH_MAX);
         }
      }
   });
});

describe("ringStroke", () => {
   it("stays between 8 and 12 px", () => {
      expect(ringStroke(160)).toBe(8);
      expect(ringStroke(200)).toBe(8);
      expect(ringStroke(230)).toBe(10);
      expect(ringStroke(280)).toBe(12);
      expect(ringStroke(300)).toBe(12);
   });
});
