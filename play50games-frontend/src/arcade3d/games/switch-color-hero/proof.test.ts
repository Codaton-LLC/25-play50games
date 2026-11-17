// The score limits per level (README "Scoring and the proof"): every hero wins every level with the
// honest bot inside the row; the bot through the real store submits a ranked run; the pace bound holds
// every step under spam; idle and a lost run are unranked; the pinned rows are proposeLimits.
import { describe, expect, it } from "vitest";
import { createRng } from "@/arcade3d/core/math";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { switchColorHeroMeta } from "./meta";
import {
   PROPOSED_LEVEL_LIMITS, STAT, bossMinMs, courseFor, createRun, createStepInput, finalScore, minDurationMsOf, minFinishMs, proposeLimits, runTimeMs, step,
   travelFloorMs, vCap, type SwitchRun,
} from "./rules";
import { START_Z, gatesToPass } from "./track";

const submitted = (run: SwitchRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function botRun(level: LevelId, hero: HeroId, seed: number, frame: () => number): SwitchRun {
   const run = createRun(seed, level, hero);
   const bot = createBot(run);
   const input = createStepInput();
   for (let f = 0; f < 80_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, frame(), input);
   }
   return run;
}

describe("every hero wins every level with the honest bot, inside the row", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const hero of HEROES) {
            for (const hz of [30, 60, 144]) {
               const run = botRun(level, hero.id, 3, () => 1000 / hz);
               expect(run.ended, `${hero.id} ${hz} Hz`).toBe("win");
               expect(run.passed).toBeGreaterThanOrEqual(gatesToPass(level));
               expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
               expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.track));
               expect(run.finishMs).toBeLessThan(0.8 * LEVELS[level].durationMs);
            }
         }
      }, 120_000);
   }
});

describe("through the real store", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: a ragged-frame bot run is a ranked win inside the level's row`, () => {
         const store = createArcadeStore();
         store.getState().configure({ durationMs: LEVELS[level].durationMs, resultDelayMs: 1200 });
         store.getState().markReady();
         store.getState().start();
         const run = createRun(5, level, HEROES[level % 5].id);
         const bot = createBot(run);
         const input = createStepInput();
         const rng = createRng(17 + level);
         for (let f = 0; f < 80_000 && store.getState().phase !== "over"; f++) {
            advanceRunClock(store, rng() < 0.05 ? 0.05 + rng() * 0.2 : 1 / 60);
            const dt = playedFrameDt(store.getState());
            if (dt <= 0) continue;
            botInput(bot, run, input);
            const ev = step(run, dt * 1000, input);
            if (ev.finished) {
               store.getState().setStat(STAT.orbs, run.orbs);
               store.getState().setStat(STAT.finishMs, run.finishMs);
               store.getState().setStat(STAT.comboMs, run.combo.bonusTotal);
               store.getState().end("win");
            } else if (ev.gameOver) store.getState().end("lose");
            else if (ev.timeup) store.getState().end("timeup");
         }
         const s = store.getState();
         expect(s.endReason).toBe("win");
         const fin = finalScore(s);
         const rules = switchColorHeroMeta.levels![level - 1].scoring;
         const sent = normalizeRun({ slug: "switch-color-hero", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-11-17T00:00:00Z" }, rules);
         expect(isRankedRun(rules, s.endReason)).toBe(true);
         expect(sent.durationMs).toBe(submitted(run));
         expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
         expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
         expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
      }, 60_000);
   }

   it("idle never wins: a wrong gate bounces the idle hero until its hearts run out; lost and timeup are unranked", () => {
      for (const level of LEVEL_IDS) {
         const run = createRun(1, level);
         for (let f = 0; f < 20_000 && run.ended === null; f++) step(run, 50, createStepInput());
         expect(["lose", "timeup"]).toContain(run.ended);
      }
      const rules = switchColorHeroMeta.levels![0].scoring;
      expect(isRankedRun(rules, "lose")).toBe(false);
      expect(isRankedRun(rules, "timeup")).toBe(false);
   });
});

describe("the pace bound", () => {
   it("the hero is never farther from the start than vCap x t, under spam with random yaws and frame times", () => {
      for (const level of LEVEL_IDS) {
         for (let seed = 1; seed <= 6; seed++) {
            const rng = createRng(seed * 53 + level);
            const run = createRun(seed, level, HEROES[seed % 5].id);
            const input = createStepInput();
            for (let f = 0; f < 3000 && run.ended === null; f++) {
               input.left = rng() < 0.1;
               input.right = rng() < 0.1;
               input.jumpPressed = rng() < 0.1;
               input.slidePressed = rng() < 0.05;
               input.colorPick = Math.floor(rng() * 6) - 1;
               input.cycle = rng() < 0.1;
               input.actionPressed = rng() < 0.1;
               input.yaw = (rng() - 0.5) * Math.PI * 2;
               step(run, 1 + rng() * 49, input);
               expect(START_Z - run.hero.z).toBeLessThanOrEqual((vCap(level) * run.simMs) / 1000 + 1e-9);
            }
         }
      }
   });
});

describe("the limits read this level", () => {
   it("the pinned rows are proposeLimits, distinct per level, in meta's order; Chroma's floor follows the arena", () => {
      const rows = LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]));
      expect(new Set(rows).size).toBe(5);
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(proposeLimits(courseFor(id)));
         expect(PROPOSED_LEVEL_LIMITS[id].timeBaseMs).toBe(LEVELS[id].durationMs);
         expect(switchColorHeroMeta.levels![id - 1].scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[id]);
         expect(PROPOSED_LEVEL_LIMITS[id].minDurationMs).toBeLessThanOrEqual(minDurationMsOf(courseFor(id)));
      }
      expect(bossMinMs()).toBeGreaterThan(15_000);
      expect(minFinishMs(courseFor(5))).toBe(travelFloorMs(courseFor(5)) + bossMinMs());
   });
});
