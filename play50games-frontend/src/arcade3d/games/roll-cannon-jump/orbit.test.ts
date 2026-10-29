// Roll Cannon Jump with the shared orbit camera (menu2/camera): the camera yaw turns the nudge and
// the walk (never the barrel), the honest bot is unchanged at yaw 0, a random yaw never beats the
// floor, the intro ends on the orbit's first pose behind cannon 0, the camera's solids, and the
// preselected hero (W1: Riko).
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import type { AABB } from "@/arcade3d/core/collision";
import { createOrbit, orbitPosition } from "@/arcade3d/menu2/camera/orbit";
import { defaultHeroFor, memoryHeroStorage, setHeroPickStorage } from "@/arcade3d/menu2/heroes/heroPick";
import { createBot, botInput } from "./bot";
import { aimPivot, cannonOrbit, courseSolids, orbitLookUp, orbitScale, playCamera } from "./camera";
import { COURSE, PROPOSED_LEVEL_LIMITS, createRun, createStepInput, runTimeMs, step, type CannonRun } from "./rules";
import { DEFAULT_HERO, pickedHero, resetHeroPick, selectHero } from "./heroes";

function botRun(level: 1 | 3, yaw?: number): CannonRun {
   const run = createRun(1, level);
   const bot = createBot(run, 1000 / 60);
   const input = createStepInput();
   for (let f = 0; f < 100_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      if (yaw !== undefined) input.yaw = yaw;
      step(run, 1000 / 60, input);
   }
   return run;
}

describe("camera-relative input", () => {
   it("the bot is unchanged with the camera yaw written as 0, and wins", () => {
      for (const level of [1, 3] as const) {
         const a = botRun(level);
         const b = botRun(level, 0);
         expect(b.finishMs).toBe(a.finishMs);
         expect(b.orbs).toBe(a.orbs);
         expect(a.ended).toBe("win");
      }
   }, 120_000);

   it("the camera yaw turns the walk (up walks away from the camera) but never the barrel", () => {
      for (const yaw of [0.6, Math.PI / 2, -2.2]) {
         const run = createRun(1, 1);
         const p = run.course.platforms[0];
         Object.assign(run.hero, { mode: "walk", support: 0, x: p.x, y: p.y + 0.5, z: p.z });
         const input = { ...createStepInput(), moveZ: -1, yaw };
         for (let i = 0; i < 20; i++) step(run, 10, input);
         expect((run.hero.x - p.x) * Math.sin(yaw) + (run.hero.z - p.z) * Math.cos(yaw)).toBeLessThan(0);
         const aim = createRun(1, 2);
         const ref = createRun(1, 2);
         for (let i = 0; i < 20; i++) {
            step(aim, 10, { ...createStepInput(), moveX: 1, yaw });
            step(ref, 10, { ...createStepInput(), moveX: 1 });
         }
         expect(aim.hero.yaw).toBe(ref.hero.yaw);
      }
   });

   it("spam with a random camera yaw every frame never beats the floor", () => {
      const rng = createRng(5);
      for (let k = 0; k < 40; k++) {
         const run = createRun(k, 1);
         const input = createStepInput();
         for (let f = 0; f < 4000 && run.ended === null; f++) {
            input.moveX = rng() * 2 - 1;
            input.moveZ = rng() * 2 - 1;
            input.yaw = (rng() * 2 - 1) * 10;
            input.jumpPressed = rng() < 0.1;
            input.jumpHeld = rng() < 0.5;
            input.actionPressed = rng() < 0.05;
            step(run, 4 + rng() * 40, input);
         }
         if (run.ended === "win") expect(runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].minDurationMs);
      }
   }, 120_000);
});

describe("orbit camera adoption", () => {
   it("the intro ends exactly on the orbit's first pose: behind the start cannon's barrel, above it", () => {
      for (const aspect of [1.6, 390 / 844]) {
         const play = playCamera(COURSE, aspect);
         const o = createOrbit(cannonOrbit(COURSE));
         const c = COURSE.cannons[0];
         const p = aimPivot(c.x, c.y, c.z, c.yaw, { x: 0, y: 0, z: 0 });
         const cam = orbitPosition(p.x, p.y, p.z, o.viewYaw, o.viewPitch, o.viewDistance * orbitScale(aspect), { x: 0, y: 0, z: 0 });
         expect(play.position[0]).toBeCloseTo(cam.x, 9);
         expect(play.position[1]).toBeCloseTo(cam.y, 9);
         expect(play.position[2]).toBeCloseTo(cam.z, 9);
         expect(play.lookAt).toEqual([p.x, p.y + orbitLookUp(aspect), p.z]);
         expect(cam.z).toBeGreaterThan(c.z);
         expect(cam.y).toBeGreaterThan(c.y);
      }
   });

   it("the camera's solids are the nearby ones, inside the capacity", () => {
      const run = createRun(1, 2);
      const out: AABB[] = Array.from({ length: 256 }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
      const c = run.course.cannons[0];
      const n = courseSolids(run, 0, c.x, c.y, c.z + 6, out);
      expect(n).toBeGreaterThan(0);
      expect(courseSolids(run, 0, c.x, c.y, c.z + 6, out.slice(0, 2))).toBeLessThanOrEqual(2);
   });
});

describe("the preselected hero", () => {
   it("Roll Cannon Jump (W1 Ember Heights) preselects Riko; the player's own pick is kept", () => {
      setHeroPickStorage(memoryHeroStorage());
      resetHeroPick();
      expect(defaultHeroFor("roll-cannon-jump", null)).toBe("riko");
      expect(pickedHero()).toBe("riko");
      selectHero("vexa");
      resetHeroPick();
      expect(pickedHero()).toBe("vexa");
      expect(createRun(1).heroId).toBe(DEFAULT_HERO);
      selectHero(DEFAULT_HERO);
   });
});
