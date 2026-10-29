// Hud.tsx panelTop: the battery panel sits under the shell chips, also when they wrap on a phone.
import { describe, expect, it } from "vitest";
import type { SafeArea } from "@/arcade3d/core/safeArea";
import { panelTop } from "./Hud";

const area = (height: number, hud: { top: number; bottom: number }[]): SafeArea =>
   ({ width: 390, height, hud: hud.map((r) => ({ left: 0, right: 100, ...r })), controls: [], obstructions: [], insetBottom: 0 }) as unknown as SafeArea;

describe("delivery-drone battery panel", () => {
   it("keeps its CSS spot under one chip row, moves below two wrapped rows, ignores itself", () => {
      expect(panelTop(area(800, []))).toBe(72);
      expect(panelTop(area(800, [{ top: 10, bottom: 50 }]))).toBe(72);
      expect(panelTop(area(844, [{ top: 10, bottom: 100 }]))).toBe(108);
      expect(panelTop(area(844, [{ top: 10, bottom: 100 }, { top: 108, bottom: 170 }]))).toBe(108);
      expect(panelTop(area(390, [{ top: 6, bottom: 44 }]))).toBe(52);
   });
});
