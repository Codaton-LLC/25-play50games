// The camera follows the corridor's heading; movement is camera-relative; the intro is finite; Kiro leads.
import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import { defaultHeroFor } from "@/arcade3d/menu2/heroes/heroPick";
import { introKeyframes, playCamera } from "./camera";
import { courseFor, createRun, createStepInput, step } from "./rules";
import { DEFAULT_HERO } from "./heroes";
import { travelHeading } from "./Scene";

describe("camera and controls", () => {
   it("a turned camera turns the walk (camera-relative stick)", () => {
      for (const yaw of [0, 1.2, -2, Math.PI]) {
         const run = createRun(1, 2, "kiro");
         const input = createStepInput();
         input.moveZ = -1;
         input.yaw = yaw;
         const x0 = run.hero.x;
         const z0 = run.hero.z;
         for (let i = 0; i < 10; i++) step(run, 16, input);
         const want = inputToWorld(0, -1, yaw);
         const dx = run.hero.x - x0;
         const dz = run.hero.z - z0;
         expect((dx * want.x + dz * want.z) / Math.hypot(dx, dz)).toBeGreaterThan(0.99);
      }
   });

   it("the camera's travel is the corridor's heading from the hero's pad", () => {
      const run = createRun(1, 1, "kiro");
      const out = { x: 0, z: 0 };
      travelHeading(run, out);
      expect(out.x).toBeGreaterThan(0);
      expect(Math.abs(out.z)).toBeLessThan(1e-9);
   });

   it("the intro and the play camera are finite; Kiro is the default", () => {
      for (const id of [1, 5] as const) {
         const c = courseFor(id);
         const play = playCamera(c, 16 / 9);
         expect([...play.position, ...play.lookAt].every(Number.isFinite)).toBe(true);
         expect(introKeyframes(c).length).toBeGreaterThan(1);
      }
      expect(defaultHeroFor("wall-run-temple", null)).toBe(DEFAULT_HERO);
      expect(DEFAULT_HERO).toBe("kiro");
   });
});
