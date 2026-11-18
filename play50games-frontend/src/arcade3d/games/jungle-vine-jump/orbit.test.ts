// Jungle Vine Jump with the shared orbit camera (menu2/camera): the camera yaw turns the walk and maps
// Left / Right onto the swing, the honest bot is unchanged at yaw 0, a random yaw never beats the climb
// floor, the camera helpers (the side view outside the ring), and the preselected hero (World 3: Kiro).
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import type { AABB } from "@/arcade3d/core/collision";
import { createBot, botInput } from "./bot";
import { courseSolids, introKeyframes, inwardTravel, orbitLookUp, orbitScale, outsideYaw, playCamera, vineOrbit } from "./camera";
import { PROPOSED_LEVEL_LIMITS, createRun, createStepInput, pumpSense, runTimeMs, step, type VineRun } from "./rules";
import { DEFAULT_HERO, pickedHero, resetHeroPick, selectHero } from "./heroes";

function botRun(level: 1 | 3, yaw?: number): VineRun {
   const run = createRun(1, level);
   const bot = createBot(run, 1000 / 60);
   const input = createStepInput();
   for (let f = 0; f < 200_000 && run.ended === null; f++) {
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

   it("up on the stick walks away from the camera at any yaw", () => {
      for (const yaw of [0.6, Math.PI / 2, -2.2]) {
         const run = createRun(1, 1);
         const x0 = run.hero.x;
         const z0 = run.hero.z;
         const input = { ...createStepInput(), moveZ: -1, yaw };
         for (let i = 0; i < 12; i++) step(run, 10, input);
         expect((run.hero.x - x0) * Math.sin(yaw) + (run.hero.z - z0) * Math.cos(yaw)).toBeLessThan(0);
      }
   });

   it("Left / Right pumps the way the swing looks on screen: screen-right along the vine's direction is +1", () => {
      const v = createRun(1, 1).course.vines[0];
      // looking in from outside the ring at the vine: the camera's right is along the route
      const yaw = outsideYaw(v.x, v.z);
      const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
      const expected = v.dx * right.x + v.dz * right.z >= -0.15 ? 1 : -1;
      expect(pumpSense(v, yaw)).toBe(expected);
      expect(pumpSense(v, yaw + Math.PI)).toBe(-expected);
   });

   it("a random yaw each frame never beats the climb floor", () => {
      const rng = createRng(4);
      const run = createRun(1, 1);
      const bot = createBot(run);
      const input = createStepInput();
      for (let f = 0; f < 200_000 && run.ended === null; f++) {
         botInput(bot, run, input);
         if (f % 40 === 0) input.yaw = rng() * 6.28;
         step(run, 1000 / 60, input);
      }
      if (run.ended === "win") expect(runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].minDurationMs);
   }, 120_000);
});

describe("camera helpers", () => {
   it("the orbit starts outside the start branch looking in, and scales with the aspect", () => {
      const run = createRun(1, 1);
      const s = run.course.pads[run.course.route[0].pad];
      const o = vineOrbit(run.course);
      expect(o.yaw).toBeCloseTo(outsideYaw(s.x, s.z), 9);
      // looking in: the camera looks along -(sin yaw, cos yaw) (up on the stick walks that way), at the trunk
      const vx = -Math.sin(o.yaw!);
      const vz = -Math.cos(o.yaw!);
      expect(vx * -s.x + vz * -s.z).toBeGreaterThan(0);
      expect(orbitScale(0.5)).toBeGreaterThan(orbitScale(1.8));
      expect(Number.isFinite(orbitLookUp(0.5))).toBe(true);
      expect(playCamera(run.course, 1.6).position.every(Number.isFinite)).toBe(true);
      expect(introKeyframes(run.course).length).toBeGreaterThan(1);
      const t = inwardTravel(10, 0, { x: 0, z: 0 });
      expect(t.x).toBeLessThan(0);
      expect(t.z).toBeCloseTo(0, 9);
   });

   it("courseSolids lists boxes near the camera only", () => {
      const run = createRun(1, 1);
      const out: AABB[] = Array.from({ length: 64 }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
      const n = courseSolids(run, 0, 1, 30, out);
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThanOrEqual(out.length);
   });
});

describe("hero pick", () => {
   it("defaults to Kiro and takes a pick", () => {
      resetHeroPick();
      expect(DEFAULT_HERO).toBe("kiro");
      selectHero("zuno");
      expect(pickedHero()).toBe("zuno");
      resetHeroPick();
   });
});
