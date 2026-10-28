// The orbit starts behind and to the left of the hero: screen-up walks along the docks (+x) and a
// little toward the far side, and the camera-relative stick follows any turn of the orbit.
import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import { defaultHeroFor } from "@/arcade3d/menu2/heroes/heroPick";
import { SWING_ORBIT, introKeyframes, playCamera } from "./camera";
import { courseFor, createRun, createStepInput, step } from "./rules";
import { DEFAULT_HERO } from "./heroes";

describe("the orbit faces along the docks", () => {
   it("stick-up walks mostly +x at the starting yaw, and a turned orbit turns the walk", () => {
      const w = inputToWorld(0, -1, SWING_ORBIT.yaw ?? 0);
      expect(w.x).toBeGreaterThan(0.65);
      for (const yaw of [SWING_ORBIT.yaw ?? 0, 0, 1.2, -2]) {
         const run = createRun(1, 1, "nami");
         const input = createStepInput();
         input.moveZ = -1;
         input.yaw = yaw;
         const x0 = run.hero.x;
         const z0 = run.hero.z;
         for (let i = 0; i < 10; i++) step(run, 16, input);
         const want = inputToWorld(0, -1, yaw);
         const dx = run.hero.x - x0;
         const dz = run.hero.z - z0;
         const len = Math.hypot(dx, dz);
         expect(len).toBeGreaterThan(0.1);
         expect((dx * want.x + dz * want.z) / len).toBeGreaterThan(0.99);
      }
   });

   it("the intro and the play camera are finite, and Nami is the default", () => {
      const course = courseFor(1);
      const play = playCamera(course, 16 / 9);
      expect(play.position.every((n) => Number.isFinite(n))).toBe(true);
      expect(play.lookAt.every((n) => Number.isFinite(n))).toBe(true);
      const keys = introKeyframes(course);
      expect(keys.length).toBeGreaterThan(1);
      expect(defaultHeroFor("sky-hook-swing", null)).toBe(DEFAULT_HERO);
      expect(DEFAULT_HERO).toBe("nami");
   });
});
