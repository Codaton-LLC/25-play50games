// Paint the Platforms with the shared orbit camera (menu2/camera): camera-relative running through the
// rules' own input (StepInput.yaw), the orbit behind the start, the intro ending on the orbit's first
// pose, and the preselected hero (World 6 has no lead: the last pick, else Riko).
import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import { createOrbit, orbitPosition } from "@/arcade3d/menu2/camera/orbit";
import { defaultHeroFor } from "@/arcade3d/menu2/heroes/heroPick";
import { LEVEL_IDS } from "@/arcade3d/types";
import { heroPivot, introKeyframes, orbitScale, paintOrbit, playCamera } from "./camera";
import { courseFor } from "./course";
import { createRun, createStepInput, step } from "./rules";
import { DEFAULT_HERO } from "./heroes";

describe("camera-relative input", () => {
   it("a turned camera turns the stick: the same run as the world input at any yaw", () => {
      for (const yaw of [0.5, Math.PI / 2, -2.4, Math.PI]) {
         const a = createRun(3, 1);
         const b = createRun(3, 1);
         const turned = { ...createStepInput(), moveZ: -1, yaw };
         const w = inputToWorld(0, -1, yaw);
         const world = { ...createStepInput(), moveX: w.x, moveZ: w.z };
         for (let f = 0; f < 6; f++) {
            step(a, 1000 / 60, turned);
            step(b, 1000 / 60, world);
         }
         expect(a.hero.x).toBeCloseTo(b.hero.x, 9);
         expect(a.hero.z).toBeCloseTo(b.hero.z, 9);
         const s = a.course.start;
         expect((a.hero.x - s.x) * Math.sin(yaw) + (a.hero.z - s.z) * Math.cos(yaw)).toBeLessThan(0);
      }
   });
});

describe("the camera", () => {
   it("starts behind the start looking north, steeply enough to read the floor, farther back on a portrait phone", () => {
      for (const level of LEVEL_IDS) {
         const o = paintOrbit(courseFor(level));
         expect(o.yaw).toBe(0);
         expect(o.pitch!).toBeGreaterThan((40 * Math.PI) / 180);
      }
      expect(orbitScale(0.46)).toBeGreaterThan(orbitScale(1.6));
      expect(orbitScale(1.6)).toBe(1);
   });

   it("the intro ends exactly on the orbit's first pose", () => {
      for (const level of LEVEL_IDS) {
         const c = courseFor(level);
         expect(introKeyframes(c).length).toBeGreaterThanOrEqual(3);
         for (const aspect of [1.6, 0.46]) {
            const play = playCamera(c, aspect);
            const orbit = createOrbit(paintOrbit(c));
            const s = c.start;
            const p = heroPivot({ x: s.x, y: s.y, z: s.z }, { x: 0, y: 0, z: 0 });
            const pos = orbitPosition(p.x, p.y, p.z, orbit.viewYaw, orbit.viewPitch, orbit.viewDistance * orbitScale(aspect), { x: 0, y: 0, z: 0 });
            expect(play.position[0]).toBeCloseTo(pos.x, 6);
            expect(play.position[1]).toBeCloseTo(pos.y, 6);
            expect(play.position[2]).toBeCloseTo(pos.z, 6);
         }
      }
   });

   it("World 6 has no lead: the last pick, else Riko, who is the rules' default", () => {
      expect(defaultHeroFor("paint-the-platforms", null)).toBe("riko");
      expect(defaultHeroFor("paint-the-platforms", "zuno")).toBe("zuno");
      expect(DEFAULT_HERO).toBe("riko");
      expect(createRun(1).heroId).toBe("riko");
   });
});
