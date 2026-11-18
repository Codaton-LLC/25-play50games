import { describe, expect, it } from "vitest";
import { KEYBOARD_MIN_PX, keyboardInset, playAreaMaxHeight } from "./TypingSprint.layout";

describe("keyboardInset", () => {
   it("is 0 when the visual viewport equals the layout viewport", () => {
      expect(keyboardInset(844, 844)).toBe(0);
   });

   it("ignores small differences (browser chrome, scrollbars)", () => {
      expect(keyboardInset(844, 844 - KEYBOARD_MIN_PX + 1)).toBe(0);
   });

   it("reports the keyboard band on a phone and a tablet", () => {
      expect(keyboardInset(844, 540)).toBe(304);
      expect(keyboardInset(1180, 830)).toBe(350);
   });

   it("subtracts the visual viewport's offset (iOS scrolls the layout viewport under the keyboard)", () => {
      expect(keyboardInset(844, 540, 100)).toBe(204);
      expect(keyboardInset(844, 540, 304)).toBe(0);
   });

   it("is 0 for nonsense input", () => {
      expect(keyboardInset(0, 540)).toBe(0);
      expect(keyboardInset(844, 0)).toBe(0);
      expect(keyboardInset(Number.NaN, 540)).toBe(0);
   });
});

describe("playAreaMaxHeight", () => {
   it("does not cap while the keyboard is down", () => {
      expect(playAreaMaxHeight(844, 0)).toBeNull();
   });

   it("caps to the visible height while the keyboard is up, never below 160 px", () => {
      expect(playAreaMaxHeight(540, 304)).toBe(540);
      expect(playAreaMaxHeight(120.7, 400)).toBe(160);
   });
});
