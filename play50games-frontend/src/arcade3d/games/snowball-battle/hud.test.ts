// Hud.tsx panelTop: the mittens panel sits under the shell chips, also when they wrap on a phone.
import { describe, expect, it } from "vitest";
import type { SafeArea } from "@/arcade3d/core/safeArea";
import { PANEL_TOP, panelTop } from "./Hud";

const area = (hud: { top: number; bottom: number }[]): SafeArea =>
   ({ width: 390, height: 844, hud: hud.map((r) => ({ left: 0, right: 100, ...r })), controls: [], obstructions: [], insetBottom: 0 }) as unknown as SafeArea;

describe("snowball-battle mittens panel", () => {
   it("keeps its desktop spot under one chip row, moves below two wrapped rows, ignores itself", () => {
      expect(panelTop(area([]))).toBe(PANEL_TOP);
      expect(panelTop(area([{ top: 10, bottom: 50 }]))).toBe(PANEL_TOP);
      expect(panelTop(area([{ top: 10, bottom: 100 }]))).toBe(108);
      // the panel's own rect (a safe-area panel) never pushes it further down
      expect(panelTop(area([{ top: 10, bottom: 100 }, { top: 108, bottom: 140 }]))).toBe(108);
   });
});
