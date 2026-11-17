// Portal Hop with the shared orbit camera (menu2/camera): the bot is unchanged at camera yaw 0, a
// random yaw never beats the floor, a teleport turns the camera at most 90 degrees, the camera helpers,
// and the preselected hero (World 5: Vexa).
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import type { AABB } from "@/arcade3d/core/collision";
import { createOrbit, wrapAngle } from "@/arcade3d/menu2/camera/orbit";
import { createBot, botInput } from "./bot";
import { TELEPORT_TURN, afterTeleport, anchorBlocksView, courseSolids, introKeyframes, orbitLookUp, orbitScale, playCamera, portalOrbit } from "./camera";
import { PROPOSED_LEVEL_LIMITS, createRun, createStepInput, step, submittedMs, type PortalRun } from "./rules";
import { DEFAULT_HERO, pickedHero, resetHeroPick, selectHero } from "./heroes";

function botRun(level: 1 | 3, yaw?: number): PortalRun {
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

   it("a random yaw each frame never beats the floor", () => {
      const rng = createRng(4);
      const run = createRun(1, 1);
      const bot = createBot(run);
      const input = createStepInput();
      for (let f = 0; f < 60 * 120 && run.ended === null; f++) {
         botInput(bot, run, input);
         if (f % 40 === 0) input.yaw = rng() * 6.28;
         step(run, 1000 / 60, input);
      }
      if (run.ended === "win") expect(submittedMs(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].minDurationMs);
   }, 120_000);
});

describe("through a portal", () => {
   it("the camera turns towards behind the exit's way, never more than 90 degrees", () => {
      for (const [vx, vz] of [[0, -10], [0, 10], [10, 0], [-7, 7]]) {
         const o = createOrbit({ yaw: 0 });
         afterTeleport(o, vx, vz);
         expect(Math.abs(wrapAngle(o.yaw))).toBeLessThanOrEqual(TELEPORT_TURN + 1e-9);
      }
   });
});

describe("an anchor in the way", () => {
   it("hides only while the camera is behind it and the hero close in front", () => {
      // an exit at the origin facing -z
      const pose = { ax: 0, az: 0, dx: 0, dz: -1 };
      expect(anchorBlocksView(pose, { x: 0, z: 6 }, { x: 0, z: -2 })).toBe(true);
      // the camera in front of it (looking back at it): drawn
      expect(anchorBlocksView(pose, { x: 0, z: -12 }, { x: 0, z: -4 })).toBe(false);
      // the hero behind it, or far away: drawn
      expect(anchorBlocksView(pose, { x: 0, z: 6 }, { x: 0, z: 2 })).toBe(false);
      expect(anchorBlocksView(pose, { x: 0, z: 6 }, { x: 0, z: -12 })).toBe(false);
      // the camera far off: drawn
      expect(anchorBlocksView(pose, { x: 0, z: 30 }, { x: 0, z: -2 })).toBe(false);
   });
});

describe("camera helpers", () => {
   it("the orbit starts behind the start and scales with the aspect", () => {
      const run = createRun(1, 1);
      expect(portalOrbit(run.course).autoFollow).toBe(true);
      expect(orbitScale(0.5)).toBeGreaterThan(orbitScale(1.8));
      expect(Number.isFinite(orbitLookUp(0.5))).toBe(true);
      expect(playCamera(run.course, 1.6).position.every(Number.isFinite)).toBe(true);
      expect(introKeyframes(run.course).length).toBeGreaterThan(1);
   });

   it("courseSolids lists the island slabs under their tops", () => {
      const run = createRun(1, 2);
      const out: AABB[] = Array.from({ length: 32 }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
      const n = courseSolids(run, 0, 10, 0, out);
      expect(n).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) expect(out[i].max.y).toBeGreaterThan(out[i].min.y);
   });
});

describe("hero pick", () => {
   it("defaults to Vexa and takes a pick", () => {
      resetHeroPick();
      expect(DEFAULT_HERO).toBe("vexa");
      expect(pickedHero()).toBe("vexa");
      selectHero("riko");
      expect(pickedHero()).toBe("riko");
      resetHeroPick();
   });
});
