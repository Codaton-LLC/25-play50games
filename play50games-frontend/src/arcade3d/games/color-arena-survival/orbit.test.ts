// Color Arena Survival with the shared orbit camera (menu2/camera): the bot is unchanged at camera yaw 0,
// a random yaw never beats the floor, the camera helpers (high behind, leaned to the middle, the intro
// keyframes), and the preselected hero (World 6: no lead, the last pick anywhere, else Riko).
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { defaultHeroFor } from "@/arcade3d/menu2/heroes/heroPick";
import { createBot, botInput } from "./bot";
import { PIVOT_LEAN, arenaOrbit, arenaPivot, introKeyframes, orbitLookUp, orbitScale, playCamera } from "./camera";
import { PROPOSED_LEVEL_LIMITS, createRun, createStepInput, step, submittedMs, type ArenaRun } from "./rules";
import { DEFAULT_HERO, pickedHero, resetHeroPick, selectHero } from "./heroes";

function botRun(level: 1 | 3, yaw?: number): ArenaRun {
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
      for (const level of [1, 2] as const) {
         const run = createRun(2, level);
         const bot = createBot(run);
         const input = createStepInput();
         for (let f = 0; f < 200_000 && run.ended === null; f++) {
            botInput(bot, run, input);
            input.yaw = rng() * Math.PI * 2;
            step(run, 1000 / 60, input);
         }
         if (run.ended === "win") expect(submittedMs(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
      }
   }, 120_000);
});

describe("the camera helpers", () => {
   it("the orbit stands high behind the hero with no auto-follow; portrait screens stand it farther", () => {
      const run = createRun(1, 4);
      const o = arenaOrbit(run.arena);
      expect(o.autoFollow).toBe(false);
      expect(o.yaw).toBe(0);
      expect(o.pitch!).toBeGreaterThan(0.6);
      expect(orbitScale(0.46)).toBeGreaterThan(orbitScale(1.6));
      expect(orbitLookUp(0.46)).toBeGreaterThan(orbitLookUp(1.6));
   });

   it("the pivot leans from the hero to the floor's middle and never follows him into the pit", () => {
      const p = arenaPivot({ x: 8, y: -20, z: -6 }, { x: 0, y: 0, z: 0 });
      expect(p.x).toBeCloseTo(8 * (1 - PIVOT_LEAN));
      expect(p.z).toBeCloseTo(-6 * (1 - PIVOT_LEAN));
      expect(p.y).toBeGreaterThanOrEqual(1);
   });

   it("the intro ends behind the start and the play pose looks at the floor", () => {
      const run = createRun(1, 2);
      const keys = introKeyframes(run.arena);
      expect(keys.length).toBeGreaterThanOrEqual(3);
      const play = playCamera(run.arena, 16 / 10);
      expect(play.position[2]).toBeGreaterThan(play.lookAt[2]);
      expect(play.position[1]).toBeGreaterThan(play.lookAt[1]);
   });
});

describe("the preselected hero", () => {
   it("World 6 has no lead: the default is Riko, then whatever the player picks", () => {
      resetHeroPick();
      expect(defaultHeroFor("color-arena-survival", null)).toBe("riko");
      expect(DEFAULT_HERO).toBe("riko");
      selectHero("zuno");
      expect(pickedHero()).toBe("zuno");
      resetHeroPick();
   });
});
