// Toy Room Run with the shared orbit camera (menu2/camera): camera-relative movement through
// the rules' own input (StepInput.yaw), the start view looking down the room, the intro ending on
// the orbit's first pose, the camera's solid boxes, and the preselected hero (W4: Zuno).
import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition } from "@/arcade3d/menu2/camera/orbit";
import { defaultHeroFor, memoryHeroStorage, setHeroPickStorage } from "@/arcade3d/menu2/heroes/heroPick";
import { LEVEL_IDS } from "@/arcade3d/types";
import { roomOrbit, courseSolids, orbitLookUp, orbitScale, playCamera } from "./camera";
import { createRun, createStepInput, step } from "./rules";
import { DEFAULT_HERO, pickedHero, resetHeroPick, selectHero } from "./heroes";

describe("camera-relative movement is part of the rules' input", () => {
   it("a turned camera turns the stick exactly like the world input", () => {
      for (const yaw of [0.5, Math.PI / 2, -2.4, Math.PI]) {
         const a = createRun(3, 1);
         const b = createRun(3, 1);
         const turned = createStepInput();
         turned.moveX = 0.3;
         turned.moveZ = -1;
         turned.yaw = yaw;
         const w = inputToWorld(0.3, -1, yaw);
         const world = createStepInput();
         world.moveX = w.x;
         world.moveZ = w.z;
         for (let f = 0; f < 60; f++) {
            step(a, 1000 / 60, turned);
            step(b, 1000 / 60, world);
         }
         expect(a.hero.x).toBeCloseTo(b.hero.x, 9);
         expect(a.hero.z).toBeCloseTo(b.hero.z, 9);
      }
   });

   it("from each level's start view, up on the stick runs down the room (+z)", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(1, id);
         const i = createStepInput();
         i.moveZ = -1;
         i.yaw = roomOrbit(run.course).yaw ?? 0;
         const z0 = run.hero.z;
         for (let f = 0; f < 20; f++) step(run, 1000 / 60, i);
         expect(run.hero.z, `L${id}`).toBeGreaterThan(z0 + 0.5);
      }
   });

   it("the intro ends on the orbit's first pose, at every aspect", () => {
      for (const id of LEVEL_IDS) {
         const c = createRun(1, id).course;
         for (const aspect of [1.6, 0.46]) {
            const o = roomOrbit(c);
            const pose = playCamera(c, aspect);
            const want = orbitPosition(c.startX, 1.1, c.startZ, o.yaw ?? 0, o.pitch ?? 0, (o.distance ?? 0) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
            expect(pose.position[0]).toBeCloseTo(want.x, 9);
            expect(pose.position[1]).toBeCloseTo(want.y, 9);
            expect(pose.position[2]).toBeCloseTo(want.z, 9);
            expect(pose.lookAt[1]).toBeCloseTo(1.1 + orbitLookUp(aspect), 9);
         }
      }
   });

   it("the camera's solids: the castle, an unbroken block wall (not once broken), the shelves and ledges", () => {
      const run = createRun(1, 1);
      const out: AABB[] = Array.from({ length: 64 }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
      const w = run.course.walls[0];
      const before = courseSolids(run, w.x0, w.z0, out);
      expect(before).toBeGreaterThan(0);
      run.wallBroken[0] = 1;
      expect(courseSolids(run, w.x0, w.z0, out)).toBe(before - 1);
   });
});

describe("the preselected hero", () => {
   it("World 4's lead is Zuno; a pick is remembered for the next run", () => {
      setHeroPickStorage(memoryHeroStorage());
      resetHeroPick();
      expect(defaultHeroFor("toy-room-run")).toBe("zuno");
      expect(DEFAULT_HERO).toBe("zuno");
      expect(pickedHero()).toBe("zuno");
      selectHero("vexa");
      expect(pickedHero()).toBe("vexa");
      resetHeroPick();
   });
});
