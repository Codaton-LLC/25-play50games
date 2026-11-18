// Ring Jump Challenge with the shared orbit camera (menu2/camera): camera-relative steering through
// the rules' own input (StepInput.yaw), the honest bot unchanged at the default yaw, the FOV that opens
// with the fall, the intro ending on the orbit's first pose, and the preselected hero (W2: Nami).
import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import { createOrbit, orbitPosition } from "@/arcade3d/menu2/camera/orbit";
import { defaultHeroFor } from "@/arcade3d/menu2/heroes/heroPick";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { FOV, FOV_SPEED_GAIN, RING_ORBIT, WALL_BOXES, fovFor, introKeyframes, orbitPivot, orbitScale, playCamera, shaftSolids } from "./camera";
import { shaftRadius } from "./canyon";
import { V_SPREAD, VMAX, courseFor, createRun, createStepInput, step, type RingRun } from "./rules";
import { DEFAULT_HERO } from "./heroes";

function botRun(level: LevelId, yaw?: number): RingRun {
   const run = createRun(1, level);
   const bot = createBot(run, 1000 / 60);
   const input = createStepInput();
   for (let f = 0; f < 600_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      if (yaw !== undefined) input.yaw = yaw;
      step(run, 1000 / 60, input);
   }
   return run;
}

const outcome = (r: RingRun) => ({ ended: r.ended, finishMs: r.finishMs, score: r.score, rings: r.rings, x: r.hero.x, y: r.hero.y, z: r.hero.z });

describe("camera-relative steering is part of the rules' input", () => {
   it("the honest bot's results are unchanged with the yaw fixed at the default (0) on every level", () => {
      expect(RING_ORBIT.yaw ?? 0).toBe(0);
      for (const level of LEVEL_IDS) {
         const plain = botRun(level);
         const fixed = botRun(level, 0);
         expect(outcome(fixed)).toEqual(outcome(plain));
         expect(plain.ended).toBe("win");
      }
   }, 120_000);

   it("a turned camera turns the stick: up steers away from the camera at any yaw, the same as the world input", () => {
      for (const yaw of [0.5, Math.PI / 2, -2.4, Math.PI]) {
         const make = () => {
            const r = createRun(3, 1);
            const leap = createStepInput();
            leap.jumpPressed = true;
            step(r, 1, leap);
            r.hero.leapAt = -10_000;
            r.hero.x = 0;
            r.hero.z = 0;
            r.hero.y = 200;
            return r;
         };
         const a = make();
         const b = make();
         const turned = createStepInput();
         turned.moveZ = -1;
         turned.yaw = yaw;
         const w = inputToWorld(0, -1, yaw);
         const world = createStepInput();
         world.moveX = w.x;
         world.moveZ = w.z;
         for (let f = 0; f < 30; f++) {
            step(a, 1000 / 60, turned);
            step(b, 1000 / 60, world);
         }
         expect(a.hero.x).toBeCloseTo(b.hero.x, 9);
         expect(a.hero.z).toBeCloseTo(b.hero.z, 9);
         // away from a camera at pivot + (sin yaw, cos yaw)
         expect(a.hero.x * Math.sin(yaw) + a.hero.z * Math.cos(yaw)).toBeLessThan(0);
      }
   });
});

describe("the camera", () => {
   it("looks steeply down the shaft (the card: top-down-ish), farther back on a portrait phone", () => {
      expect(RING_ORBIT.pitch!).toBeGreaterThan((55 * Math.PI) / 180);
      expect(orbitScale(0.46)).toBeGreaterThan(orbitScale(1.6));
      expect(orbitScale(1.6)).toBe(1);
   });

   it("the FOV opens from the base at a spread fall to +20° at the fastest dive (the card: 60° to 80°)", () => {
      expect(fovFor(FOV, V_SPREAD)).toBe(60);
      expect(fovFor(FOV, VMAX)).toBe(60 + FOV_SPEED_GAIN);
      expect(fovFor(FOV, 0)).toBe(60);
      expect(fovFor(FOV, 30)).toBeGreaterThan(60);
   });

   it("the intro rises from the sea to the rim and ends exactly on the orbit's first pose", () => {
      for (const level of LEVEL_IDS) {
         const c = courseFor(level);
         const keys = introKeyframes(c);
         expect(keys[0].position[1]).toBeLessThan(keys[keys.length - 1].position[1]);
         for (const aspect of [1.6, 0.46]) {
            const play = playCamera(c, aspect);
            const orbit = createOrbit(RING_ORBIT);
            const p = orbitPivot(c.startX, c.top, c.startZ, true, { x: 0, y: 0, z: 0 });
            const pos = orbitPosition(p.x, p.y, p.z, orbit.viewYaw, orbit.viewPitch, orbit.viewDistance * orbitScale(aspect), { x: 0, y: 0, z: 0 });
            expect(play.position[0]).toBeCloseTo(pos.x, 6);
            expect(play.position[1]).toBeCloseTo(pos.y, 6);
            expect(play.position[2]).toBeCloseTo(pos.z, 6);
         }
      }
   });

   it("the camera collides with the shaft wall: a closed ring of boxes outside the wall, none over the shaft's inner 80 %", () => {
      const c = courseFor(4);
      for (const y of [500, 300, 100]) {
         const out = Array.from({ length: 64 }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
         expect(shaftSolids(c, y, out)).toBe(WALL_BOXES);
         const R = shaftRadius(c, y);
         for (const b of out.slice(0, WALL_BOXES)) {
            const nx = Math.max(b.min.x, Math.min(0, b.max.x));
            const nz = Math.max(b.min.z, Math.min(0, b.max.z));
            expect(Math.hypot(nx, nz)).toBeGreaterThan(R * 0.8 - 1e-9);
            expect(b.min.y).toBeLessThan(y);
            expect(b.max.y).toBeGreaterThan(y);
         }
      }
   });

   it("World 2's lead, Nami, is preselected and is the rules' default", () => {
      expect(defaultHeroFor("ring-jump-challenge", null)).toBe("nami");
      expect(DEFAULT_HERO).toBe("nami");
      expect(createRun(1).heroId).toBe("nami");
   });
});
