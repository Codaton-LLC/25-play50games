// Color Boss Tower rules: the claws and the tag colour, the cannons and the boss windows, the hearts,
// level 5's glyph finish, and the server-limit proof (README "Score limits"): the pinned limits, the
// honest bot at 30 / 60 / 144 fps with every lead hero, the power-mashed and spam bots, and the
// bounded flow bonus.
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { HERO_OF_COLOUR, TAG_ORDER, type TagHeroId } from "@/arcade3d/menu2/heroTag/rules";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { botRun } from "./bot";
import { BOSSES } from "./progression";
import { LEVELS } from "./levels";
import {
   HEARTS,
   PROPOSED_LEVEL_LIMITS,
   STAT,
   bossMinMs,
   comboSpecOf,
   createRun,
   createStepInput,
   finalScore,
   minFinishMs,
   proposeLimits,
   runTimeMs,
   step,
   towerFor,
   type CbtRun,
} from "./rules";

const submitted = (run: CbtRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);
const LEADS: readonly TagHeroId[] = TAG_ORDER;

/** A run with the hero standing at claw c (the claw within touch reach). */
function atClaw(level: LevelId, c: number, lead: TagHeroId): CbtRun {
   const run = createRun(1, level, lead);
   const cl = run.claws[c];
   const h = run.hero;
   h.a = cl.a;
   h.y = run.tower.ly[cl.ledge];
   h.grounded = true;
   h.ledge = cl.ledge;
   return run;
}

describe("the five towers", () => {
   it("each level is its own tower: more ledges or cycles, the grand guardian only on level 5", () => {
      for (const id of LEVEL_IDS) {
         const s = LEVELS[id];
         expect(s.id).toBe(id);
         expect(s.cycles).toBe(towerFor(id).bossCfg.maxHp);
         expect(s.boss).toBe(id === 5 ? "grand" : "stone");
      }
      expect(LEVELS[3].crumbling).toBe(true);
      expect(LEVELS[1].crumbling).toBeFalsy();
   });

   it("every boss config is sound (menu2/boss bossProblems)", () => {
      for (const cfg of Object.values(BOSSES)) expect(bossProblems(cfg), cfg.id).toEqual([]);
   });
});

describe("claws and colours", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: a low claw charges only for the hero of its colour`, () => {
         const t = towerFor(id);
         const c = t.claws.findIndex((cl) => cl.y - 1 - t.ly[cl.ledge] < 0.5);
         expect(c).toBeGreaterThanOrEqual(0);
         const colour = t.claws[c].colour;
         const right = HERO_OF_COLOUR[colour];
         const wrong = LEADS.find((h) => h !== right)!;
         const input = createStepInput();
         const no = atClaw(id, c, wrong);
         step(no, 16, input);
         expect(no.claws[c].chargedAt).toBe(-1);
         const yes = atClaw(id, c, right);
         const ev = step(yes, 16, input);
         expect(yes.claws[c].chargedAt).toBeGreaterThanOrEqual(0);
         expect(ev.charged).toBe(c);
      });
   }
});

describe("hearts", () => {
   it("three knocks lose the run; the knock break the flow chain", () => {
      const run = createRun(1, 1);
      const input = createStepInput();
      expect(run.hearts).toBe(HEARTS);
      // stand still on ledge 0 through the guardian's sweeps: the arm comes round each cycle
      for (let f = 0; f < 60 * 60 && run.ended === null; f++) step(run, 1000 / 60, input);
      expect(run.ended).toBe("lose");
      expect(run.strikes).toBe(HEARTS);
   });
});

describe("the honest bot", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: wins at 30 / 60 / 144 fps with every lead hero, never under the proof's floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[id];
         for (const fps of [30, 60, 144]) for (const lead of LEADS) {
            const run = botRun(id, fps, lead);
            expect(run.ended, `${fps} ${lead}`).toBe("win");
            expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.tower));
            expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(submitted(run)).toBeLessThanOrEqual(lim.maxDurationMs);
            expect(run.combo.bonusTotal).toBeLessThanOrEqual(comboMaxBonus(comboSpecOf(run.tower)));
         }
      }, 240_000);
   }

   it("level 5's tag finish lights all five glyphs, and each scores flow once", () => {
      const run = botRun(5, 60);
      expect(run.ended).toBe("win");
      expect(Array.from(run.glyphScored)).toEqual([1, 1, 1, 1, 1]);
   });
});

describe("the proof", () => {
   it("the pinned limits are each tower's proposeLimits, five distinct rows", () => {
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(proposeLimits(id, towerFor(id)));
      expect(new Set(LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]))).size).toBe(5);
   });

   it("bossMinMs: the windows alone (each hit on the first instant of its window)", () => {
      for (const id of LEVEL_IDS) {
         const cfg = towerFor(id).bossCfg;
         expect(bossMinMs(cfg)).toBeGreaterThan(cfg.introMs + (cfg.maxHp - 1) * 3000);
      }
   });

   for (const id of LEVEL_IDS) {
      it(`level ${id}: every power mashed, and 20 spam runs, never beat the floor`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[id];
         for (const lead of LEADS) {
            const run = botRun(id, 60, lead, true);
            if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
         }
         for (let seed = 1; seed <= 20; seed++) {
            const rng = createRng(seed * 7919 + id);
            const run = createRun(seed, id, LEADS[seed % 5]);
            const input = createStepInput();
            for (let f = 0; f < 4000 && run.ended === null; f++) {
               if (f % 10 === 0) {
                  input.moveX = rng() * 2 - 1;
                  input.moveZ = rng() * 2 - 1;
               }
               input.jumpPressed = rng() < 0.3;
               input.actionPressed = rng() < 0.2;
               input.tag = rng() < 0.05 ? LEADS[Math.floor(rng() * 5)] : null;
               step(run, 4 + rng() * 46, input);
            }
            if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(run.combo.bonusTotal).toBeLessThanOrEqual(comboMaxBonus(comboSpecOf(run.tower)));
         }
      }, 120_000);
   }

   it("finalScore: a win submits the finish time minus orbs and flow; anything else the elapsed time", () => {
      const stats = { [STAT.finishMs]: 20_000, [STAT.orbs]: 3, [STAT.comboMs]: 150 };
      expect(finalScore({ score: 0, endReason: "win", stats, elapsedMs: 21_000 }).durationMs).toBe(20_000 - 600 - 150);
      expect(finalScore({ score: 0, endReason: "timeup", stats, elapsedMs: 150_000 }).durationMs).toBe(150_000);
   });
});
