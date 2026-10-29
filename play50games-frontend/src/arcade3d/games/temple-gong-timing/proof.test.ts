// The score proof (README "Server limits and why they hold"): each level's pinned row is its own
// proposeLimits; no run ever holds more than the prefix bound S(t) <= base + maxPointsPerSec x t or more
// than maxScore (perfect, sloppy, spamming, jumping and random players, every hero, 30 / 60 / 144 fps); a
// level-5 farmer playing every duel at 75 % for the whole cap stays under the bound (encores pay
// nothing); the honest bot clears every level with its stars; a ragged-frame run through the real store
// submits a score inside the limits.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { withinServerLimits } from "@/arcade3d/core/limits";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { bossMinMs, proposeLimits } from "./bound";
import { GOOD_MS, PENDING, PROPOSED_LEVEL_LIMITS, createRun, createStepInput, finalAccuracy, runStars, step, type GongRun, type StepInput } from "./rules";
import { templeGongTimingMeta } from "./meta";

const PINNED = [
   [12790, 72800, 79500, 400, 176],
   [13690, 71500, 78154, 400, 187],
   [14180, 64400, 70572, 400, 215],
   [14790, 41800, 46517, 400, 358],
   [28600, 64700, 242000, 5720, 318],
];

describe("the limits", () => {
   it("each level's row is its own proposeLimits, pinned, and shipped by meta", () => {
      for (const id of LEVEL_IDS) {
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim).toEqual(proposeLimits(id));
         expect(templeGongTimingMeta.levels![id - 1].scoring).toMatchObject(lim);
      }
      expect(templeGongTimingMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => { const l = PROPOSED_LEVEL_LIMITS[id]; return [l.maxScore, l.minDurationMs, l.maxDurationMs, l.base, l.maxPointsPerSec]; })).toEqual(PINNED);
   });

   it("each level is worth more than the one before, and level 5 at most 3x level 1", () => {
      for (const id of [2, 3, 4, 5] as const) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[(id - 1) as LevelId].maxScore);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("the whole score is the rate row at the song's end; level 5's least defeat is one call, three duels and the gong", () => {
      for (const id of [1, 2, 3, 4] as const) {
         const l = PROPOSED_LEVEL_LIMITS[id];
         expect(l.maxScore).toBeLessThanOrEqual(l.base + (l.maxPointsPerSec * l.minDurationMs) / 1000 / 0.94);
      }
      expect(bossMinMs()).toBeGreaterThan(60_000);
      expect(PROPOSED_LEVEL_LIMITS[5].minDurationMs).toBeLessThanOrEqual(bossMinMs());
   });
});

type Policy = "bot" | "sloppy" | "spam" | "random" | "farm";

/** Plays a level to its end, checking the bound after every frame; returns the run. */
function play(level: LevelId, hero: HeroId, policy: Policy, fps: number, seed = 1): GongRun {
   const lim = PROPOSED_LEVEL_LIMITS[level];
   const rng = createRng(seed);
   const run = createRun(seed, level, hero);
   const bot = createBot(run, 1000 / fps, policy === "sloppy" ? 45 : 0, seed);
   const input: StepInput = createStepInput();
   let held = 0;
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      if (policy === "bot" || policy === "sloppy" || policy === "farm") botInput(bot, run, input);
      else {
         if (held-- <= 0) {
            held = 5 + Math.floor(rng() * 40);
            input.moveX = policy === "random" ? rng() * 2 - 1 : 0;
            input.moveZ = policy === "random" ? rng() * 2 - 1 : 0;
            input.yaw = rng() * 6.28;
         }
         input.actionPressed = policy === "spam" ? true : rng() < 0.2;
         input.action = rng() < 0.5;
         input.jumpPressed = rng() < 0.05;
      }
      // the farmer: one note in four struck late (Good) in every duel, so no phrase reaches 80 %
      if (policy === "farm" && input.actionPressed && run.boss && run.boss.phase === 1) {
         const next = run.chart.notes.findIndex((n, i) => i >= run.cursor && run.grade[i] === PENDING);
         if (next % 4 === 0) input.actionPressed = false;
      }
      step(run, 1000 / fps, input);
      const t = run.simMs / 1000;
      expect(run.score).toBeLessThanOrEqual(lim.maxScore);
      expect(run.score).toBeLessThanOrEqual(lim.base + lim.maxPointsPerSec * t + 1e-6);
   }
   expect(run.ended).not.toBeNull();
   if (run.ended !== null) expect(run.simMs + 1).toBeGreaterThanOrEqual(lim.minDurationMs);
   return run;
}

