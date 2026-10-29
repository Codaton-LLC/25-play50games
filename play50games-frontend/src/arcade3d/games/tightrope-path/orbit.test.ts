// Tightrope Path with the shared orbit camera (menu2/camera): camera-relative walking and balancing
// through the rules' own input (StepInput.yaw), the orbit starting behind the first link, the tilt with
// the needle, the intro ending on the orbit's first pose, and the preselected hero (W3: Kiro).
import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import { createOrbit, orbitPosition } from "@/arcade3d/menu2/camera/orbit";
import { defaultHeroFor } from "@/arcade3d/menu2/heroes/heroPick";
import { LEVEL_IDS } from "@/arcade3d/types";
import { TILT_MAX, heroPivot, introKeyframes, orbitScale, playCamera, tightOrbit, tiltFor, yawBehind } from "./camera";
import { courseFor, linkPoint } from "./course";
import { createRun, createStepInput, step } from "./rules";
import { DEFAULT_HERO } from "./heroes";

describe("camera-relative input", () => {
   it("up on the stick walks away from the camera when the camera is behind the walk", () => {
      const c = courseFor(1);
      const l = c.links[c.links[c.start].next];
      const yaw = yawBehind(l.dx, l.dz);
      const w = inputToWorld(0, -1, yaw);
      expect(w.x * l.dx + w.z * l.dz).toBeCloseTo(1, 6);
      const run = createRun(1, 1);
      const input = { ...createStepInput(), moveZ: -1, yaw };
      const s0 = run.hero.s;
      for (let i = 0; i < 300; i++) step(run, 1, input);
      expect(run.hero.s).toBeGreaterThan(s0 + 0.3);
   });

   it("right on the stick pushes the needle right (to correct a lean left) at any yaw", () => {
      for (const yaw of [0, 1.2, -2.5]) {
         const run = createRun(1, 1);
         const rope = run.course.links.findIndex((l) => l.kind === "rope");
         run.hero.link = rope;
         run.hero.s = 2;
         const l = run.course.links[rope];
         // the world right of the walk is (-dz, dx); find the stick that means it through yaw
         const wx = -l.dz;
         const wz = l.dx;
         const input = { ...createStepInput(), yaw, moveX: Math.cos(yaw) * wx - Math.sin(yaw) * wz, moveZ: Math.sin(yaw) * wx + Math.cos(yaw) * wz };
         for (let i = 0; i < 200; i++) step(run, 1, input);
         expect(run.hero.lean).toBeGreaterThan(0.2);
      }
   });
});

describe("the camera", () => {
   it("starts behind the first link, farther back on a portrait phone, and tilts at most 6 degrees", () => {
      const c = courseFor(1);
      const l = c.links[c.links[c.start].next];
      expect(tightOrbit(c).yaw).toBeCloseTo(yawBehind(l.dx, l.dz), 9);
      expect(orbitScale(0.46)).toBeGreaterThan(orbitScale(1.6));
      expect(Math.abs(tiltFor(5))).toBeCloseTo(TILT_MAX, 9);
      expect(tiltFor(0)).toBeCloseTo(0, 12);
   });

   it("the intro ends exactly on the orbit's first pose", () => {
      for (const level of LEVEL_IDS) {
         const c = courseFor(level);
         expect(introKeyframes(c).length).toBeGreaterThanOrEqual(3);
         for (const aspect of [1.6, 0.46]) {
            const play = playCamera(c, aspect);
            const orbit = createOrbit(tightOrbit(c));
            const p = heroPivot(linkPoint(c.links[c.start], 0.5, { x: 0, y: 0, z: 0 }), { x: 0, y: 0, z: 0 });
            const pos = orbitPosition(p.x, p.y, p.z, orbit.viewYaw, orbit.viewPitch, orbit.viewDistance * orbitScale(aspect), { x: 0, y: 0, z: 0 });
            expect(play.position[0]).toBeCloseTo(pos.x, 6);
            expect(play.position[1]).toBeCloseTo(pos.y, 6);
            expect(play.position[2]).toBeCloseTo(pos.z, 6);
         }
      }
   });

   it("World 3's lead, Kiro, is preselected and is the rules' default", () => {
      expect(defaultHeroFor("tightrope-path", null)).toBe("kiro");
      expect(DEFAULT_HERO).toBe("kiro");
      expect(createRun(1).heroId).toBe("kiro");
   });
});
