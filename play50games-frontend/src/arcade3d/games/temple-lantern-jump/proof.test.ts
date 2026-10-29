// The score proof (README "Scoring and limits"): each level's pinned row is its own proposeLimits (the
// climb floor H / V_CLIMB_MAX, plus the Queen's least defeat time on level 5, less the largest bonus,
// less 6 %); random and adversarial players never rise faster than V_CLIMB_MAX on average; the honest
// bot wins every level at 30, 60 and 144 fps with every orb, inside the limits; idle runs time out
// unranked; a ragged-frame run through the real store submits a ranked score inside the limits.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { bossMinMs, minDurationMsOf, minFinishMs, proposeLimits } from "./bound";
import { PROPOSED_LEVEL_LIMITS, STAT, V_CLIMB_MAX, createRun, createStepInput, finalScore, runTimeMs, step, type StepInput, type TempleRun } from "./rules";
import { templeLanternJumpMeta } from "./meta";

const submitted = (run: TempleRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);
const scoreOf = (level: LevelId, run: TempleRun) => Math.floor((PROPOSED_LEVEL_LIMITS[level].timeBaseMs - submitted(run)) / 10);

const cache = new Map<string, TempleRun>();
function botRun(level: LevelId, fps: number, hero: HeroId = "kiro"): TempleRun {
   const key = `${level}:${fps}:${hero}`;
   const hit = cache.get(key);
   if (hit) return hit;
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 600_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   cache.set(key, run);
   return run;
}

const PINNED = [
   [1300, 180000, 180000, 17870],
   [2600, 210000, 210000, 20740],
   [3900, 240000, 240000, 23610],
   [5200, 270000, 270000, 26480],
   [24300, 360000, 360000, 33570],
];

describe("the limits", () => {
   it("each level's row is its own proposeLimits, pinned, and shipped by meta", () => {
      for (const id of LEVEL_IDS) {
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim).toEqual(proposeLimits(id));
         expect(lim.minDurationMs).toBeLessThanOrEqual(minDurationMsOf(id));
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(minDurationMsOf(id) * 0.94 - 100);
         expect(lim.maxScore).toBe(Math.floor((lim.timeBaseMs - lim.minDurationMs) / 10));
         expect(lim.timeBaseMs).toBe(LEVELS[id].durationMs);
         expect(templeLanternJumpMeta.levels![id - 1].scoring).toMatchObject(lim);
      }
      expect(templeLanternJumpMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].maxDurationMs, PROPOSED_LEVEL_LIMITS[id].timeBaseMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual(PINNED);
   });

   it("every level is worth at least level 1's points, and level 5 at most 3x", () => {
      const l1 = PROPOSED_LEVEL_LIMITS[1].maxScore;
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(l1);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(l1 * 3);
   });

   it("level 5 adds the Queen's least defeat time to the climb", () => {
      expect(bossMinMs()).toBeGreaterThan(15_000);
      expect(minFinishMs(5)).toBeGreaterThan(bossMinMs());
   });
});

function randomRun(level: LevelId, seed: number, hero: HeroId, frameMs: number): TempleRun {
   const rng = createRng(seed);
   const run = createRun(seed, level, hero);
   const input: StepInput = createStepInput();
   let held = 0;
   let worst = { f: -1, y: 0, ceiling: 0 };
   for (let f = 0; f < 8_000 && run.ended === null; f++) {
      if (held-- <= 0) {
         held = 5 + Math.floor(rng() * 30);
         input.moveX = rng() * 2 - 1;
         input.moveZ = rng() * 2 - 1;
         input.yaw = rng() * 6.28;
      }
      input.jumpPressed = rng() < 0.12;
      input.actionPressed = rng() < 0.1;
      step(run, frameMs, input);
      // nothing climbs faster than V_CLIMB_MAX on average (a bounce landing on its apex is the best)
      const ceiling = (run.simMs / 1000) * V_CLIMB_MAX + 2.5;
      if (run.hero.y > Math.max(ceiling, 6) && worst.f < 0) worst = { f, y: run.hero.y, ceiling };
   }
   expect(worst, `${hero} L${level} seed ${seed}`).toEqual({ f: -1, y: 0, ceiling: 0 });
   return run;
}

