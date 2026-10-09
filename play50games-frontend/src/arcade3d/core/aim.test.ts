import { describe, expect, it } from "vitest";
import {
   aimFired,
   bufferFire,
   createAxisAim,
   createBufferedFire,
   createHoldTimer,
   snapTo,
   stepAimKeys,
   stepAxisAim,
   stepHold,
   type AxisAimOptions,
} from "./aim";
import { idleDrag } from "./inputController";
import type { AimDrag } from "./types";

const DEG = Math.PI / 180;
const W = 390;
const H = 844;

/** A lob (pirate-cannons' tuning): x = yaw ±45°, y = elevation 0-35°. */
const LOB: AxisAimOptions = {
   x: { min: -45 * DEG, max: 45 * DEG, step: 0.5 * DEG, rate: 0.45, dragGain: 0.25 * DEG },
   y: { min: 0, max: 35 * DEG, step: 0.5 * DEG, rate: 0.35 * 35 * DEG, dragGain: 0.15 * DEG },
   holdDelay: 0.25,
};
/** A putt (mini-golf's keyboard): x = direction, no limits, 1° steps; y = power 0.1-1, 2 % steps. */
const PUTT: AxisAimOptions = {
   x: { min: -Infinity, max: Infinity, step: 1 * DEG, rate: 1.05, dragGain: 0 },
   y: { min: 0.1, max: 1, step: 0.02, rate: 0.5, dragGain: 0 },
   holdDelay: 0.25,
};
const FIRE = { release: true, tap: true, jump: true };

function input() {
   return {
      drag: idleDrag() as AimDrag,
      tap: null as unknown,
      jumpPressed: false,
      actionPressed: false,
      pressed: { left: false, right: false, up: false, down: false },
      moveX: 0,
      moveY: 0,
   };
}
/** Pointer coordinates of a point `px` CSS px right and `py` px down from the canvas centre. */
const at = (px: number, py: number) => ({ x: (2 * px) / W, y: (-2 * py) / H });

describe("core aim: relative drag", () => {
   it("follows a drag from where it started (gain per px right / pulled down), and the next drag starts from the aim the last one left", () => {
      const aim = createAxisAim(0, 10 * DEG);
      const i = input();
      i.drag.active = true;
      i.drag.start = at(0, 0);
      i.drag.current = at(40, 60);
      expect(stepAxisAim(aim, i, 1 / 60, W, H, LOB, FIRE)).toBe(false);
      expect(aim.x).toBeCloseTo(10 * DEG, 9);
      expect(aim.y).toBeCloseTo(19 * DEG, 9);
      i.drag.active = false;
      i.drag.released = true;
      expect(stepAxisAim(aim, i, 1 / 60, W, H, LOB, FIRE)).toBe(true);
      i.drag.released = false;
      stepAxisAim(aim, i, 1 / 60, W, H, LOB, FIRE);
      i.drag.active = true;
      i.drag.start = at(100, 100);
      i.drag.current = at(80, 100);
      stepAxisAim(aim, i, 1 / 60, W, H, LOB, FIRE);
      expect(aim.x).toBeCloseTo(5 * DEG, 9);
   });

   it("clamps both axes; the keyboard does not move the aim while a drag is followed", () => {
      const aim = createAxisAim(0, 10 * DEG);
      const i = input();
      i.drag.active = true;
      i.drag.current = at(800, 800);
      i.pressed.left = true;
      i.moveX = -1;
      stepAxisAim(aim, i, 1 / 60, W, H, LOB, FIRE);
      expect(aim.x).toBe(45 * DEG);
      expect(aim.y).toBe(35 * DEG);
      i.drag.current = at(-800, -800);
      stepAxisAim(aim, i, 1 / 60, W, H, LOB, FIRE);
      expect(aim.x).toBe(-45 * DEG);
      expect(aim.y).toBe(0);
   });
});

