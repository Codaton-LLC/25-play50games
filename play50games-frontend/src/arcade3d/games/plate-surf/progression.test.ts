// Plate Surf's Menu 2 structure: stars, the flow meter, secrets, progress and King Breaker (menu2/*).
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { comboConfigProblems } from "@/arcade3d/menu2/combo/combo";
import { secretProblems } from "@/arcade3d/menu2/secrets/secrets";
import { STAR_BIT, starSpecProblems } from "@/arcade3d/menu2/stars/stars";
import { bossProblems, hitsToDefeat } from "@/arcade3d/menu2/boss/boss";
import { levelOf } from "@/arcade3d/menu2/progress/progress";
import { loadProgress, memoryProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { COMBO, KING_BREAKER, SECRETS, starSpecFor } from "./progression";
import { LEVELS } from "./levels";
import { CURL, TUBE_SPEED, courseFor, createRun, createStepInput, step, type SurfRun } from "./rules";
import { FACE_W, LANE, LEDGE_UP, LIP_W } from "./waves";
import { createBot, botInput } from "./bot";
import { levelEndStats, runStars } from "./levelEnd";

function botRun(level: LevelId): SurfRun {
   const run = createRun(1, level);
   const bot = createBot(run);
   const input = createStepInput();
   for (let f = 0; f < 600_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, 1000 / 60, input);
   }
   return run;
}

describe("Plate Surf: Menu 2 structure", () => {
   it("configs are valid: combo, stars, secrets, King Breaker (3 phases, 7 hits)", () => {
      expect(comboConfigProblems(COMBO)).toEqual([]);
      expect(bossProblems(KING_BREAKER)).toEqual([]);
      expect(KING_BREAKER.phases.map((p) => p.id)).toEqual(["claw", "bubbles", "barrel"]);
      expect(hitsToDefeat(KING_BREAKER, 1)).toBe(7);
      // the claw's shadow telegraph is the card's 1.2 s
      expect(KING_BREAKER.phases[0].attacks[0].telegraphMs).toBe(1200);
      for (const id of LEVEL_IDS) {
         expect(secretProblems(SECRETS[id]), `level ${id}`).toEqual([]);
         expect(starSpecProblems(starSpecFor(id, courseFor(id).mainOrbs))).toEqual([]);
      }
      // the card's target times
      expect(LEVEL_IDS.map((id) => LEVELS[id].starTargetMs)).toEqual([50_000, 65_000, 75_000, 85_000, 120_000]);
   });

   for (const id of LEVEL_IDS) {
      it(`level ${id}: every secret sits where its route leads: the pearl on the face (top speed), the sticker and reef shard in a side lane, the cave over the crest`, () => {
         const c = courseFor(id);
         expect(c.secrets).toHaveLength(SECRETS[id].length);
         SECRETS[id].forEach((s, i) => {
            const p = c.secrets[i];
            if (s.id === "pearl") {
               expect(p.need).toBe("speed");
               expect(p.x).toBeGreaterThan(0);
               expect(p.x).toBeLessThan(FACE_W - LIP_W);
            } else if (s.id === "inner" || s.id === "reef") {
               expect(p.x).toBeLessThan(LANE.x1);
               const lane = c.lanes.find((l) => p.z <= l.z0 && p.z >= l.z1);
               expect(lane?.kind).toBe(s.id === "inner" ? "ghost" : "cracked");
            } else if (s.id === "cave") expect(p.y).toBeGreaterThan(c.H + LEDGE_UP);
         });
      });
   }

   it("the pearl is taken only at the tube speed", () => {
      for (const v of [TUBE_SPEED - 1, TUBE_SPEED + 0.5]) {
         const run = createRun(1, 1);
         const p = run.course.secrets[0];
         Object.assign(run.hero, { x: p.x, y: p.y - 0.6, z: p.z + 0.5, v, grounded: true });
         run.curlZ = run.hero.z + CURL.maxGap;
         const input = createStepInput();
         input.moveX = 0;
         for (let f = 0; f < 6; f++) step(run, 16, input);
         expect(Boolean(run.secrets.found[0])).toBe(v >= TUBE_SPEED);
      }
   });

   it("the level end records stars, the badge (never swallowed) and secrets in progress, and hands the star screen its stats", () => {
      const run = botRun(1);
      expect(run.ended).toBe("win");
      const r = runStars(run);
      expect(r.clear).toBe(true);
      expect(r.mask & STAR_BIT.clear).toBeTruthy();
      expect(r.mask & STAR_BIT.orbs).toBeTruthy();
      // the honest bot beats the card's 50 s
      expect(r.mask & STAR_BIT.goal).toBeTruthy();
      expect(r.noHit).toBe(true);
      const storage = memoryProgressStorage();
      const stats = levelEndStats(run, null, storage);
      expect(stats.stars).toBe(r.mask);
      expect(stats.xp).toBeGreaterThan(0);
      expect(levelOf(loadProgress(null, storage), "plate-surf", 1)?.stars).toBe(r.mask);
   });

   it("King Breaker: the honest bot beats it on level 5 and rings the bell", () => {
      const run = botRun(5);
      expect(run.ended).toBe("win");
      expect(run.boss!.hp).toBe(0);
   });
});
