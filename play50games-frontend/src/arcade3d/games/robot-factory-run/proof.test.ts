import { describe, it, expect } from "vitest";
import { createArcadeStore } from "../../core/useArcadeStore";
import { advanceRunClock, playedFrameDt } from "../../core/frameLoop";
import { normalizeRun, computeTimeScore, isRankedRun } from "../../core/scores";
import { LEVEL_IDS } from "../../types";
import { createRun, createStepInput, step, finalScore, PROPOSED_LEVEL_LIMITS, bonusBound, proposeLimits } from "./rules";
import { createBot, botInput } from "./bot";
import { HEROES } from "./heroes";
import { LEVELS } from "./levels";
import { robotFactoryRunMeta } from "./meta";
describe("five real-store score proofs", () => {
   for (const level of LEVEL_IDS)
      it(`L${level}: bot through the real store at 30, 60 and 144 Hz`, () => {
         for (const hz of [30, 60, 144]) {
            const store = createArcadeStore();
            store.getState().configure({});
            store.getState().markReady();
            store.getState().start();
            const r = createRun(1, level);
            const bot = createBot();
            const input = createStepInput();
            for (let f = 0; f < 100000 && store.getState().phase !== "over"; f++) {
               advanceRunClock(store, 1 / hz);
               const dt = playedFrameDt(store.getState());
               if (dt <= 0)
                  continue;
               botInput(bot, r, input);
               step(r, dt * 1000, input);
               if (r.ended) {
                  const s = store.getState();
                  s.setStat("orbs", r.orbs);
                  s.setStat("finishMs", r.finishMs);
                  s.setStat("comboMs", r.combo.bonusTotal);
                  s.end(r.ended);
               }
            }
            expect(r.ended, JSON.stringify({ hz, t: r.simMs, h: r.hero, c: r.board, b: r.boss })).toBe("win");
            const s = store.getState(), lim = PROPOSED_LEVEL_LIMITS[level];
            const fin = finalScore(s);
            const sent = normalizeRun({ slug: "robot-factory-run", level, score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-28T00:00:00Z" }, lim);
            expect(isRankedRun(lim, s.endReason)).toBe(true);
            expect(fin.durationMs).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(fin.durationMs).toBeLessThanOrEqual(lim.maxDurationMs);
            expect(sent.score).toBe(computeTimeScore(lim, fin.durationMs));
            expect(sent.score).toBeLessThanOrEqual(lim.maxScore);
            expect(r.combo.bonusTotal + r.orbs * 300).toBeLessThanOrEqual(bonusBound(level));
            expect(r.finishMs).toBeLessThanOrEqual(s.elapsedMs + 1);
         }
      }, 60000);
   for (const level of LEVEL_IDS)
      it(`L${level}: all heroes can clear without a mandatory power gate`, () => {
         for (const hero of HEROES) {
            const r = createRun(3, level, hero.id), bot = createBot(), i = createStepInput();
            for (let f = 0; f < 18000 && !r.ended; f++) {
               botInput(bot, r, i);
               step(r, 1000 / 60, i);
            }
            expect(r.ended, `${hero.id} L${level}: ${JSON.stringify({ h: r.hero, b: r.board, boss: r.boss })}`).toBe("win");
         }
      }, 60000);
   it("limits and metadata use five independent level rows", () => {
      expect(new Set(LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]))).size).toBe(5);
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id]).toEqual(proposeLimits(id));
         expect(robotFactoryRunMeta.levels![id - 1].scoring).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(PROPOSED_LEVEL_LIMITS[id].timeBaseMs).toBe(LEVELS[id].durationMs);
      }
   });
});
describe("discounts cannot be farmed by power / input spam", () => {
   it("pins each level's server floor and ceiling", () => {
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual([[4300, 8570], [9260, 10074], [9260, 11074], [9220, 13078], [16270, 22373]]);
   });
   for (const level of LEVEL_IDS)
      it(`L${level}: all five powers mashed by the honest controller respect limits`, () => {
         for (const hero of HEROES) {
            const r = createRun(19, level, hero.id), bot = createBot(), i = createStepInput();
            for (let f = 0; f < 16000 && !r.ended; f++) {
               botInput(bot, r, i);
               i.actionPressed = true;
               step(r, 1000 / 60, i);
            }
            if (r.ended === "win") {
               expect(r.finishMs - r.orbs * 300 - r.combo.bonusTotal).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
               expect(r.combo.bonusTotal + r.orbs * 300).toBeLessThanOrEqual(bonusBound(level));
            }
         }
      });
});