describe("core aim: fire triggers", () => {
   it("fires on a release over 16 px, a tap and Space; a cancelled release only adjusts; tap + cancelled release fire once", () => {
      const aim = createAxisAim(0, 10 * DEG);
      const i = input();
      i.drag.released = true;
      i.drag.cancelled = true;
      i.drag.current = at(0, 10);
      expect(stepAxisAim(aim, i, 1 / 60, W, H, LOB, FIRE)).toBe(false);
      expect(aim.y).toBeCloseTo(11.5 * DEG, 9);
      i.tap = { x: 0, y: 0 };
      expect(stepAxisAim(aim, i, 1 / 60, W, H, LOB, FIRE)).toBe(true);
      const j = input();
      j.jumpPressed = true;
      expect(aimFired(j, FIRE)).toBe(true);
      expect(aimFired(input(), FIRE)).toBe(false);
   });

   it("fires only on the triggers a game names (a putt: release and Enter, never a tap)", () => {
      const putt = { release: true, action: true };
      const i = input();
      i.tap = { x: 0, y: 0 };
      i.jumpPressed = true;
      expect(aimFired(i, putt)).toBe(false);
      i.actionPressed = true;
      expect(aimFired(i, putt)).toBe(true);
      const r = input();
      r.drag.released = true;
      expect(aimFired(r, putt)).toBe(true);
      r.drag.cancelled = true;
      expect(aimFired(r, putt)).toBe(false);
      expect(aimFired(r, {})).toBe(false);
   });

   it("buffers one fire with the aim of its press: later presses do not move it", () => {
      const buf = createBufferedFire();
      expect(bufferFire(buf, false, 1, 2)).toBe(false);
      expect(buf.pending).toBe(false);
      expect(bufferFire(buf, true, -30 * DEG, 5 * DEG)).toBe(true);
      expect(bufferFire(buf, true, 20 * DEG, 30 * DEG)).toBe(false);
      expect(buf).toEqual({ pending: true, x: -30 * DEG, y: 5 * DEG });
      buf.pending = false; // launched
      expect(bufferFire(buf, true, 20 * DEG, 30 * DEG)).toBe(true);
      expect(buf.x).toBe(20 * DEG);
   });

   it("times a hold and reports its release once (a charge meter)", () => {
      const h = createHoldTimer();
      expect(stepHold(h, false, 1 / 60)).toBe(false);
      for (let k = 0; k < 31; k++) expect(stepHold(h, true, 1 / 60)).toBe(false);
      expect(stepHold(h, false, 1 / 60)).toBe(true);
      expect(h.held).toBeCloseTo(0.5, 9);
      expect(stepHold(h, false, 1 / 60)).toBe(false);
      stepHold(h, true, 1 / 60);
      expect(h.held).toBe(0);
   });
});

describe("core aim: keyboard nudge, sweep and snap", () => {
   it("nudges exactly one step per fresh press, sweeps only after the hold delay, and snaps keyboard values to the grid", () => {
      const aim = createAxisAim(0.3 * DEG, 10 * DEG);
      const i = input();
      i.pressed.right = true;
      i.moveX = 1;
      stepAimKeys(aim, i, 1 / 60, LOB);
      expect(aim.x).toBeCloseTo(1 * DEG, 9);
      i.pressed.right = false;
      for (let k = 0; k < 13; k++) stepAimKeys(aim, i, 1 / 60, LOB);
      expect(aim.x).toBeCloseTo(1 * DEG, 9);
      for (let k = 0; k < 60; k++) stepAimKeys(aim, i, 1 / 60, LOB);
      expect(aim.x).toBeGreaterThan(20 * DEG);
      expect(aim.x).toBeLessThan(28 * DEG);
      expect(aim.x / (0.5 * DEG)).toBeCloseTo(Math.round(aim.x / (0.5 * DEG)), 9);
      // a fast frame rate still sweeps (the unsnapped sweep keeps the fractions)
      const fast = createAxisAim(0, 10 * DEG);
      const h = input();
      h.moveY = -1;
      for (let k = 0; k < 144 * 2; k++) stepAimKeys(fast, h, 1 / 144, LOB);
      expect(fast.y).toBeGreaterThan(25 * DEG);
      expect(snapTo(fast.y, 0.5 * DEG)).toBeCloseTo(fast.y, 9);
      const down = createAxisAim(0, 10 * DEG);
      const d = input();
      d.pressed.down = true;
      stepAimKeys(down, d, 1 / 60, LOB);
      expect(down.y).toBeCloseTo(9.5 * DEG, 9);
   });

   it("fits a putt: 1° and 2 % nudges, power clamped to 0.1-1, the direction unlimited", () => {
      const aim = createAxisAim(0, 0.5);
      const i = input();
      i.pressed.left = true;
      stepAimKeys(aim, i, 1 / 60, PUTT);
      expect(aim.x).toBeCloseTo(-1 * DEG, 9);
      i.pressed.left = false;
      i.pressed.up = true;
      stepAimKeys(aim, i, 1 / 60, PUTT);
      expect(aim.y).toBeCloseTo(0.52, 9);
      i.pressed.up = false;
      i.moveY = 1; // held down: sweeps to the floor
      for (let k = 0; k < 120; k++) stepAimKeys(aim, i, 1 / 60, PUTT);
      expect(aim.y).toBeCloseTo(0.1, 9);
      i.moveY = 0;
      i.moveX = 1; // held right for 10 s: 1.05 rad/s, far past any clamp
      for (let k = 0; k < 600; k++) stepAimKeys(aim, i, 1 / 60, PUTT);
      expect(aim.x).toBeGreaterThan(9 * 1.05 * 0.99);
      expect(aim.x / DEG).toBeCloseTo(Math.round(aim.x / DEG), 9);
   });

   it("is deterministic: the same inputs give the same aim", () => {
      const run = () => {
         const aim = createAxisAim(0, 10 * DEG);
         const i = input();
         for (let k = 0; k < 200; k++) {
            i.moveX = k % 50 < 30 ? 1 : -1;
            i.moveY = k % 70 < 20 ? -1 : 0;
            i.pressed.left = k % 37 === 0;
            stepAimKeys(aim, i, (1 + (k % 5)) / 240, LOB);
         }
         return [aim.x, aim.y];
      };
      expect(run()).toEqual(run());
   });
});
