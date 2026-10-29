// Toy Room Run with the shared orbit camera (menu2/camera): camera-relative movement through
// the rules' own input (StepInput.yaw), the start view looking down the room, the intro ending on
// the orbit's first pose, the camera's solid boxes, and the preselected hero (W4: Zuno).
import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import type { AABB } from "@/arcade3d/core/collision";
import { createOrbit, orbitPosition, orbitRotate, stepOrbit } from "@/arcade3d/menu2/camera/orbit";
import { defaultHeroFor, memoryHeroStorage, setHeroPickStorage } from "@/arcade3d/menu2/heroes/heroPick";
import { LEVEL_IDS } from "@/arcade3d/types";
import { BOSS_FRAME, roomOrbit, courseSolids, orbitLookUp, orbitPivot, orbitScale, playCamera, steerBossFraming } from "./camera";
import { createBot, botInput } from "./bot";
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

/** The horizontal angle (deg) between the camera's view (camera -> pivot) and a point. */
function offAxis(cam: { x: number; z: number }, piv: { x: number; z: number }, x: number, z: number): number {
   const fx = piv.x - cam.x;
   const fz = piv.z - cam.z;
   const px = x - cam.x;
   const pz = z - cam.z;
   return (Math.abs(Math.atan2(fx * pz - fz * px, fx * px + fz * pz)) * 180) / Math.PI;
}

describe("level 5's boss framing keeps Jack in shot", () => {
   it("through every vulnerable window of an honest run, Jack and the hero stay inside a phone's view (half-width 15 deg)", () => {
      for (const fps of [30, 60]) {
         const dt = 1 / fps;
         const run = createRun(1, 5);
         const bot = createBot(run, 1000 / fps);
         const input = createStepInput();
         const orbit = createOrbit(roomOrbit(run.course));
         const piv = { x: 0, y: 0, z: 0 };
         const cam = { x: 0, y: 0, z: 0 };
         let samples = 0;
         let worst = 0;
         for (let f = 0; f < fps * 120 && run.ended === null; f++) {
            botInput(bot, run, input);
            step(run, 1000 / fps, input);
            steerBossFraming(orbit, run, dt);
            stepOrbit(orbit, dt, 0, 0, false);
            orbitPivot(run, piv);
            orbitPosition(piv.x, piv.y, piv.z, orbit.viewYaw, orbit.viewPitch, orbit.viewDistance, cam);
            if (run.boss && run.boss.hp > 0 && run.boss.step === "vulnerable") {
               samples++;
               worst = Math.max(worst, offAxis(cam, piv, run.jack.x, run.jack.z), offAxis(cam, piv, run.hero.x, run.hero.z));
            }
         }
         expect(run.ended, `${fps}`).toBe("win");
         expect(samples).toBeGreaterThan(fps * 5);
         expect(worst, `${fps} fps`).toBeLessThan(10);
      }
   }, 60_000);

   it("the pivot leans toward Jack (at most BOSS_FRAME.maxLead); other levels keep the small lead", () => {
      const run = createRun(1, 5);
      run.hero.x = 0;
      run.hero.z = 2;
      run.jack.x = 0;
      run.jack.z = 28;
      const p = orbitPivot(run, { x: 0, y: 0, z: 0 });
      expect(p.z - run.hero.z).toBeCloseTo(BOSS_FRAME.maxLead, 6);
      const r1 = createRun(1, 1);
      const p1 = orbitPivot(r1, { x: 0, y: 0, z: 0 });
      expect(Math.hypot(p1.x - r1.hero.x, p1.z - r1.hero.z)).toBeLessThanOrEqual(2.5 + 1e-9);
   });

   it("manual input wins: no steering until the orbit has been idle for its auto-follow delay; none on other levels or after the defeat", () => {
      const run = createRun(1, 5);
      run.hero.x = -8;
      run.hero.z = 4;
      const orbit = createOrbit(roomOrbit(run.course));
      orbitRotate(orbit, 1, 0);
      const yaw = orbit.yaw;
      expect(steerBossFraming(orbit, run, 1 / 60)).toBe(false);
      expect(orbit.yaw).toBe(yaw);
      orbit.idle = orbit.settings.autoFollowDelay;
      expect(steerBossFraming(orbit, run, 1 / 60)).toBe(true);
      expect(orbit.yaw).not.toBe(yaw);
      run.boss!.hp = 0;
      expect(steerBossFraming(orbit, run, 1 / 60)).toBe(false);
      const r1 = createRun(1, 1);
      const o1 = createOrbit(roomOrbit(r1.course));
      o1.idle = 99;
      expect(steerBossFraming(o1, r1, 1 / 60)).toBe(false);
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
