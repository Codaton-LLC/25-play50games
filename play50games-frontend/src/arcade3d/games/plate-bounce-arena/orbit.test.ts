// The camera's table view, camera-relative nudges and powers, the touch halves, the intro; Zuno leads.
import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import { defaultHeroFor } from "@/arcade3d/menu2/heroes/heroPick";
import { TABLE_ORBIT, introKeyframes, orbitPivot, playCamera } from "./camera";
import { courseFor, createRun, createStepInput, step } from "./rules";
import { DEFAULT_HERO } from "./heroes";
import { readInput } from "./Scene";
import type { LiveInputState } from "@/arcade3d/core/types";

function shellInput(over: Partial<LiveInputState>): LiveInputState {
   return {
      moveX: 0, moveY: 0, jump: false, action: false, jumpPressed: false, actionPressed: false,
      pressed: { left: false, right: false, up: false, down: false }, swipe: null, tap: null, tapDown: null,
      pointer: { x: 0, y: 0, down: false }, drag: { active: false, released: false, startX: 0, startY: 0, x: 0, y: 0, dx: 0, dy: 0 } as never, digit: null,
      ...over,
   } as LiveInputState;
}

describe("camera and controls", () => {
   it("a nudge follows the camera (camera-relative stick)", () => {
      for (const yaw of [0, 1.2, -2, Math.PI]) {
         const run = createRun(1, 2, "zuno");
         const b = run.ball;
         b.mode = "roll";
         b.x = -5.6;
         b.z = -12;
         const input = createStepInput();
         input.moveZ = -1;
         input.yaw = yaw;
         const free = createRun(1, 2, "zuno");
         Object.assign(free.ball, { mode: "roll", x: -5.6, z: -12 });
         for (let i = 0; i < 10; i++) {
            step(run, 16, input);
            step(free, 16, createStepInput());
         }
         const want = inputToWorld(0, -1, yaw);
         const dx = run.ball.vx - free.ball.vx;
         const dz = run.ball.vz - free.ball.vz;
         expect((dx * want.x + dz * want.z) / Math.hypot(dx, dz)).toBeGreaterThan(0.99);
      }
   });

   it("the flippers: A / D (the stick) and a touch on that half of the screen", () => {
      const out = createStepInput();
      readInput(shellInput({ moveX: -1 }), 0, out);
      expect([out.left, out.right]).toEqual([true, false]);
      readInput(shellInput({ pointer: { x: 0.4, y: 0, down: true } }), 0, out);
      expect([out.left, out.right]).toEqual([false, true]);
      readInput(shellInput({ pointer: { x: -0.4, y: 0, down: true } }), 0, out);
      expect([out.left, out.right]).toEqual([true, false]);
      readInput(shellInput({ jump: true, action: true }), 0.5, out);
      expect(out.jumpHeld && out.actionHeld && out.yaw === 0.5).toBe(true);
   });

   it("the table view looks up the table from behind the drain; the intro and play camera are finite; Zuno leads", () => {
      expect(TABLE_ORBIT.yaw).toBe(0);
      const p = orbitPivot(0, -2, 0, { x: 0, y: 0, z: 0 });
      const q = orbitPivot(0, -26, 0, { x: 0, y: 0, z: 0 });
      expect(q.z).toBeLessThan(p.z);
      for (const id of [1, 5] as const) {
         const c = courseFor(id);
         const play = playCamera(c, 16 / 9);
         expect([...play.position, ...play.lookAt].every(Number.isFinite)).toBe(true);
         expect(play.position[2]).toBeGreaterThan(play.lookAt[2]);
         expect(introKeyframes(c).length).toBeGreaterThan(1);
      }
      expect(defaultHeroFor("plate-bounce-arena", null)).toBe(DEFAULT_HERO);
      expect(DEFAULT_HERO).toBe("zuno");
   });
});
