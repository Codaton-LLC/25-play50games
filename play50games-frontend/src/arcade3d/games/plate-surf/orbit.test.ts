// Plate Surf with the shared orbit camera (menu2/camera): camera-relative movement through the rules'
// own input (StepInput.yaw), the default view's stick (right climbs the face, it never brakes), the
// proof's z guard for any yaw, the intro ending on the orbit's first pose, the camera's solid boxes,
// and the preselected hero (W2: Nami).
import { describe, expect, it } from "vitest";
import { createRng, inputToWorld } from "@/arcade3d/core/math";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition } from "@/arcade3d/menu2/camera/orbit";
import { defaultHeroFor, memoryHeroStorage, setHeroPickStorage } from "@/arcade3d/menu2/heroes/heroPick";
import { LEVEL_IDS } from "@/arcade3d/types";
import { SURF_ORBIT, courseSolids, introKeyframes, orbitLookUp, orbitPivot, orbitScale, playCamera } from "./camera";
import { CURL, SPAWN_X, V_MAX, createRun, createStepInput, groundY, step } from "./rules";
import { DEFAULT_HERO, pickedHero, resetHeroPick, selectHero } from "./heroes";
import { FACE_W } from "./waves";

describe("camera-relative movement is part of the rules' input", () => {
   it("a turned camera turns the stick the same as the world input", () => {
      for (const yaw of [0.5, Math.PI / 2, -2.4, Math.PI]) {
         const a = createRun(3);
         const b = createRun(3);
         const turned = createStepInput();
         turned.moveX = 1;
         turned.yaw = yaw;
         const w = inputToWorld(1, 0, yaw);
         const world = createStepInput();
         world.moveX = w.x;
         world.moveZ = w.z;
         for (let f = 0; f < 20; f++) {
            step(a, 1000 / 60, turned);
            step(b, 1000 / 60, world);
         }
         expect(a.hero.x).toBeCloseTo(b.hero.x, 9);
         expect(a.hero.v).toBeCloseTo(b.hero.v, 9);
      }
   });

   it("from the start view, right on the stick climbs the face without braking; left carves down; back brakes", () => {
      const yaw = SURF_ORBIT.yaw ?? 0;
      const run = (moveX: number, moveZ: number) => {
         const r = createRun(1);
         const i = createStepInput();
         i.moveX = moveX;
         i.moveZ = moveZ;
         i.yaw = yaw;
         for (let f = 0; f < 15; f++) step(r, 1000 / 60, i);
         return r;
      };
      const idle = run(0, 0);
      const right = run(1, 0);
      const left = run(-1, 0);
      const back = run(0, 1);
      expect(right.hero.x).toBeGreaterThan(SPAWN_X + 0.5);
      expect(left.hero.x).toBeLessThan(SPAWN_X - 0.5);
      expect(right.hero.v).toBeCloseTo(idle.hero.v, 6);
      expect(back.hero.v).toBeLessThan(idle.hero.v - 0.5);
   });

   it("the z guard holds for any yaw: random sticks under random turning cameras never pass V_MAX/1000 a ms", () => {
      const rng = createRng(99);
      for (const level of LEVEL_IDS) {
         const r = createRun(5, level);
         const i = createStepInput();
         for (let ms = 0; ms < 8000 && r.ended === null; ms++) {
            if (ms % 50 === 0) {
               i.moveX = rng() * 2 - 1;
               i.moveZ = rng() * 2 - 1;
               i.yaw = rng() * Math.PI * 2;
            }
            const z0 = r.hero.z;
            step(r, 1, i);
            expect(z0 - r.hero.z).toBeLessThanOrEqual(V_MAX / 1000 + 1e-9);
         }
      }
   });
});

describe("the camera", () => {
   it("the intro ends on the orbit's first pose (playCamera), portrait farther back", () => {
      for (const level of LEVEL_IDS) {
         const c = createRun(1, level).course;
         for (const aspect of [1.6, 0.46]) {
            const p = orbitPivot(SPAWN_X, groundY(c, SPAWN_X), c.startZ, 13, { x: 0, y: 0, z: 0 });
            const want = orbitPosition(p.x, p.y, p.z, SURF_ORBIT.yaw!, SURF_ORBIT.pitch!, SURF_ORBIT.distance! * orbitScale(aspect), { x: 0, y: 0, z: 0 });
            const got = playCamera(c, aspect);
            expect(got.position[0]).toBeCloseTo(want.x, 6);
            expect(got.position[1]).toBeCloseTo(want.y, 6);
            expect(got.position[2]).toBeCloseTo(want.z, 6);
            expect(got.lookAt[1]).toBeCloseTo(p.y + orbitLookUp(aspect), 6);
         }
         expect(introKeyframes(c).length).toBeGreaterThanOrEqual(3);
      }
      expect(orbitScale(0.46)).toBeGreaterThan(orbitScale(1.6));
   });

   it("the start view stands behind the rider out over the trough, above the water, in front of the wave", () => {
      const c = createRun(1).course;
      const pose = playCamera(c, 1.6);
      expect(pose.position[0]).toBeLessThan(SPAWN_X);
      expect(pose.position[2]).toBeGreaterThan(c.startZ);
      expect(pose.position[1]).toBeGreaterThan(groundY(c, pose.position[0]) + 1);
      // the curl starts behind the camera's view, not on top of it
      expect(c.startZ + CURL.startGap).toBeGreaterThan(pose.position[2]);
   });

   it("courseSolids fills the wave's body boxes near the camera", () => {
      const r = createRun(1, 2);
      const out: AABB[] = Array.from({ length: 64 }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
      const n = courseSolids(r, FACE_W / 2, 5, -180, out);
      expect(n).toBeGreaterThan(5);
      for (let k = 0; k < n; k++) expect(out[k].max.x).toBeGreaterThan(out[k].min.x);
   });
});

describe("the hero pick", () => {
   it("World 2's lead, Nami, is preselected; the player's pick is remembered", () => {
      setHeroPickStorage(memoryHeroStorage());
      resetHeroPick();
      expect(defaultHeroFor("plate-surf")).toBe("nami");
      expect(DEFAULT_HERO).toBe("nami");
      expect(pickedHero()).toBe("nami");
      selectHero("riko");
      resetHeroPick();
      expect(pickedHero()).toBe("riko");
   });
});
