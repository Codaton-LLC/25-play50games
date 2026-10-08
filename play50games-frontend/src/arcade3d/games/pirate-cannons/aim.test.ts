import { describe, expect, it } from "vitest";
import type { AimDrag } from "@/arcade3d/core/types";
import { AIM, createAim, snap, stepAim, type AimInput } from "./aim";

const DEG = Math.PI / 180;
const W = 390;
const H = 844;

function input(): AimInput & { drag: AimDrag } {
   return {
      drag: { active: false, released: false, start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, power: 0, angle: 0, cancelled: false },
      tap: null,
      jumpPressed: false,
      pressed: { left: false, right: false, up: false, down: false },
      moveX: 0,
      moveY: 0,
   };
}
/** Pointer coordinates of a point `px` CSS px right and `py` px down from the canvas centre. */
const at = (px: number, py: number) => ({ x: (2 * px) / W, y: (-2 * py) / H });

describe("lob aim", () => {
   it("follows a drag relative to where it started: 0.25° per px sideways, 0.15° per px pulled down", () => {
      const aim = createAim();
      const i = input();
      i.drag.active = true;
      i.drag.start = at(0, 0);
      i.drag.current = at(40, 60);
      expect(stepAim(aim, i, 1 / 60, W, H)).toBe(false);
      expect(aim.yaw).toBeCloseTo(AIM.startYaw + 10 * DEG, 9);
      expect(aim.elevation).toBeCloseTo(AIM.startEl + 9 * DEG, 9);
      // a second drag starts from the aim the first one left
      i.drag.active = false;
      i.drag.released = true;
      expect(stepAim(aim, i, 1 / 60, W, H)).toBe(true);
      i.drag.released = false;
      stepAim(aim, i, 1 / 60, W, H);
      i.drag.active = true;
      i.drag.start = at(100, 100);
      i.drag.current = at(80, 100);
      stepAim(aim, i, 1 / 60, W, H);
      expect(aim.yaw).toBeCloseTo(AIM.startYaw + 5 * DEG, 9);
   });

   it("clamps yaw to ±45° and elevation to 0-35°", () => {
      const aim = createAim();
      const i = input();
      i.drag.active = true;
      i.drag.current = at(800, 800);
      stepAim(aim, i, 1 / 60, W, H);
      expect(aim.yaw).toBe(AIM.yawMax);
      expect(aim.elevation).toBe(AIM.elMax);
      i.drag.current = at(-800, -800);
      stepAim(aim, i, 1 / 60, W, H);
      expect(aim.yaw).toBe(-AIM.yawMax);
      expect(aim.elevation).toBe(AIM.elMin);
   });

   it("fires on a release over 16 px, on a tap and on Space; a cancelled drag only adjusts", () => {
      const aim = createAim();
      const i = input();
      i.drag.released = true;
      i.drag.cancelled = true;
      i.drag.current = at(0, 10);
      expect(stepAim(aim, i, 1 / 60, W, H)).toBe(false);
      expect(aim.elevation).toBeCloseTo(AIM.startEl + 1.5 * DEG, 9);
      // a short press: tap and a cancelled release on the same frame fire once
      i.tap = { x: 0, y: 0 };
      expect(stepAim(aim, i, 1 / 60, W, H)).toBe(true);
      const j = input();
      j.jumpPressed = true;
      expect(stepAim(createAim(), j, 1 / 60, W, H)).toBe(true);
      expect(stepAim(createAim(), input(), 1 / 60, W, H)).toBe(false);
   });

   it("nudges exactly 0.5° per fresh arrow press, sweeps only after 0.25 s held, and snaps keyboard values to 0.5°", () => {
      const aim = createAim();
      aim.yaw = 0.3 * DEG;
      const i = input();
      i.pressed.right = true;
      i.moveX = 1;
      stepAim(aim, i, 1 / 60, W, H);
      expect(aim.yaw).toBeCloseTo(1 * DEG, 9);
      i.pressed.right = false;
      // held: nothing more until 0.25 s
      for (let k = 0; k < 13; k++) stepAim(aim, i, 1 / 60, W, H);
      expect(aim.yaw).toBeCloseTo(1 * DEG, 9);
      for (let k = 0; k < 60; k++) stepAim(aim, i, 1 / 60, W, H);
      // ~26°/s for the rest of the second, on the grid
      expect(aim.yaw).toBeGreaterThan(20 * DEG);
      expect(aim.yaw).toBeLessThan(28 * DEG);
      expect(aim.yaw / AIM.keyStep).toBeCloseTo(Math.round(aim.yaw / AIM.keyStep), 9);
      // a slow frame rate still sweeps (the unsnapped sweep keeps the fractions)
      const slow = createAim();
      const h = input();
      h.moveY = -1;
      for (let k = 0; k < 144 * 2; k++) stepAim(slow, h, 1 / 144, W, H);
      expect(slow.elevation).toBeGreaterThan(AIM.startEl + 15 * DEG);
      expect(snap(slow.elevation)).toBeCloseTo(slow.elevation, 9);
      const down = createAim();
      const d = input();
      d.pressed.down = true;
      stepAim(down, d, 1 / 60, W, H);
      expect(down.elevation).toBeCloseTo(AIM.startEl - 0.5 * DEG, 9);
   });
});
