// The arena camera, camera-relative running, the intro; Riko leads.
import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import { defaultHeroFor } from "@/arcade3d/menu2/heroes/heroPick";
import { ARENA_ORBIT, introKeyframes, playCamera } from "./camera";
import { courseFor, createRun, createStepInput, step } from "./rules";
import { DEFAULT_HERO } from "./heroes";

describe("camera and controls", () => {
   it("a turned camera turns the run (camera-relative stick)", () => {
      for (const yaw of [0, 1.2, -2, Math.PI]) {
         const run = createRun(1, 1, "riko");
         const input = createStepInput();
         input.moveZ = -1;
         input.yaw = yaw;
         const x0 = run.hero.x;
         const z0 = run.hero.z;
         for (let i = 0; i < 8; i++) step(run, 16, input);
         const want = inputToWorld(0, -1, yaw);
         const dx = run.hero.x - x0;
         const dz = run.hero.z - z0;
         expect((dx * want.x + dz * want.z) / Math.hypot(dx, dz)).toBeGreaterThan(0.99);
      }
   });

   it("the camera looks at the arena from the south, high; the intro is finite; Riko leads", () => {
      expect(ARENA_ORBIT.yaw).toBe(0);
      expect(ARENA_ORBIT.pitch).toBeGreaterThan(0.6);
      for (const id of [1, 5] as const) {
         const play = playCamera(courseFor(id), 16 / 9);
         expect([...play.position, ...play.lookAt].every(Number.isFinite)).toBe(true);
         expect(play.position[2]).toBeGreaterThan(play.lookAt[2]);
         expect(introKeyframes(courseFor(id)).length).toBeGreaterThan(1);
      }
      expect(defaultHeroFor("color-orb-defense", null)).toBe(DEFAULT_HERO);
   });
});