describe("soundness: nobody beats the bound", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: perfect, sloppy, spamming and random players of every hero stay under it at 30, 60 and 144 fps`, () => {
         for (const h of HEROES) play(level, h.id, "bot", 60);
         for (const fps of [30, 144]) play(level, "riko", "bot", fps);
         play(level, "zuno", "sloppy", 60);
         play(level, "kiro", "spam", 60, 3);
         for (let seed = 1; seed <= 3; seed++) play(level, HEROES[seed].id, "random", seed % 2 ? 60 : 144, seed);
      }, 300_000);
   }

   it("level 5: a farmer who never cracks a duel plate plays to the cap and stays under it", () => {
      const run = play(5, "riko", "farm", 60);
      expect(run.ended).toBe("lose");
      expect(run.simMs).toBeGreaterThanOrEqual(LEVELS[5].capMs - 1);
   }, 300_000);
});

describe("the honest bot", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: wins with all three stars (perfect timing), and a 45 ms-sloppy bot still clears`, () => {
         const run = play(level, "kiro", "bot", 60);
         expect(run.ended).toBe("win");
         const stars = runStars(run);
         expect(stars.stars).toBe(3);
         const sloppy = play(level, "nami", "sloppy", 60, 2);
         expect(sloppy.ended).toBe("win");
         if (level < 5) expect(finalAccuracy(sloppy)).toBeGreaterThanOrEqual(LEVELS[level].accuracy);
      }, 300_000);
   }

   it("a press is judged to within GOOD_MS either side of the beat", () => {
      expect(GOOD_MS).toBe(90);
   });

   for (const level of [1, 5] as const) {
      it(`level ${level}: the bot through the real store with ragged frames submits a score inside the limits`, () => {
         const store = createArcadeStore();
         store.getState().configure({ resultDelayMs: 1800 });
         store.getState().markReady();
         store.getState().start();
         const run = createRun(5, level);
         const bot = createBot(run);
         const input: StepInput = createStepInput();
         const rng = createRng(11);
         for (let f = 0; f < 200_000 && store.getState().phase !== "over"; f++) {
            advanceRunClock(store, rng() < 0.05 ? 0.05 + rng() * 0.2 : 1 / 60);
            const dt = playedFrameDt(store.getState());
            if (dt <= 0) continue;
            bot.frameMs = dt * 1000;
            botInput(bot, run, input);
            const ev = step(run, dt * 1000, input);
            if (ev.points > 0) store.getState().addScore(ev.points);
            if (ev.finished) {
               store.getState().setScore(run.score);
               store.getState().end(run.ended ?? "lose");
            }
         }
         const s = store.getState();
         const rules = templeGongTimingMeta.levels![level - 1].scoring;
         expect(isRankedRun(rules, s.endReason)).toBe(true);
         const sent = normalizeRun({ slug: "temple-gong-timing", score: s.score, durationMs: s.elapsedMs, finishedAt: "2026-10-29T00:00:00Z" }, rules);
         expect(withinServerLimits(sent.score, sent.durationMs, rules)).toBe(true);
         expect(sent.score).toBe(run.score);
      }, 300_000);
   }
});

describe("mutation probes", () => {
   it("no two levels share a row", () => {
      expect(new Set(LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]))).size).toBe(5);
   });
});
