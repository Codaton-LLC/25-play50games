import { describe, expect, it } from "vitest";
import {
   REFLEX_MAX_PAD,
   REFLEX_MAX_PROMPT,
   REFLEX_MIN_CELL_DESKTOP,
   REFLEX_MIN_CELL_ROW_PHONE,
   REFLEX_MIN_CELL_TOUCH,
   REFLEX_MIN_PROMPT,
   REFLEX_MIN_PROMPT_ROW_PHONE,
   reflexBudget,
   reflexInnerWidth,
   reflexLayout,
   type ReflexViewport,
} from "./ReflexArrow.layout";

function vp(width: number, height: number): ReflexViewport {
   return { width, height, isMobile: width < 640, isTablet: width >= 640 && width < 1024, isShort: height < 560 };
}

/** The pair's extent in the direction it is laid out must fit the room it was given. */
function fits(l: ReturnType<typeof reflexLayout>, v: ReflexViewport): void {
   expect(l.padSize).toBe(l.cell * 3 + l.gap * 2);
   if (l.arrangement === "row") {
      expect(l.padSize + l.stageGap + l.promptSize).toBeLessThanOrEqual(reflexInnerWidth(v));
      expect(l.padSize).toBeLessThanOrEqual(Math.max(l.padSize, reflexBudget(v)));
   } else {
      expect(l.padSize).toBeLessThanOrEqual(reflexInnerWidth(v));
   }
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
      fits(tab, vp(820, 1180));
   });

   it("stacks on a 390 x 844 phone with buttons of at least 64 px, above the cookie banner", () => {
      const v = vp(390, 844);
      const l = reflexLayout(v);
      expect(l.arrangement).toBe("stack");
      expect(l.cell).toBeGreaterThanOrEqual(REFLEX_MIN_CELL_TOUCH);
      expect(l.promptSize).toBeGreaterThanOrEqual(REFLEX_MIN_PROMPT.mobile);
      expect(l.padSize + l.stageGap + l.promptSize).toBeLessThanOrEqual(reflexBudget(v));
      fits(l, v);
   });

   it("puts the prompt beside the pad on a 360 x 740 phone and fits the card's real width", () => {
      const v = vp(360, 740);
      const l = reflexLayout(v);
      expect(l.arrangement).toBe("row");
      expect(l.cell).toBeGreaterThanOrEqual(REFLEX_MIN_CELL_ROW_PHONE);
      expect(l.promptSize).toBeGreaterThanOrEqual(REFLEX_MIN_PROMPT_ROW_PHONE);
      // the engine's 51 px side room and the 183 px banner at this width are counted
      expect(reflexInnerWidth(v)).toBe(360 - 51 - 48);
      expect(reflexBudget(v)).toBe(740 - 520 - 21);
      expect(l.padSize + l.stageGap + l.promptSize).toBeLessThanOrEqual(reflexInnerWidth(v));
      expect(l.padSize).toBeLessThanOrEqual(reflexBudget(v));
   });

   it("puts the prompt beside the pad on a short desktop viewport (1180 x 820)", () => {
      const v = vp(1180, 820);
      const l = reflexLayout(v);
      expect(l.arrangement).toBe("row");
      expect(l.cell).toBeGreaterThanOrEqual(REFLEX_MIN_CELL_DESKTOP);
      expect(l.promptSize).toBe(REFLEX_MAX_PROMPT.desktop);
      expect(l.padSize).toBeLessThanOrEqual(820 - 532);
      fits(l, v);
   });

   it("never draws a cell under the row minimum on a phone, however short, and 64 px when stacked", () => {
      for (let vh = 320; vh <= 1200; vh += 40) {
         const v = vp(390, vh);
         const l = reflexLayout(v);
         expect(l.cell).toBeGreaterThanOrEqual(l.arrangement === "stack" ? REFLEX_MIN_CELL_TOUCH : REFLEX_MIN_CELL_ROW_PHONE);
         expect(l.promptSize).toBeGreaterThanOrEqual(REFLEX_MIN_PROMPT_ROW_PHONE);
         expect(l.promptSize).toBeLessThanOrEqual(REFLEX_MAX_PROMPT.mobile);
         expect(l.cellIcon).toBeGreaterThanOrEqual(28);
         fits(l, v);
      }
   });

   it("keeps the classic stack inside a narrow 320 px phone where a row would not fit the width", () => {
      const v = vp(320, 480);
      const l = reflexLayout(v);
      expect(l.arrangement).toBe("stack");
      expect(l.cell).toBeGreaterThanOrEqual(REFLEX_MIN_CELL_TOUCH);
      expect(l.padSize).toBeLessThanOrEqual(reflexInnerWidth(v));
   });
});
