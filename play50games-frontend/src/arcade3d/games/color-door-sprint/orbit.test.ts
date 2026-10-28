// Color Door Sprint with the shared orbit camera (menu2/camera): camera-relative lane presses through
// the rules' own input (StepInput.yaw), the default view (behind the runner: right is right), the
// proof's z guard for any yaw, the intro ending on the orbit's first pose, the floor box, and the
// preselected hero (World 1: Riko).
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition } from "@/arcade3d/menu2/camera/orbit";
import { defaultHeroFor, memoryHeroStorage, setHeroPickStorage } from "@/arcade3d/menu2/heroes/heroPick";
import { LEVEL_IDS } from "@/arcade3d/types";
import { DOOR_ORBIT, courseSolids, introKeyframes, orbitLookUp, orbitPivot, orbitScale, playCamera } from "./camera";
import { createRun, createStepInput, step } from "./rules";
import { DEFAULT_HERO, pickedHero, resetHeroPick, selectHero } from "./heroes";
import { laneX } from "./halls";

describe("camera-relative lanes are part of the rules' input", () => {
   it("from the start view a right press moves one lane right; with the camera turned round it moves left", () => {
      const lane = (yaw: number) => {
         const r = createRun(1, 2);
         const i = createStepInput();
         i.right = true;
         i.yaw = yaw;
         step(r, 16, i);
         return r.hero.lane;
      };
      expect(lane(DOOR_ORBIT.yaw ?? 0)).toBe(2);
      expect(lane(Math.PI)).toBe(0);
   });

   it("the z guard holds for any yaw: random presses under random turning cameras never pass vMax/1000 a ms", () => {
      const rng = createRng(99);
      for (const level of LEVEL_IDS) {
         const r = createRun(5, level);
         const i = createStepInput();
         for (let ms = 0; ms < 8000 && r.ended === null; ms++) {
            i.left = rng() < 0.01;
            i.right = rng() < 0.01;
            i.yaw = rng() * Math.PI * 2;
            const z0 = r.hero.z;
            step(r, 1, i);
            expect(z0 - r.hero.z).toBeLessThanOrEqual(r.course.vMax / 1000 + 1e-9);
         }
      }
   });
});

describe("the camera", () => {
   it("the intro ends on the orbit's first pose (playCamera), portrait farther back", () => {
      for (const level of LEVEL_IDS) {
         const c = createRun(1, level).course;
         for (const aspect of [1.6, 0.46]) {
            const lane = Math.floor((c.lanes - 1) / 2);
            const p = orbitPivot(laneX(lane, c.lanes), 0, c.startZ, c.speed, { x: 0, y: 0, z: 0 });
            const want = orbitPosition(p.x, p.y, p.z, DOOR_ORBIT.yaw!, DOOR_ORBIT.pitch!, DOOR_ORBIT.distance! * orbitScale(aspect, c.lanes), { x: 0, y: 0, z: 0 });
            const got = playCamera(c, aspect);
            expect(got.position[0]).toBeCloseTo(want.x, 6);
            expect(got.position[1]).toBeCloseTo(want.y, 6);
            expect(got.position[2]).toBeCloseTo(want.z, 6);
            expect(got.lookAt[1]).toBeCloseTo(p.y + orbitLookUp(aspect), 6);
         }
         expect(introKeyframes(c).length).toBeGreaterThanOrEqual(3);
      }
      expect(orbitScale(0.46, 5)).toBeGreaterThan(orbitScale(1.6, 5));
   });

   it("the start view stands behind the runner (+z), above the floor, looking down the hall", () => {
      const c = createRun(1).course;
      const pose = playCamera(c, 1.6);
      expect(pose.position[2]).toBeGreaterThan(c.startZ);
      expect(pose.position[1]).toBeGreaterThan(1.5);
      expect(pose.lookAt[2]).toBeLessThan(pose.position[2]);
   });

   it("courseSolids gives the floor box under the camera", () => {
      const r = createRun(1, 2);
      const out: AABB[] = Array.from({ length: 8 }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
      const n = courseSolids(r, -100, out);
      expect(n).toBe(1);
      expect(out[0].max.y).toBeLessThanOrEqual(0);
   });
});

describe("the hero pick", () => {
   it("World 1's lead, Riko, is preselected; the player's pick is remembered", () => {
      setHeroPickStorage(memoryHeroStorage());
      resetHeroPick();
      expect(defaultHeroFor("color-door-sprint")).toBe("riko");
      expect(DEFAULT_HERO).toBe("riko");
      expect(pickedHero()).toBe("riko");
      selectHero("vexa");
      resetHeroPick();
      expect(pickedHero()).toBe("vexa");
   });
});
