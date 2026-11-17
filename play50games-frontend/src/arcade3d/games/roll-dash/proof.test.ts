// The score proof (README "Server limits and why they hold"): each level's pinned row is its own
// proposeLimits and ships in meta; no run ever submits a time under the row's minDurationMs (honest,
// random and spamming players, every lead hero, 30 / 60 / 144 fps); the honest bot wins every level
// with its stars and no hit; a ragged-frame run through the real store submits a time inside the limits.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { bossMinMs, minFinishMs, proposeLimits } from "./bound";
import { PROPOSED_LEVEL_LIMITS, STAT, createRun, createStepInput, finalScore, runStars, step, submittedMs, type DashRun, type StepInput } from "./rules";
import { rollDashMeta } from "./meta";

const PINNED = [
   [10460, 45400, 150000],
   [12180, 58200, 180000],
   [14000, 70000, 210000],
   [15990, 80100, 240000],
   [28090, 19100, 300000],
];

describe("the limits", () => {
   it("each level's row is its own proposeLimits, pinned, and shipped by meta", () => {
      for (const id of LEVEL_IDS) {
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim).toEqual(proposeLimits(id));
         expect(rollDashMeta.levels![id - 1].scoring).toMatchObject(lim);
      }
      expect(rollDashMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => { const l = PROPOSED_LEVEL_LIMITS[id]; return [l.maxScore, l.minDurationMs, l.maxDurationMs]; })).toEqual(PINNED);
   });

   it("level 5's floor is the Hawk's least defeat time", () => {
      expect(minFinishMs(5)).toBe(bossMinMs());
      expect(bossMinMs()).toBeGreaterThan(15_000);
   });
});

type Policy = "bot" | "random" | "spam";

/** Plays a level to its end; a win's submitted time never beats the row. */
function play(level: LevelId, hero: HeroId, policy: Policy, fps: number, seed = 1): DashRun {
   const lim = PROPOSED_LEVEL_LIMITS[level];
   const rng = createRng(seed);
   const run = createRun(seed, level, hero);
   const bot = createBot(run, 1000 / fps);
   const input: StepInput = createStepInput();
   let held = 0;
   const frames = Math.ceil(((level === 5 ? 150_000 : 160_000) * fps) / 1000);
   for (let f = 0; f < frames && run.ended === null; f++) {
      if (policy === "bot") botInput(bot, run, input);
      else {
         if (held-- <= 0) held = 5 + Math.floor(rng() * 40);
         input.lane = rng() < 0.06 ? (rng() < 0.5 ? -1 : 1) : 0;
         input.jumpPressed = policy === "spam" ? true : rng() < 0.08;
         input.downPressed = rng() < 0.03;
         input.actionPressed = policy === "spam" ? true : rng() < 0.05;
         input.tag = policy === "spam" || rng() < 0.05 ? 1 + Math.floor(rng() * 5) : 0;
      }
      step(run, 1000 / fps, input);
   }
   if (run.ended === "win") expect(submittedMs(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
   return run;
}

describe("soundness: nobody beats the floor", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: honest, random and spamming players of every hero at 30, 60 and 144 fps`, () => {
         for (const h of HEROES) play(level, h.id, "bot", 60);
         for (const fps of [30, 144]) play(level, "riko", "bot", fps);
         for (let seed = 1; seed <= 3; seed++) play(level, HEROES[seed].id, seed === 2 ? "spam" : "random", seed % 2 ? 60 : 144, seed);
      }, 300_000);
   }
});

describe("the honest bot", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: wins with all three stars and no hit`, () => {
         for (const lead of ["riko", "vexa"] as const) {
            const run = play(level, lead, "bot", 60);
            expect(run.ended, lead).toBe("win");
            const stars = runStars(run);
            expect(stars.stars, lead).toBe(3);
            expect(run.hits, lead).toBe(0);
         }
      }, 300_000);
   }

   for (const level of [1, 4, 5] as const) {
      it(`level ${level}: the bot through the real store with ragged frames submits a time inside the limits`, () => {
         const store = createArcadeStore();
         store.getState().configure({ resultDelayMs: 1700 });
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
            if (ev.finished) {
               store.getState().setStat(STAT.finishMs, run.finishMs);
               store.getState().setStat(STAT.comboMs, run.combo.bonusTotal);
               store.getState().end("win");
            }
         }
         const s = store.getState();
         expect(s.endReason).toBe("win");
         const fin = finalScore(s);
         const rules = rollDashMeta.levels![level - 1].scoring;
         const sent = normalizeRun({ slug: "roll-dash", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-11-17T00:00:00Z" }, rules);
         expect(isRankedRun(rules, s.endReason)).toBe(true);
         expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
         expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
         expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
      }, 300_000);
   }
});

describe("mutation probes: the limits read the level they claim to", () => {
   it("no two levels share a row", () => {
      expect(new Set(LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]))).size).toBe(5);
      for (const a of LEVEL_IDS) for (const b of LEVEL_IDS) if (a !== b) expect(PROPOSED_LEVEL_LIMITS[b]).not.toEqual(proposeLimits(a));
   });
});
