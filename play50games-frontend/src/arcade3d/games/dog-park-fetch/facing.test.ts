// The dog's model faces +z at yaw 0 (assets.test.ts measures its head), so the dog faces where it
// runs when yaw = atan2(vx, vz): each of the four keys (stick up/right/down/left) must turn it that way.
import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import { createRun, idleInput, step } from "./rules";

const KEYS = [
   { name: "up (W)", moveX: 0, moveY: -1, vx: 0, vz: -1 },
   { name: "right (D)", moveX: 1, moveY: 0, vx: 1, vz: 0 },
   { name: "down (S)", moveX: 0, moveY: 1, vx: 0, vz: 1 },
   { name: "left (A)", moveX: -1, moveY: 0, vx: -1, vz: 0 },
] as const;

describe("dog facing", () => {
   for (const k of KEYS) {
      it(`holding ${k.name} turns the dog to face its run direction`, () => {
         const run = createRun(1, LEVELS[1]);
         const input = { ...idleInput(), moveX: k.moveX, moveY: k.moveY };
         for (let i = 0; i < 30; i++) step(run, input, 1 / 60, 60_000);
         expect(Math.sign(run.dog.vx)).toBe(k.vx);
         expect(Math.sign(run.dog.vz)).toBe(k.vz);
         // the model's forward (0, 0, 1) turned by yaw points along the velocity
         const fx = Math.sin(run.dog.yaw);
         const fz = Math.cos(run.dog.yaw);
         const speed = Math.hypot(run.dog.vx, run.dog.vz);
         expect((fx * run.dog.vx + fz * run.dog.vz) / speed).toBeGreaterThan(0.98);
      });
   }
});
