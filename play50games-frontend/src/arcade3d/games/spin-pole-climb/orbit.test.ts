// Spin Pole Climb with the shared orbit camera (menu2/camera): the bot is unchanged at camera yaw 0, a
// random yaw never beats the climb floor, the camera follows round the pole only once left alone (and
// never faster than its cap), the camera helpers, and the preselected hero (World 3: Kiro).
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import type { AABB } from "@/arcade3d/core/collision";
import { createOrbit, orbitRotate } from "@/arcade3d/menu2/camera/orbit";
import { createBot, botInput } from "./bot";
import { FOLLOW_DELAY, FOLLOW_MAX, courseSolids, followPole, introKeyframes, orbitLookUp, orbitScale, playCamera, spinOrbit } from "./camera";
import { PROPOSED_LEVEL_LIMITS, createRun, createStepInput, runTimeMs, step, type SpinRun } from "./rules";
import { DEFAULT_HERO, pickedHero, resetHeroPick, selectHero } from "./heroes";

function botRun(level: 1 | 3, yaw?: number): SpinRun {
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

describe("the camera follows round the pole", () => {
   it("only after the player leaves it alone, and never faster than its cap", () => {
      const o = createOrbit({ yaw: 0, autoFollow: false });
      orbitRotate(o, 0.01, 0);
      o.idle = 0.2;
      followPole(o, 2, 0.1);
      expect(o.yaw).toBeCloseTo(0.01, 6);
      o.idle = FOLLOW_DELAY + 0.1;
      const before = o.yaw;
      followPole(o, 2.5, 0.1);
      expect(o.yaw - before).toBeGreaterThan(0);
      expect(o.yaw - before).toBeLessThanOrEqual(FOLLOW_MAX * 0.1 + 1e-9);
   });
});

describe("camera helpers", () => {
   it("the orbit starts out behind the start and scales with the aspect", () => {
      const run = createRun(1, 1);
      expect(spinOrbit(run.course).autoFollow).toBe(false);
      expect(orbitScale(0.5)).toBeGreaterThan(orbitScale(1.8));
      expect(Number.isFinite(orbitLookUp(0.5))).toBe(true);
      expect(playCamera(run.course, 1.6).position.every(Number.isFinite)).toBe(true);
      expect(introKeyframes(run.course).length).toBeGreaterThan(1);
   });

   it("courseSolids lists the other poles near the camera, not the hero's own", () => {
      const run = createRun(1, 1);
      const out: AABB[] = Array.from({ length: 16 }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
      const n = courseSolids(run, 0, 1, 9, out);
      expect(n).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) expect(out[i].min.x > -6.1 && out[i].max.x < -5.9).toBe(false);
   });

   it("every cap near the camera is a solid, the hero's own pole's too, as wide as its stair", () => {
      const run = createRun(1, 1);
      const c = run.course;
      const out: AABB[] = Array.from({ length: 64 }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
      const own = c.poles[c.helices[run.hero.helix].pole];
      const n = courseSolids(run, own.x, 1, own.z + 8, out);
      const capOfOwn = out.slice(0, n).some((b) => Math.abs((b.min.x + b.max.x) / 2 - own.x) < 1e-6 && b.max.x - b.min.x >= own.walk * 2);
      expect(capOfOwn).toBe(true);
      for (let i = 0; i < n; i++) expect(out[i].max.y).toBeGreaterThan(out[i].min.y);
   });
});

describe("hero pick", () => {
   it("defaults to Kiro and takes a pick", () => {
      resetHeroPick();
      expect(DEFAULT_HERO).toBe("kiro");
      expect(pickedHero()).toBe("kiro");
      selectHero("zuno");
      expect(pickedHero()).toBe("zuno");
      resetHeroPick();
   });
});
