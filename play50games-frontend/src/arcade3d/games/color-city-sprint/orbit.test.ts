import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import { createRun, createStepInput, step } from "./rules";

describe("camera-relative stick", () => {
   it("yaw 0 keeps the stick in world axes", () => {
      const run = createRun(1, 1);
      const input = createStepInput();
      input.moveZ = -1;
      for (let i = 0; i < 30; i++) step(run, 16, input);
      expect(run.hero.z).toBeLessThan(-1);
      const world = inputToWorld(0, -1, 0);
      expect(world.z).toBeCloseTo(-1, 5);
   });

   it("a quarter turn sends stick-up along +x, away from a camera sitting on -x", () => {
      const run = createRun(1, 1);
      const input = createStepInput();
      input.moveZ = -1;
      input.yaw = -Math.PI / 2;
      for (let i = 0; i < 30; i++) step(run, 16, input);
      expect(run.hero.x).toBeGreaterThan(1);
      expect(Math.abs(run.hero.z)).toBeLessThan(0.5);
   });
});
