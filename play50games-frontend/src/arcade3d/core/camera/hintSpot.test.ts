import { describe, expect, it } from "vitest";
import { HINT_EDGE, HINT_GAP, cameraHintSpot } from "./hintSpot";

// a 390 x 844 phone: two rows of shell chips, a game panel top left, joystick + buttons + 📷 at the bottom
const phone = {
   width: 390,
   height: 844,
   hud: [
      { left: 10, top: 10, right: 272, bottom: 52 },
      { left: 286, top: 10, right: 380, bottom: 52 },
      { left: 10, top: 58, right: 90, bottom: 100 },
      { left: 12, top: 128, right: 64, bottom: 218 },
      { left: 312, top: 524, right: 356, bottom: 568 },
   ],
   controls: [
      { left: 20, top: 520, right: 152, bottom: 660 },
      { left: 296, top: 582, right: 372, bottom: 660 },
   ],
};

const inside = (a: { left: number; top: number; right: number; bottom: number }, b: typeof a) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

describe("camera hint spot", () => {
   it("phone: top right just under the shell chips, clear of every panel and control, high on the screen", () => {
      const w = 230, h = 52;
      const at = cameraHintSpot(phone, w, h);
      expect(at.left + w).toBe(390 - HINT_EDGE);
      expect(at.top).toBe(100 + HINT_GAP);
      const chip = { left: at.left, top: at.top, right: at.left + w, bottom: at.top + h };
      for (const r of [...phone.hud, ...phone.controls]) expect(inside(chip, r)).toBe(false);
      expect(chip.bottom).toBeLessThan(844 / 3);
   });

   it("steps down past a right-hand game panel under the chips", () => {
      const area = { ...phone, hud: [...phone.hud, { left: 250, top: 104, right: 380, bottom: 200 }] };
      const at = cameraHintSpot(area, 230, 52);
      expect(at.top).toBe(200 + HINT_GAP);
   });

   it("never drops below the middle of the screen", () => {
      const area = { ...phone, hud: [...phone.hud, { left: 0, top: 104, right: 390, bottom: 600 }] };
      expect(cameraHintSpot(area, 230, 52).top).toBe(100 + HINT_GAP);
   });

   it("desktop: one row of chips; a chip wider than the canvas stays on it", () => {
      const at = cameraHintSpot({ width: 1280, height: 800, hud: [{ left: 10, top: 10, right: 360, bottom: 52 }, { left: 1176, top: 10, right: 1270, bottom: 54 }], controls: [] }, 320, 40);
      expect(at).toEqual({ left: 1280 - HINT_EDGE - 320, top: 54 + HINT_GAP });
      expect(cameraHintSpot({ width: 200, height: 400, hud: [], controls: [] }, 300, 40).left).toBe(HINT_EDGE);
   });
});
