// The putt aim: pitch correction, the 16 / 160 px pull, 1 deg / 2 % nudges, the sweep after 0.25 s,
// the charge meter and Enter.
import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import type { AimDrag } from "@/arcade3d/core/types";
import { PUTT, chargePower, createPuttAim, headingFromDrag, headingTo, resetPuttAim, screenHeading, stepPuttAim, worldHeading, type PuttInput } from "./aim";

const DEG = Math.PI / 180;
const PITCH = 58 * DEG;

function input(over: Partial<PuttInput> = {}): PuttInput {
   const drag: AimDrag = { active: false, released: false, start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, power: 0, angle: 0, cancelled: false };
   return { drag, pressed: { left: false, right: false, up: false, down: false }, moveX: 0, moveY: 0, jump: false, actionPressed: false, ...over };
}

describe("mini-golf aim", () => {
   it("a pull straight down putts straight up the screen; sideways pulls are un-foreshortened by the pitch", () => {
      expect(headingFromDrag(Math.PI / 2, PITCH)).toBeCloseTo(0, 9);
      expect(headingFromDrag(0, PITCH)).toBeCloseTo(Math.PI / 2, 9);
      // a 45 deg pull on screen: forward / sin(pitch) makes the felt heading steeper than 45 deg
      const h = headingFromDrag(Math.PI / 4, PITCH);
      expect(Math.tan(h)).toBeCloseTo(Math.sin(PITCH), 9);
   });

   it("screen and world headings agree with inputToWorld for every camera yaw", () => {
      for (const yaw of [0, Math.PI / 2, -0.7]) {
         for (const theta of [0, 0.4, -2]) {
            const w = inputToWorld(Math.sin(theta), -Math.cos(theta), yaw);
            const psi = worldHeading(theta, yaw);
            expect(w.x).toBeCloseTo(Math.sin(psi), 9);
            expect(w.z).toBeCloseTo(-Math.cos(psi), 9);
            expect(screenHeading(psi, yaw)).toBeCloseTo(theta, 9);
         }
      }
      expect(headingTo(0, 0, 0, -1)).toBeCloseTo(0, 9);
      expect(headingTo(0, 0, 1, 0)).toBeCloseTo(Math.PI / 2, 9);
   });

   it("a release over 16 px putts with the pull's power; a shorter pull only cancels", () => {
      const aim = createPuttAim();
      const i = input();
      i.drag.active = true;
      i.drag.power = 0.5;
      i.drag.angle = Math.PI / 2;
      expect(stepPuttAim(aim, i, 1 / 60, PITCH)).toBe(false);
      i.drag.active = false;
      i.drag.released = true;
      expect(stepPuttAim(aim, i, 1 / 60, PITCH)).toBe(true);
      expect(aim.axes.y).toBe(0.5);
      const short = input();
      short.drag.released = true;
      short.drag.cancelled = true;
      short.drag.power = 0.05;
      expect(stepPuttAim(createPuttAim(), short, 1 / 60, PITCH)).toBe(false);
      expect(PUTT.minPull).toBeCloseTo(16 / 160, 9);
   });

   it("arrows nudge 1 deg / 2 %, sweep only after 0.25 s held, and snap to the grid", () => {
      const aim = createPuttAim();
      resetPuttAim(aim, 0, 0);
      stepPuttAim(aim, input({ pressed: { left: false, right: true, up: true, down: false }, moveX: 1, moveY: -1 }), 1 / 60, PITCH);
      expect(aim.axes.x).toBeCloseTo(DEG, 9);
      expect(aim.axes.y).toBeCloseTo(0.52, 9);
      for (let f = 0; f < 14; f++) stepPuttAim(aim, input({ moveX: 1 }), 1 / 60, PITCH);
      expect(aim.axes.x).toBeCloseTo(DEG, 9); // 0.25 s not passed yet
      for (let f = 0; f < 60; f++) stepPuttAim(aim, input({ moveX: 1 }), 1 / 60, PITCH);
      expect(aim.axes.x).toBeGreaterThan(40 * DEG);
      expect(Math.abs(aim.axes.x / DEG - Math.round(aim.axes.x / DEG))).toBeLessThan(1e-9);
   });

   it("Space charges 0 -> 1 -> 0 every 2 s and putts on release; Enter putts the power shown", () => {
      expect(chargePower(0)).toBe(0.1);
      expect(chargePower(1)).toBeCloseTo(1, 9);
      expect(chargePower(0.5)).toBeCloseTo(0.5, 9);
      const aim = createPuttAim();
      let fired = false;
      for (let f = 0; f <= 30; f++) fired = stepPuttAim(aim, input({ jump: true }), 1 / 60, PITCH);
      expect(fired).toBe(false);
      expect(aim.shown).toBeCloseTo(0.5, 1);
      expect(stepPuttAim(aim, input(), 1 / 60, PITCH)).toBe(true);
      expect(aim.axes.y).toBeCloseTo(0.5, 1);
      expect(stepPuttAim(aim, input({ actionPressed: true }), 1 / 60, PITCH)).toBe(true);
   });
});
