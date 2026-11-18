// Disc Target Throw with the shared orbit camera (menu2/camera): camera-relative walking and the aim
// through the rules' own input (StepInput.yaw), the intro ending on the orbit's first pose, the column
// collision, and the preselected hero (W3: Kiro).
import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import { createOrbit, orbitPosition } from "@/arcade3d/menu2/camera/orbit";
import { defaultHeroFor } from "@/arcade3d/menu2/heroes/heroPick";
import { LEVEL_IDS } from "@/arcade3d/types";
import { courseSolids, discOrbit, heroPivot, introKeyframes, orbitScale, playCamera } from "./camera";
import { courseFor } from "./course";
import { HOLD_MS, createRun, createStepInput, step } from "./rules";
import { DEFAULT_HERO } from "./heroes";

describe("camera-relative input", () => {
   it("a turned camera turns the stick: the same walk as the world input at any yaw", () => {
      for (const yaw of [0.5, Math.PI / 2, -2.4, Math.PI]) {
         const a = createRun(3, 1);
         const b = createRun(3, 1);
         const turned = createStepInput();
         turned.moveZ = -1;
         turned.yaw = yaw;
         const w = inputToWorld(0, -1, yaw);
         const world = createStepInput();
         world.moveX = w.x;
         world.moveZ = w.z;
         world.yaw = 0;
         for (let f = 0; f < 20; f++) {
            step(a, 1000 / 60, turned);
            step(b, 1000 / 60, world);
         }
         const dx = a.hero.x - a.course.startX;
         const dz = a.hero.z - a.course.startZ;
         expect(dx).toBeCloseTo(b.hero.x - b.course.startX, 6);
         expect(dz).toBeCloseTo(b.hero.z - b.course.startZ, 6);
         expect(dx * Math.sin(yaw) + dz * Math.cos(yaw)).toBeLessThan(0);
      }
   });

   it("the throw flies where the camera looks (away from it), at any yaw", () => {
      for (const yaw of [0, 1, -2, 3]) {
         const run = createRun(1, 1);
         const input = { ...createStepInput(), throwHeld: true, yaw };
         for (let i = 0; i <= HOLD_MS + 5; i++) step(run, 1, input);
         input.throwHeld = false;
         step(run, 1, input);
         expect(run.disc.mode).toBe("out");
         const away = -(run.disc.vx * Math.sin(yaw) + run.disc.vz * Math.cos(yaw)) / Math.hypot(run.disc.vx, run.disc.vz);
         expect(away).toBeGreaterThan(0.999);
      }
   });
});

describe("the camera", () => {
   it("starts behind the hero looking north, farther back on a portrait phone", () => {
      expect(discOrbit(courseFor(1)).yaw).toBe(0);
      expect(orbitScale(0.46)).toBeGreaterThan(orbitScale(1.6));
      expect(orbitScale(1.6)).toBe(1);
   });

   it("the intro ends exactly on the orbit's first pose", () => {
      for (const level of LEVEL_IDS) {
         const c = courseFor(level);
         expect(introKeyframes(c).length).toBeGreaterThanOrEqual(3);
         for (const aspect of [1.6, 0.46]) {
            const play = playCamera(c, aspect);
            const orbit = createOrbit(discOrbit(c));
            const p = heroPivot({ x: c.startX, z: c.startZ }, { x: 0, y: 0, z: 0 });
            const pos = orbitPosition(p.x, p.y, p.z, orbit.viewYaw, orbit.viewPitch, orbit.viewDistance * orbitScale(aspect), { x: 0, y: 0, z: 0 });
            expect(play.position[0]).toBeCloseTo(pos.x, 6);
            expect(play.position[1]).toBeCloseTo(pos.y, 6);
            expect(play.position[2]).toBeCloseTo(pos.z, 6);
         }
      }
   });

   it("collides with the columns near it and the tall walls, never the low south parapet", () => {
      const c = courseFor(4);
      const out = Array.from({ length: 32 }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
      const n = courseSolids(c, 0, -4, out);
      const walls = c.boxes.filter((b) => b.kind === "stone" && b.h >= 2).length;
      expect(walls).toBe(3);
      expect(n).toBeGreaterThan(walls);
      expect(n).toBeLessThanOrEqual(walls + c.columns.length);
      expect(out.slice(0, n).some((o) => o.max.y < 2)).toBe(false);
   });

   it("World 3's lead, Kiro, is preselected and is the rules' default", () => {
      expect(defaultHeroFor("disc-target-throw", null)).toBe("kiro");
      expect(DEFAULT_HERO).toBe("kiro");
      expect(createRun(1).heroId).toBe("kiro");
   });
});
