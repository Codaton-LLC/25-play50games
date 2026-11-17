import { describe, expect, it } from "vitest";
import {
   FALLING_DESKTOP_MAX_HEIGHT,
   FALLING_MIN_HEIGHT,
   FALLING_PHONE_MAX_HEIGHT,
   fieldHeightFor,
   objectBaseFor,
   objectHitSize,
} from "./FallingObjects.layout";

describe("fieldHeightFor", () => {
   it("keeps the classic 500 px where it fits (portrait tablet)", () => {
      expect(fieldHeightFor(820, 1180)).toBe(FALLING_DESKTOP_MAX_HEIGHT);
      expect(fieldHeightFor(1280, 1000)).toBe(FALLING_DESKTOP_MAX_HEIGHT);
   });

   it("sizes a phone field from the viewport, capped at the old 400 px", () => {
      expect(fieldHeightFor(390, 844)).toBe(324);
      expect(fieldHeightFor(390, 1000)).toBe(FALLING_PHONE_MAX_HEIGHT);
      expect(fieldHeightFor(360, 740)).toBe(FALLING_MIN_HEIGHT);
   });

   it("fits a landscape tablet and a short landscape phone", () => {
      expect(fieldHeightFor(1180, 820)).toBe(380);
      expect(fieldHeightFor(390, 540)).toBe(FALLING_MIN_HEIGHT);
      expect(fieldHeightFor(844, 390)).toBe(FALLING_MIN_HEIGHT);
   });

   it("never leaves the [220, max] band", () => {
      for (let vh = 300; vh <= 1400; vh += 50) {
         for (const vw of [360, 390, 820, 1180]) {
            const h = fieldHeightFor(vw, vh);
            expect(h).toBeGreaterThanOrEqual(FALLING_MIN_HEIGHT);
            expect(h).toBeLessThanOrEqual(vw < 640 ? FALLING_PHONE_MAX_HEIGHT : FALLING_DESKTOP_MAX_HEIGHT);
         }
      }
   });
});

describe("object sizes", () => {
   it("keeps the drawn base of 64 px on phones and 72 px elsewhere", () => {
      expect(objectBaseFor(true)).toBe(64);
      expect(objectBaseFor(false)).toBe(72);
   });

   it("gives a big object its drawn size and a tiny one the 44 px minimum", () => {
      expect(objectHitSize(64, 1.1, 44)).toBe(70);
      expect(objectHitSize(72, 1.3, 44)).toBe(94);
      expect(objectHitSize(64, 0.4, 44)).toBe(44); // level 15: drawn at 26 px, tapped at 44 px
      expect(objectHitSize(72, 0.6, 44)).toBe(44);
      expect(objectHitSize(64, 0.7, 44)).toBe(45);
   });
});
