import { describe, expect, it } from "vitest";
import { clampZoom, keyZoom, pinchZoom, wheelZoom } from "./cameraZoom";

const L = { min: 0.5, max: 1.6 };

describe("camera zoom", () => {
   it("the wheel: down moves out, up moves in, lines count as 16 px, inside the limits", () => {
      expect(wheelZoom(1, 100, 0, L)).toBeGreaterThan(1);
      expect(wheelZoom(1, -100, 0, L)).toBeLessThan(1);
      expect(wheelZoom(1, 3, 1, L)).toBeCloseTo(wheelZoom(1, 48, 0, L), 9);
      expect(wheelZoom(1.55, 5000, 0, L)).toBe(1.6);
      expect(wheelZoom(0.52, -5000, 0, L)).toBe(0.5);
   });

   it("a pinch: spreading the fingers moves in, as on a map", () => {
      expect(pinchZoom(1, 100, 200, L)).toBeCloseTo(0.5, 9);
      expect(pinchZoom(1, 200, 160, L)).toBeCloseTo(1.25, 9);
      expect(pinchZoom(1.2, 0, 100, L)).toBe(1.2);
   });

   it("keys step 15 % and clamp", () => {
      expect(keyZoom(1, "in", L)).toBeCloseTo(1 / 1.15, 9);
      expect(keyZoom(1.5, "out", L)).toBe(1.6);
      expect(clampZoom(0.1, L)).toBe(0.5);
   });
});
