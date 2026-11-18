// The classic Logic games' mobile stage: which screens count as compact (the score bar is scrolled into
// view when a game starts there), and the bottom bar measure is safe without a DOM.
import { describe, expect, it } from "vitest";
import { bottomObstruction, isCompactScreen } from "./useMobileFit";

describe("isCompactScreen", () => {
   it("phones and tablets are compact, a desktop window is not", () => {
      expect(isCompactScreen(390, 844, true)).toBe(true);
      expect(isCompactScreen(360, 740, true)).toBe(true);
      expect(isCompactScreen(820, 1180, true)).toBe(true);
      expect(isCompactScreen(1180, 820, true)).toBe(true);
      expect(isCompactScreen(1440, 900, false)).toBe(false);
      expect(isCompactScreen(1280, 680, false)).toBe(true);
   });
});

describe("bottomObstruction", () => {
   it("is 0 without a window (server render)", () => {
      expect(bottomObstruction()).toBe(0);
   });
});
