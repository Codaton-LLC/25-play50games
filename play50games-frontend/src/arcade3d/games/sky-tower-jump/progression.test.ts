import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { comboConfigProblems, comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { secretProblems } from "@/arcade3d/menu2/secrets/secrets";
import { ALL_STARS, STAR_BIT, starSpecProblems } from "@/arcade3d/menu2/stars/stars";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { levelOf } from "@/arcade3d/menu2/progress/progress";
import { loadProgress, memoryProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { COMBO, SECRETS, STAR_TARGET_MS, STORM_GUARDIAN, starSpecFor } from "./progression";
import { H_BOUNCE, H_JUMP, ORB, comboSpecOf, courseFor, createRun, createStepInput, runTimeMs, step, type SkyRun } from "./rules";
import { createBot, botInput } from "./bot";
import { levelEndStats, runStars } from "./levelEnd";

function botRun(level: LevelId): SkyRun {
   const run = createRun(1, level);
   const bot = createBot(run);
   const input = createStepInput();
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, 1000 / 60, input);
   }
   return run;
}

describe("Sky Tower Jump: Menu 2 structure", () => {
   it("configs are valid: combo, stars, secrets, the level 5 boss stub", () => {
      expect(comboConfigProblems(COMBO)).toEqual([]);
      expect(bossProblems(STORM_GUARDIAN)).toEqual([]);
      for (const id of LEVEL_IDS) {
         expect(secretProblems(SECRETS[id]), `level ${id}`).toEqual([]);
         expect(starSpecProblems(starSpecFor(id, courseFor(id).orbs.length))).toEqual([]);
      }
   });

   for (const id of LEVEL_IDS) {
      it(`level ${id}: every secret floats in the open, the sky shard within the pad bounce's reach and above a plain jump's`, () => {
         const c = courseFor(id);
         expect(c.secrets).toHaveLength(SECRETS[id].length);
         for (const p of c.secrets) {
            for (const s of c.supports) {
               const inside = Math.abs(p.x - s.cx) <= s.hw && Math.abs(p.z - s.cz) <= s.hd && p.y <= s.top + 0.3 && p.y >= s.bottom;
               expect(inside).toBe(false);
            }
         }
         const pad = c.supports.find((s) => s.pad)!;
         expect(pad, "a pad on every level").toBeDefined();
         const sky = c.secrets[SECRETS[id].findIndex((s) => s.id === "pad-sky")];
         const chestApex = pad.top + H_BOUNCE + ORB.centerY;
         expect(chestApex - sky.y).toBeGreaterThan(0);
         expect(chestApex - sky.y).toBeLessThan(ORB.pickup);
         expect(sky.y - (pad.top + H_JUMP + ORB.centerY)).toBeGreaterThan(ORB.pickup);
      });
   }

   for (const id of LEVEL_IDS) {
      it(`level ${id}: the bot's flow bonus stays within comboMaxBonus, and the star target is above the bot's time`, () => {
         const run = botRun(id);
         expect(run.ended).toBe("win");
         const bound = comboMaxBonus(comboSpecOf(run.course));
         expect(run.combo.bonusTotal).toBeGreaterThan(0);
         expect(run.combo.bonusTotal).toBeLessThanOrEqual(bound);
         const time = runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);
         expect(time).toBeLessThan(STAR_TARGET_MS[id]);
         expect(STAR_TARGET_MS[id]).toBeLessThan(time * 1.25);
      });
   }

   it("the level end: stars, no-hit and secrets go to progress through the adapter (no localStorage)", () => {
      const run = botRun(1);
      const stars = runStars(run);
      expect(stars.clear).toBe(true);
      expect(stars.noHit).toBe(run.hits === 0);
      run.secrets.found[0] = 1;
      run.secrets.count = 1;
      const storage = memoryProgressStorage();
      const stats = levelEndStats(run, 9, storage);
      expect(stats.stars).toBe(stars.mask);
      expect(stats.newStars).toBe(stars.mask);
      expect(stats.secrets).toBe(1);
      expect(stats.newSecrets).toBe(1);
      expect(stats.xp).toBeGreaterThan(0);
      const lv = levelOf(loadProgress(9, storage), "sky-tower-jump", 1)!;
      expect(lv.stars).toBe(stars.mask);
      expect(lv.shards).toEqual(["pad-sky"]);
      expect(Object.keys(storage.items)).toEqual(["play50games_m2_progress:u9"]);
      // again: nothing new
      expect(levelEndStats(run, 9, storage)).toMatchObject({ newStars: 0, newSecrets: 0, xp: 0 });
   });

   it("a time-up keeps the secrets but earns no star", () => {
      const run = createRun(1, 1);
      run.ended = "timeup";
      run.secrets.found[2] = 1;
      const storage = memoryProgressStorage();
      const stats = levelEndStats(run, null, storage);
      expect(stats.stars).toBe(0);
      expect(levelOf(loadProgress(null, storage), "sky-tower-jump", 1)).toMatchObject({ stars: 0, clears: 0, stickers: ["gate"] });
   });

   it("a fall breaks the flow and costs the no-hit badge", () => {
      const run = botRun(1);
      expect(run.hits).toBe(0);
      expect(runStars({ ...run, hits: 1 }).noHit).toBe(false);
      expect(runStars(run).mask & STAR_BIT.clear).toBe(STAR_BIT.clear);
      expect(ALL_STARS).toBe(7);
   });
});
