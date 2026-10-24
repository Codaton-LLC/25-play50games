import { describe, expect, it } from "vitest";
import type { ScreenRect } from "@/arcade3d/core/safeArea";
import { EDGE, GAP, placeCards, stripRect } from "./layout";

const rect = (left: number, top: number, right: number, bottom: number): ScreenRect => ({ left, top, right, bottom });
// Shell chips + mute/pause and the game's HUD panel, as measured in the headless playtest.
const chips = (w: number, panelBottom: number) => [rect(10, 10, 68, 52), rect(74, 10, 137, 52), rect(w - 104, 10, w - 60, 54), rect(w - 54, 10, w - 10, 54), rect(12, panelBottom - 40, Math.min(w - 12, 594), panelBottom)];
const rock = (w: number, bottom: number) => [rect(w - 92, bottom - 72, w - 20, bottom)];
const banner = (w: number, h: number, top: number) => [rect(0, top, w, h)];
const SIZES = {
   "1280x800 closed": { width: 1280, height: 800, hud: chips(1280, 111), controls: [], obstructions: [] },
   "1280x800 open": { width: 1280, height: 800, hud: chips(1280, 111), controls: [], obstructions: banner(1280, 800, 700) },
   "390x844 closed": { width: 390, height: 844, hud: chips(390, 134), controls: rock(390, 824), obstructions: [] },
   "390x844 open": { width: 390, height: 844, hud: chips(390, 134), controls: rock(390, 656), obstructions: banner(390, 844, 676) },
   "360x740 closed": { width: 360, height: 740, hud: chips(360, 134), controls: rock(360, 720), obstructions: [] },
   "360x740 open": { width: 360, height: 740, hud: chips(360, 134), controls: rock(360, 531), obstructions: banner(360, 740, 551) },
   "844x390 closed": { width: 844, height: 390, hud: chips(844, 84), controls: rock(844, 370), obstructions: [] },
   "844x390 open": { width: 844, height: 390, hud: chips(844, 84), controls: rock(844, 285), obstructions: banner(844, 390, 305) },
};
const apart = (a: ScreenRect, b: ScreenRect) => a.right + GAP <= b.left || b.right + GAP <= a.left || a.bottom + GAP <= b.top || b.bottom + GAP <= a.top;

describe("upgrade card placement", () => {
   for (const [name, area] of Object.entries(SIZES)) it(`fits clear of chips, Rock and banner at ${name}`, () => {
      const p = placeCards(area), s = stripRect(p);
      expect(p.fits).toBe(true);
      expect(p.height).toBeGreaterThanOrEqual(44); expect(p.width).toBeGreaterThanOrEqual(44);
      expect(s.left).toBeGreaterThanOrEqual(EDGE); expect(s.top).toBeGreaterThanOrEqual(EDGE);
      expect(s.right).toBeLessThanOrEqual(area.width - EDGE); expect(s.bottom).toBeLessThanOrEqual(area.height - EDGE);
      for (const r of [...area.hud, ...area.controls, ...area.obstructions]) expect(apart(s, r)).toBe(true);
   });
   it("sits low (thumb reach) and centred when nothing is in the way", () => {
      const p = placeCards(SIZES["1280x800 closed"]);
      expect(p).toMatchObject({ column: false, width: 144, height: 88 });
      expect(stripRect(p).bottom).toBe(792); expect(p.left).toBe(492);
   });
   it("rises above the Rock button on a narrow portrait phone", () => {
      const area = SIZES["360x740 open"], s = stripRect(placeCards(area));
      expect(s.bottom).toBeLessThanOrEqual(area.controls[0].top - GAP);
   });
   it("uses the wide row on a landscape phone", () => {
      expect(placeCards(SIZES["844x390 open"])).toMatchObject({ column: false, width: 176, height: 72 });
   });
   it("falls back below the HUD without a measured area", () => {
      expect(placeCards({ width: 0, height: 0, hud: [], controls: [], obstructions: [] }).fits).toBe(true);
   });
});
