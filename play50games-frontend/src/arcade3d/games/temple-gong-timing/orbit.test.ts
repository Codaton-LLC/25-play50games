// Temple Gong Timing with the shared orbit camera (menu2/camera): the bot is unchanged at camera yaw 0,
// a random yaw never lifts the score over the bound, the stage camera's helpers, and the preselected
// hero (World 3: Kiro).
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { createBot, botInput } from "./bot";
import { introKeyframes, orbitScale, playCamera, stageOrbit, stagePivot } from "./camera";
import { stageFor } from "./chart";
import { PROPOSED_LEVEL_LIMITS, createRun, createStepInput, step, type GongRun } from "./rules";
import { DEFAULT_HERO, pickedHero, resetHeroPick, selectHero } from "./heroes";

function botRun(level: 1 | 4, yaw?: number): GongRun {
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
      for (const level of [1, 4] as const) {
         const a = botRun(level);
         const b = botRun(level, 0);
         expect(b.score).toBe(a.score);
         expect(b.echoCount).toBe(a.echoCount);
         expect(a.ended).toBe("win");
      }
   }, 120_000);

   it("a random yaw and stick each frame never beats the score bound", () => {
      const rng = createRng(4);
      const lim = PROPOSED_LEVEL_LIMITS[3];
      const run = createRun(1, 3, "riko");
      const bot = createBot(run);
      const input = createStepInput();
      for (let f = 0; f < 200_000 && run.ended === null; f++) {
         botInput(bot, run, input);
         if (f % 40 < 20) {
            input.yaw = rng() * 6.28;
            input.moveX = rng() * 2 - 1;
            input.moveZ = rng() * 2 - 1;
         }
         step(run, 1000 / 60, input);
         expect(run.score).toBeLessThanOrEqual(lim.base + (lim.maxPointsPerSec * run.simMs) / 1000 + 1e-6);
      }
      expect(run.score).toBeLessThanOrEqual(lim.maxScore);
   }, 120_000);
});

describe("the stage camera", () => {
   it("looks over the stage from the front, high, with its own auto-follow off", () => {
      for (const id of [1, 5] as const) {
         const o = stageOrbit(stageFor(id));
         expect(o.autoFollow).toBe(false);
         expect(o.pitch!).toBeGreaterThan(0.5);
         expect(o.minDistance!).toBeLessThan(o.distance!);
         expect(o.maxDistance!).toBeGreaterThan(o.distance!);
      }
      expect(orbitScale(0.46)).toBeGreaterThan(orbitScale(1.6));
      const k = playCamera(stageFor(1), 1.6);
      expect(k.position.every(Number.isFinite)).toBe(true);
      expect(k.position[1]).toBeGreaterThan(5);
      expect(introKeyframes().length).toBeGreaterThan(1);
   });

   it("the pivot leans towards the hero, 35 % of the way", () => {
      const p = stagePivot({ x: 6, z: 6 }, { x: 0, y: 0, z: 0 });
      expect(p.x).toBeCloseTo(2.1, 6);
      expect(p.z).toBeCloseTo(2.1 - 1, 6);
   });
});

describe("hero pick", () => {
   it("defaults to Kiro and takes a pick", () => {
      resetHeroPick();
      expect(DEFAULT_HERO).toBe("kiro");
      expect(pickedHero()).toBe("kiro");
      selectHero("vexa");
      expect(pickedHero()).toBe("vexa");
      resetHeroPick();
   });
});
