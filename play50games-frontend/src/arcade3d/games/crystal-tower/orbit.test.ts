// Crystal Tower with the shared orbit camera (menu2/camera): camera-relative movement through the
// rules' own input (StepInput.yaw), the start view looking along the climb, the intro ending on the
// orbit's first pose, the camera's solid boxes, level 5's boss framing, and the preselected hero
// (W5: Vexa).
import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import type { AABB } from "@/arcade3d/core/collision";
import { createOrbit, orbitPosition, orbitRotate, stepOrbit } from "@/arcade3d/menu2/camera/orbit";
import { defaultHeroFor, memoryHeroStorage, setHeroPickStorage } from "@/arcade3d/menu2/heroes/heroPick";
import { LEVEL_IDS } from "@/arcade3d/types";
import { BOSS_FRAME, FOV, FOV_PORTRAIT, bossInFrame, towerOrbit, courseSolids, orbitLookUp, orbitPivot, orbitScale, playCamera, steerBossFraming } from "./camera";
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

   it("from each level's start view, up on the stick runs along the climb toward the first beacon", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(1, id);
         const i = createStepInput();
         i.moveZ = -1;
         i.yaw = towerOrbit(run.course).yaw ?? 0;
         const b = run.course.tiers[0].beacon;
         const d0 = Math.hypot(run.hero.x - b.x, run.hero.z - b.z);
         for (let f = 0; f < 20; f++) step(run, 1000 / 60, i);
         expect(Math.hypot(run.hero.x - b.x, run.hero.z - b.z), `L${id}`).toBeLessThan(d0 - 0.5);
      }
   });

   it("the intro ends on the orbit's first pose, at every aspect", () => {
      for (const id of LEVEL_IDS) {
         const c = createRun(1, id).course;
         for (const aspect of [1.6, 0.46]) {
            const o = towerOrbit(c);
            const pose = playCamera(c, aspect);
            const want = orbitPosition(c.startX, c.startY + 1.1, c.startZ, o.yaw ?? 0, o.pitch ?? 0, (o.distance ?? 0) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
            expect(pose.position[0]).toBeCloseTo(want.x, 9);
            expect(pose.position[1]).toBeCloseTo(want.y, 9);
            expect(pose.position[2]).toBeCloseTo(want.z, 9);
            expect(pose.lookAt[1]).toBeCloseTo(c.startY + 1.1 + orbitLookUp(aspect), 9);
         }
      }
   });

   it("the camera's solids: the spire, the void gate and an unbroken crystal wall (not once shattered)", () => {
      const run = createRun(1, 1);
      const out: AABB[] = Array.from({ length: 64 }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
      const w = run.course.walls[0];
      const before = courseSolids(run, w.x, w.z, out);
      expect(before).toBeGreaterThanOrEqual(2);
      run.wallBroken[0] = 1;
      expect(courseSolids(run, w.x, w.z, out)).toBe(before - 1);
   });
});

/** The share of Prism Shade's open windows (ms samples) in which the hero and he are both in the safe band. */
function framedShare(aspect: number, fps: number, steer: boolean): { share: number; samples: number; won: boolean } {
   const dt = 1 / fps;
   const run = createRun(1, 5);
   const bot = createBot(run, 1000 / fps);
   const input = createStepInput();
   const orbit = createOrbit(towerOrbit(run.course));
   const fov = aspect < 1 ? FOV_PORTRAIT : FOV;
   let samples = 0;
   let framed = 0;
   for (let f = 0; f < fps * 240 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, 1000 / fps, input);
      if (steer) steerBossFraming(orbit, run, dt, aspect);
      stepOrbit(orbit, dt, 0, 0, false);
      if (run.bossAwake && run.boss && run.boss.hp > 0 && run.boss.step === "vulnerable") {
         samples++;
         if (bossInFrame(run, orbit.viewYaw, orbit.viewPitch, orbit.viewDistance * orbitScale(aspect), orbitLookUp(aspect), fov, aspect)) framed++;
      }
   }
   return { share: samples > 0 ? framed / samples : 0, samples, won: run.ended === "win" };
}

describe("level 5's boss framing keeps Prism Shade in shot", () => {
   it("through his open windows in an honest run, the hero and Prism Shade stay on screen under the boss bar at least 95 % of the time (desktop and phone), and the framing earns its keep against the level's own view", () => {
      for (const aspect of [1280 / 800, 390 / 844]) {
         for (const fps of [30, 60]) {
            const r = framedShare(aspect, fps, true);
            expect(r.won, `${fps}`).toBe(true);
            expect(r.samples).toBeGreaterThan(fps * 5);
            expect(r.share, `aspect ${aspect.toFixed(2)} at ${fps} fps`).toBeGreaterThanOrEqual(0.95);
         }
      }
      const plain = framedShare(1.6, 60, false);
      const steered = framedShare(1.6, 60, true);
      expect(plain.share).toBeLessThan(steered.share - 0.03);
   }, 300_000);

   it("the pivot leans toward Prism Shade (at most BOSS_FRAME.maxLead); other levels keep the small lead", () => {
      const run = createRun(1, 5);
      run.bossAwake = true;
      run.hero.x = run.course.arena!.x + 6;
      run.hero.z = run.course.arena!.z;
      run.hero.y = run.course.arena!.y;
      const p = orbitPivot(run, { x: 0, y: 0, z: 0 });
      expect(run.hero.x - p.x).toBeCloseTo(Math.min(BOSS_FRAME.maxLead, 6 * BOSS_FRAME.share), 6);
      const r1 = createRun(1, 1);
      const p1 = orbitPivot(r1, { x: 0, y: 0, z: 0 });
      expect(Math.hypot(p1.x - r1.hero.x, p1.z - r1.hero.z)).toBeLessThanOrEqual(2.5 + 1e-9);
   });

   it("manual input wins: no steering until the orbit has been idle for its auto-follow delay; none before he wakes, on other levels or after the defeat", () => {
      const run = createRun(1, 5);
      const orbit = createOrbit(towerOrbit(run.course));
      run.hero.x = run.course.arena!.x - 5;
      run.hero.z = run.course.arena!.z + 2;
      orbit.idle = 99;
      expect(steerBossFraming(orbit, run, 1 / 60)).toBe(false);
      run.bossAwake = true;
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
      const o1 = createOrbit(towerOrbit(r1.course));
      o1.idle = 99;
      expect(steerBossFraming(o1, r1, 1 / 60)).toBe(false);
   });
});

describe("the preselected hero", () => {
   it("World 5's lead is Vexa; a pick is remembered for the next run", () => {
      setHeroPickStorage(memoryHeroStorage());
      resetHeroPick();
      expect(defaultHeroFor("crystal-tower")).toBe("vexa");
      expect(DEFAULT_HERO).toBe("vexa");
      expect(pickedHero()).toBe("vexa");
      selectHero("riko");
      expect(pickedHero()).toBe("riko");
      resetHeroPick();
   });
});
