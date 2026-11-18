// The camera behind the runner, the shell's input to the rules (lanes, jump, slide, the colour from a
// digit, a tap or a swatch), the intro; Riko leads.
import { describe, expect, it } from "vitest";
import { defaultHeroFor } from "@/arcade3d/menu2/heroes/heroPick";
import type { LiveInputState } from "@/arcade3d/core/types";
import { RUN_ORBIT, introKeyframes, orbitPivot, playCamera } from "./camera";
import { NONE, courseFor, createStepInput } from "./rules";
import { DEFAULT_HERO } from "./heroes";
import { readInput } from "./Scene";

function shellInput(over: Partial<LiveInputState>): LiveInputState {
   return {
      moveX: 0, moveY: 0, jump: false, action: false, jumpPressed: false, actionPressed: false,
      pressed: { left: false, right: false, up: false, down: false }, swipe: null, tap: null, tapDown: null,
      pointer: { x: 0, y: 0, down: false }, drag: {} as never, digit: null,
      ...over,
   } as LiveInputState;
}

describe("camera and controls", () => {
   it("digits pick a colour, a tap cycles, a swatch wins; up jumps, down slides", () => {
      const out = createStepInput();
      readInput(shellInput({ digit: 3 }), 0, -1, out);
      expect(out.colorPick).toBe(2);
      readInput(shellInput({ tap: { x: 0, y: 0 } }), 0, -1, out);
      expect(out.colorPick).toBe(NONE);
      expect(out.cycle).toBe(true);
      readInput(shellInput({ digit: 1 }), 0, 4, out);
      expect(out.colorPick).toBe(4);
      readInput(shellInput({ pressed: { left: false, right: true, up: true, down: true } }), 0.5, -1, out);
      expect([out.right, out.jumpPressed, out.slidePressed, out.yaw]).toEqual([true, true, true, 0.5]);
   });

   it("the camera sits behind the runner and looks down the track; the intro is finite; Riko leads", () => {
      expect(RUN_ORBIT.yaw).toBe(0);
      const p = orbitPivot(0, 0, -10, { x: 0, y: 0, z: 0 });
      expect(p.z).toBeLessThan(-10);
      for (const id of [1, 5] as const) {
         const play = playCamera(courseFor(id), 16 / 9);
         expect([...play.position, ...play.lookAt].every(Number.isFinite)).toBe(true);
         expect(play.position[2]).toBeGreaterThan(play.lookAt[2]);
         expect(introKeyframes(courseFor(id)).length).toBeGreaterThan(1);
      }
      expect(defaultHeroFor("switch-color-hero", null)).toBe(DEFAULT_HERO);
   });
});
