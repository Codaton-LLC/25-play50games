// Gem Collector 3D with the shared orbit camera (menu2/camera): camera-relative movement through
// the rules' own input (StepInput.yaw), the start view looking across the vault, the intro ending on
// the orbit's first pose, the camera's solid boxes, level 5's framing of the Glutton, and the
// preselected hero (W4: Zuno).
import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import type { AABB } from "@/arcade3d/core/collision";
import { createOrbit, orbitPosition, orbitRotate } from "@/arcade3d/menu2/camera/orbit";
import { defaultHeroFor, memoryHeroStorage, setHeroPickStorage } from "@/arcade3d/menu2/heroes/heroPick";
import { LEVEL_IDS } from "@/arcade3d/types";
import { arenaFor } from "./arena";
import { arenaSolids, orbitLookUp, orbitScale, playCamera, steerBossFraming, vaultOrbit } from "./camera";
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

   it("from each level's start view, up on the stick rolls into the vault (+z)", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(1, id);
         const i = createStepInput();
         i.moveZ = -1;
         i.yaw = vaultOrbit(run.arena).yaw ?? 0;
         const z0 = run.hero.z;
         for (let f = 0; f < 20; f++) step(run, 1000 / 60, i);
         expect(run.hero.z, `L${id}`).toBeGreaterThan(z0 + 0.5);
      }
   });

   it("the intro ends on the orbit's first pose, at every aspect", () => {
      for (const id of LEVEL_IDS) {
         const a = arenaFor(id);
         for (const aspect of [1.6, 0.46]) {
            const o = vaultOrbit(a);
            const want = orbitPosition(a.startX, 1, a.startZ, o.yaw ?? 0, o.pitch ?? 0, (o.distance ?? 11) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
            const pose = playCamera(a, aspect);
            expect(pose.position[0]).toBeCloseTo(want.x, 9);
            expect(pose.position[1]).toBeCloseTo(want.y, 9);
            expect(pose.position[2]).toBeCloseTo(want.z, 9);
            expect(pose.lookAt[1]).toBeCloseTo(1 + orbitLookUp(aspect), 9);
         }
      }
   });

   it("the camera's solids: the walls (not a broken cracked wall), the pedestals, the Glutton", () => {
      const run = createRun(1, 5);
      const out: AABB[] = Array.from({ length: 64 }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
      const before = arenaSolids(run, 0, 0, out);
      expect(before).toBe(run.arena.solids.length + run.arena.pedestals.length + 1);
      run.wallBroken[0] = 1;
      expect(arenaSolids(run, 0, 0, out)).toBe(before - 1);
   });
});

describe("level 5 keeps the Glutton in shot", () => {
   it("with the orbit idle the yaw swings to look from the hero toward him; manual input wins", () => {
      const run = createRun(1, 5);
      run.hero.x = -8;
      run.hero.z = -6;
      const orbit = createOrbit(vaultOrbit(run.arena));
      orbitRotate(orbit, 1, 0);
      const yaw = orbit.yaw;
      expect(steerBossFraming(orbit, run, 1 / 60)).toBe(false);
      expect(orbit.yaw).toBe(yaw);
      orbit.idle = orbit.settings.autoFollowDelay;
      for (let f = 0; f < 240; f++) steerBossFraming(orbit, run, 1 / 60);
      // the camera sits behind the hero on the line to the Glutton
      const g = run.glutton;
      const want = Math.atan2(-(g.x - run.hero.x), -(g.z - run.hero.z));
      expect(Math.abs(Math.atan2(Math.sin(orbit.yaw - want), Math.cos(orbit.yaw - want)))).toBeLessThan(0.05);
      const r1 = createRun(1, 1);
      const o1 = createOrbit(vaultOrbit(r1.arena));
      o1.idle = 99;
      expect(steerBossFraming(o1, r1, 1 / 60)).toBe(false);
   });
});

describe("the preselected hero", () => {
   it("World 4's lead is Zuno; a pick is remembered for the next run", () => {
      setHeroPickStorage(memoryHeroStorage());
      resetHeroPick();
      expect(defaultHeroFor("gem-collector-3d")).toBe("zuno");
      expect(DEFAULT_HERO).toBe("zuno");
      expect(pickedHero()).toBe("zuno");
      selectHero("vexa");
      expect(pickedHero()).toBe("vexa");
      resetHeroPick();
   });
});
