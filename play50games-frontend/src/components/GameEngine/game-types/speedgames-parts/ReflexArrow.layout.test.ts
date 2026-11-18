import { describe, expect, it } from "vitest";
import {
   REFLEX_MAX_PAD,
   REFLEX_MAX_PROMPT,
   REFLEX_MIN_CELL_DESKTOP,
   REFLEX_MIN_CELL_TOUCH,
   REFLEX_MIN_PROMPT,
   reflexLayout,
   type ReflexViewport,
} from "./ReflexArrow.layout";

function vp(width: number, height: number): ReflexViewport {
   return { width, height, isMobile: width < 640, isTablet: width >= 640 && width < 1024, isShort: height < 560 };
}

describe("reflexLayout", () => {
   it("keeps the classic stacked look on a tall desktop and tablet", () => {
      const desk = reflexLayout(vp(1920, 1080));
      expect(desk.arrangement).toBe("stack");
      expect(desk.padSize).toBeLessThanOrEqual(REFLEX_MAX_PAD.desktop);
      expect(desk.padSize).toBeGreaterThan(REFLEX_MAX_PAD.desktop - 6);
      expect(desk.promptSize).toBe(REFLEX_MAX_PROMPT.desktop);

      const tab = reflexLayout(vp(820, 1180));
      expect(tab.arrangement).toBe("stack");
      expect(tab.padSize).toBeGreaterThan(REFLEX_MAX_PAD.tablet - 6);
      expect(tab.promptSize).toBe(REFLEX_MAX_PROMPT.tablet);
      expect(tab.cell).toBeGreaterThanOrEqual(REFLEX_MIN_CELL_TOUCH);
   });

   it("stacks on a 390 x 844 phone with buttons of at least 64 px", () => {
      const l = reflexLayout(vp(390, 844));
      expect(l.arrangement).toBe("stack");
      expect(l.cell).toBeGreaterThanOrEqual(REFLEX_MIN_CELL_TOUCH);
      expect(l.promptSize).toBeGreaterThanOrEqual(REFLEX_MIN_PROMPT.mobile);
      expect(l.padSize + l.stageGap + l.promptSize).toBeLessThanOrEqual(844 - 520);
   });

   it("puts the prompt beside the pad on a 360 x 740 phone and fits the card's width", () => {
      const l = reflexLayout(vp(360, 740));
      expect(l.arrangement).toBe("row");
      expect(l.cell).toBeGreaterThanOrEqual(REFLEX_MIN_CELL_TOUCH);
      expect(l.padSize + l.stageGap + l.promptSize).toBeLessThanOrEqual(360 - 48);
      expect(l.padSize).toBeLessThanOrEqual(740 - 520);
   });

   it("puts the prompt beside the pad on a short desktop viewport (1180 x 820)", () => {
      const l = reflexLayout(vp(1180, 820));
      expect(l.arrangement).toBe("row");
      expect(l.cell).toBeGreaterThanOrEqual(REFLEX_MIN_CELL_DESKTOP);
      expect(l.promptSize).toBe(REFLEX_MAX_PROMPT.desktop);
      expect(l.padSize).toBeLessThanOrEqual(820 - 532);
   });

   it("never draws a cell under the touch minimum on a phone, however short", () => {
      for (let vh = 320; vh <= 1200; vh += 40) {
         const l = reflexLayout(vp(390, vh));
         expect(l.cell).toBeGreaterThanOrEqual(REFLEX_MIN_CELL_TOUCH);
         expect(l.padSize).toBe(l.cell * 3 + l.gap * 2);
         expect(l.promptSize).toBeGreaterThanOrEqual(REFLEX_MIN_PROMPT.mobile);
         expect(l.promptSize).toBeLessThanOrEqual(REFLEX_MAX_PROMPT.mobile);
         expect(l.cellIcon).toBeGreaterThanOrEqual(28);
      }
   });

   it("fits the row layout inside a narrow 320 px phone", () => {
      const l = reflexLayout(vp(320, 480));
      expect(l.arrangement).toBe("row");
      expect(l.padSize + l.stageGap + l.promptSize).toBeLessThanOrEqual(320 - 48 + 8);
   });
});