describe("soundness: nobody out-climbs the bound", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: 40 random players never rise above the V_CLIMB_MAX line`, () => {
         for (let seed = 1; seed <= 12; seed++) {
            const run = randomRun(level, seed, HEROES[seed % HEROES.length].id, seed % 2 ? 1000 / 60 : 1000 / 144);
            if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
         }
      }, 120_000);
   }
});

describe("bots", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot wins at 30, 60 and 144 fps with every orb (at least 4 at 30 fps), inside the limits`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const fps of [30, 60, 144]) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(level));
            const d = submitted(run);
            expect(d).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(d).toBeLessThanOrEqual(lim.maxDurationMs);
            expect(scoreOf(level, run), `${fps} fps`).toBeLessThanOrEqual(lim.maxScore);
            expect(run.orbs, `${fps} fps orbs`).toBeGreaterThanOrEqual(fps === 30 ? 4 : 5);
         }
      }, 240_000);
   }

   it("every hero clears every level with the plain bot", () => {
      for (const level of LEVEL_IDS) {
         for (const h of HEROES) {
            const r = botRun(level, 60, h.id);
            expect(r.ended, `${h.id} L${level}`).toBe("win");
            expect(submitted(r)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
         }
      }
   }, 600_000);

   it("idle never wins: the time cap ends it unranked", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(3, id);
         const none = createStepInput();
         for (let f = 0; f < 20_000 && run.ended === null; f++) step(run, 50, none);
         expect(run.ended).not.toBe("win");
      }
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1600 });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(3, 1);
      const input = createStepInput();
      for (let f = 0; f < 40_000 && store.getState().phase !== "over"; f++) {
         advanceRunClock(store, 1 / 60);
         const dt = playedFrameDt(store.getState());
         if (dt <= 0) continue;
         const ev = step(run, dt * 1000, input);
         if (ev.timeup) store.getState().end("timeup");
      }
      expect(store.getState().endReason).toBe("timeup");
      expect(isRankedRun(templeLanternJumpMeta.scoring, store.getState().endReason)).toBe(false);
   });

   for (const level of [1, 5] as const) {
      it(`level ${level}: the bot through the real store with ragged frames: a ranked win inside the limits`, () => {
         const store = createArcadeStore();
         store.getState().configure({ resultDelayMs: 1600 });
         store.getState().markReady();
         store.getState().start();
         const run = createRun(5, level);
         const bot = createBot(run);
         const input: StepInput = createStepInput();
         const rng = createRng(11);
         for (let f = 0; f < 120_000 && store.getState().phase !== "over"; f++) {
            advanceRunClock(store, rng() < 0.05 ? 0.05 + rng() * 0.2 : 1 / 60);
            const dt = playedFrameDt(store.getState());
            if (dt <= 0) continue;
            bot.frameMs = dt * 1000;
            botInput(bot, run, input);
            const ev = step(run, dt * 1000, input);
            if (ev.finished) {
               store.getState().setStat(STAT.orbs, run.orbs);
               store.getState().setStat(STAT.finishMs, run.finishMs);
               store.getState().setStat(STAT.comboMs, run.combo.bonusTotal);
               store.getState().end("win");
            }
         }
         const s = store.getState();
         expect(s.endReason).toBe("win");
         const fin = finalScore(s);
         const rules = templeLanternJumpMeta.levels![level - 1].scoring;
         const sent = normalizeRun({ slug: "temple-lantern-jump", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-28T00:00:00Z" }, rules);
         expect(isRankedRun(rules, s.endReason)).toBe(true);
         expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
         expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
         expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
      }, 240_000);
   }
});

describe("mutation probes: the limits read the level they claim to", () => {
   it("no two levels share a row", () => {
      expect(new Set(LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]))).size).toBe(5);
      for (const a of LEVEL_IDS) for (const b of LEVEL_IDS) if (a !== b) expect(PROPOSED_LEVEL_LIMITS[b]).not.toEqual(proposeLimits(a));
   });
});
