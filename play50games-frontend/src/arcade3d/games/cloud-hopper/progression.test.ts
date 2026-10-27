// Cloud Hopper's Menu 2 structure: stars, the flow meter, secrets, progress and Gloom Nimbus (menu2/*).
import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { comboConfigProblems, comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { secretProblems } from "@/arcade3d/menu2/secrets/secrets";
import { STAR_BIT, starSpecProblems } from "@/arcade3d/menu2/stars/stars";
import { bossProblems, hitsToDefeat } from "@/arcade3d/menu2/boss/boss";
import { levelOf } from "@/arcade3d/menu2/progress/progress";
import { loadProgress, memoryProgressStorage } from "@/arcade3d/menu2/progress/progressStore";
import { COMBO, GLOOM_NIMBUS, SECRETS, STREAK_BADGE, starSpecFor } from "./progression";
import { LEVELS } from "./levels";
import { ORB, comboSpecOf, courseFor, createRun, createStepInput, runTimeMs, step, type CloudRun } from "./rules";
import { createBot, botInput } from "./bot";
import { levelEndStats, runStars } from "./levelEnd";

function botRun(level: LevelId): CloudRun {
   const run = createRun(1, level);
   const bot = createBot(run);
   const input = createStepInput();
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, 1000 / 60, input);
   }
   return run;
}

describe("Cloud Hopper: Menu 2 structure", () => {
   it("configs are valid: combo, stars, secrets, Gloom Nimbus (3 phases)", () => {
      expect(comboConfigProblems(COMBO)).toEqual([]);
      expect(bossProblems(GLOOM_NIMBUS)).toEqual([]);
      expect(GLOOM_NIMBUS.phases).toHaveLength(3);
      expect(hitsToDefeat(GLOOM_NIMBUS, 1)).toBe(7);
      for (const id of LEVEL_IDS) {
         expect(secretProblems(SECRETS[id]), `level ${id}`).toEqual([]);
         expect(starSpecProblems(starSpecFor(id, courseFor(id).mainOrbs))).toEqual([]);
      }
      // the card's sunset targets
      expect(LEVEL_IDS.map((id) => LEVELS[id].starTargetMs)).toEqual([60_000, 80_000, 95_000, 110_000, 150_000]);
      expect(STREAK_BADGE).toBe(20);
   });

   for (const id of LEVEL_IDS) {
      it(`level ${id}: every secret floats in the open, off the main route's clouds`, () => {
         const c = courseFor(id);
         expect(c.secrets).toHaveLength(SECRETS[id].length);
         for (const p of c.secrets) {
            for (const s of c.clouds) {
               const inside = Math.abs(p.x - s.cx) <= s.hw && Math.abs(p.z - s.cz) <= s.hd && p.y <= s.top + 0.3 && p.y >= s.bottom;
               expect(inside).toBe(false);
            }
         }
      });
   }

   for (const id of LEVEL_IDS) {
      it(`level ${id}: the bot's flow bonus stays within comboMaxBonus, the star target is above the bot's time, and progress records the clear`, () => {
         const run = botRun(id);
         expect(run.ended).toBe("win");
         const bound = comboMaxBonus(comboSpecOf(run.course));
         expect(run.combo.bonusTotal).toBeGreaterThan(0);
         expect(run.combo.bonusTotal).toBeLessThanOrEqual(bound);
         const t = runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);
         expect(t).toBeLessThan(LEVELS[id].starTargetMs);
         const r = runStars(run);
         expect(r.clear).toBe(true);
         expect(r.allOrbs).toBe(run.mainOrbs === run.course.mainOrbs);
         expect(r.goal).toBe(true);
         const storage = memoryProgressStorage();
         const end = levelEndStats(run, null, storage);
         expect(end.stars & STAR_BIT.clear).toBe(STAR_BIT.clear);
         const saved = levelOf(loadProgress(null, storage), "cloud-hopper", id);
         expect(saved?.clears).toBe(1);
         expect(end.xp).toBeGreaterThan(0);
      });
   }

   it("the badge is the centre streak: 20 centre landings in a row, not just no falls", () => {
      const run = botRun(1);
      run.bestStreak = STREAK_BADGE - 1;
      expect(runStars(run).noHit).toBe(false);
      run.bestStreak = STREAK_BADGE;
      expect(runStars(run).noHit).toBe(true);
   });

   it("orbs: each a flow link of 40, each first landing 20, each first ring 30; the gated orbs count in the proof", () => {
      const c = courseFor(3);
      const spec = comboSpecOf(c);
      expect(spec.sources).toEqual([
         { count: c.orbs.length, base: 40 },
         { count: c.clouds.length - 1, base: 20 },
         { count: c.rings.length, base: 30 },
      ]);
      expect(ORB.bonusMs).toBe(400);
   });

   it("level 5: Gloom Nimbus is beaten by the honest bot (rods charge the chase phase, then its eyes and core), and the bell rings only after", () => {
      const run = botRun(5);
      expect(run.boss?.step === "defeat" || run.boss?.step === "done").toBe(true);
      expect(run.boss?.hits).toBe(7);
      // a run that never defeats it cannot ring the bell: put the hero on the bridge with the boss alive
      const fresh = createRun(1, 5);
      const g = fresh.course.clouds[fresh.course.goal];
      Object.assign(fresh.hero, { x: g.cx, y: g.top, z: g.cz, grounded: true, support: fresh.course.goal, lastTop: g.top });
      fresh.chaseZ = 1e6;
      step(fresh, 200, createStepInput());
      expect(fresh.ended).toBeNull();
   });
});
