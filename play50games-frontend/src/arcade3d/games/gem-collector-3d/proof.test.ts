// The score limits' proof (README "Score limits"): the bank bound is the best any split of the link
// supply can do (a brute-force optimum), each gem is banked at most once (the train holds gem
// indices), banked points never beat the bound for the weight banked, and spam, power-mashing and
// the honest bot through the real store all stay inside the pinned limits.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS } from "@/arcade3d/types";
import { BANK_CAP, LINK_WEIGHT, MAX_LINKS, arenaFor, linkSupply } from "./arena";
import { HEROES } from "./heroes";
import { botInput, botRun, createBot } from "./bot";
import { gemCollector3dMeta } from "./meta";
import { GEM, PROPOSED_LEVEL_LIMITS, bankBound, createRun, createStepInput, finalScore, levelCleared, maxScoreOf, step, type GemRun } from "./rules";

/** The best total of banks for w link weight: a knapsack over bank sizes 1..2 x MAX_LINKS (gold weighs 2). */
function bruteBest(w: number): number {
   const best = new Array<number>(w + 1).fill(0);
   for (let t = 1; t <= w; t++) for (let b = 1; b <= Math.min(t, MAX_LINKS * 2); b++) best[t] = Math.max(best[t], best[t - b] + Math.min(BANK_CAP, b * b));
   return best[w];
}

/** The weight of the gems banked so far. */
function bankedWeight(run: GemRun): number {
   let w = 0;
   for (let i = 0; i < run.gemState.length; i++) if (run.gemState[i] === GEM.banked) w += LINK_WEIGHT[run.arena.gems[i].kind];
   return w;
}

function spam(levelSeed: number, level: (typeof LEVEL_IDS)[number], mashOnly = false): GemRun {
   const rng = createRng(levelSeed * 7919 + level);
   const run = createRun(levelSeed, level, HEROES[levelSeed % 5].id);
   const inp = createStepInput();
   for (let f = 0; f < 6000 && run.ended === null; f++) {
      if (f % 12 === 0) {
         const a = rng() * Math.PI * 2;
         inp.moveX = Math.sin(a);
         inp.moveZ = Math.cos(a);
      }
      inp.jumpPressed = !mashOnly && rng() < 0.2;
      inp.actionPressed = rng() < (mashOnly ? 1 : 0.15);
      step(run, 4 + rng() * 46, inp);
   }
   return run;
}

describe("the bank bound", () => {
   it("floor(W / 20) x 400 + (W mod 20)^2 is the best split of W link weight into banks", () => {
      for (let w = 0; w <= 180; w++) expect(bankBound(w), `W ${w}`).toBe(bruteBest(w));
   });

   it("maxScore is the bank bound of the whole supply plus the orbs, the most flow and the Glutton", () => {
      for (const id of LEVEL_IDS) {
         const a = arenaFor(id);
         expect(maxScoreOf(a)).toBeGreaterThanOrEqual(bankBound(linkSupply(a)));
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBe(maxScoreOf(a));
      }
   });
});

describe("conservation: a gem is banked once at most", () => {
   it("in spam runs on every level the banked points never beat the bound for the weight banked, and banked gems stay banked", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 1; seed <= 12; seed++) {
            const rng = createRng(seed);
            const run = createRun(seed, id, HEROES[seed % 5].id);
            const inp = createStepInput();
            const banked = new Uint8Array(run.gemState.length);
            for (let f = 0; f < 3000 && run.ended === null; f++) {
               if (f % 15 === 0) {
                  const a = rng() * Math.PI * 2;
                  inp.moveX = Math.sin(a);
                  inp.moveZ = Math.cos(a);
               }
               inp.actionPressed = rng() < 0.1;
               step(run, 16, inp);
               for (let i = 0; i < banked.length; i++) {
                  if (banked[i]) expect(run.gemState[i]).toBe(GEM.banked);
                  if (run.gemState[i] === GEM.banked) banked[i] = 1;
               }
               let inTrain = 0;
               for (const s of run.gemState) if (s === GEM.train) inTrain++;
               expect(inTrain).toBe(run.n);
            }
            expect(run.bankPoints).toBeLessThanOrEqual(bankBound(bankedWeight(run)));
         }
      }
   }, 120_000);
});

describe("nothing beats the pinned limits", () => {
   it("200 spam runs on level 1 and 30 on every level (random stick, jump and power, ragged frames, any hero)", () => {
      for (let seed = 1; seed <= 200; seed++) expect(spam(seed, 1).score).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
      for (const id of LEVEL_IDS) for (let seed = 1; seed <= 30; seed++) expect(spam(seed, id).score).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxScore);
   }, 300_000);

   it("every hero with its power mashed, and the honest bot with the power mashed, on every level", () => {
      for (const id of LEVEL_IDS) {
         for (const h of HEROES) {
            const run = botRun(id, 60, h.id, true);
            expect(run.score, `${h.id} L${id}`).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxScore);
            if (run.boss && run.ended === "win") expect(run.simMs).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[id].minDurationMs);
         }
      }
   }, 300_000);

   it("the honest bot through the real store with ragged frames: ranked, inside the server limits", () => {
      for (const id of [1, 5] as const) {
         const store = createArcadeStore();
         store.getState().configure({ durationMs: arenaFor(id).durationMs + 1000, resultDelayMs: 1500 });
         store.getState().markReady();
         store.getState().start();
         const run = createRun(5, id);
         const bot = createBot(run);
         const inp = createStepInput();
         const rng = createRng(11 + id);
         for (let f = 0; f < 80_000 && store.getState().phase !== "over"; f++) {
            advanceRunClock(store, rng() < 0.05 ? 0.05 + rng() * 0.2 : 1 / 60);
            const dt = playedFrameDt(store.getState());
            if (dt <= 0) continue;
            bot.frameMs = dt * 1000;
            botInput(bot, run, inp);
            const ev = step(run, dt * 1000, inp);
            if (store.getState().score !== run.score) store.getState().setScore(run.score);
            if (ev.ended) store.getState().end(levelCleared(run) ? "win" : "timeup");
         }
         const s = store.getState();
         const fin = finalScore(s);
         const rules = gemCollector3dMeta.levels![id - 1].scoring;
         const sent = normalizeRun({ slug: "gem-collector-3d", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-11-17T00:00:00Z" }, rules);
         expect(isRankedRun(rules, s.endReason)).toBe(true);
         expect(s.endReason, `L${id}`).toBe("win");
         expect(withinServerLimits(sent.score, sent.durationMs, rules), `L${id} ${sent.score} in ${sent.durationMs} ms`).toBe(true);
      }
   }, 120_000);
});
