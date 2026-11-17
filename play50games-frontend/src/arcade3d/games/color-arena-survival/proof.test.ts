// The score proof (README "Server limits and why they hold"): each level's pinned row is its own
// proposeLimits and ships in meta; no run ever submits a time under the row's minDurationMs (honest,
// random and spamming players of every hero, 30 / 60 / 144 fps); the honest bot wins every level with
// three stars and no hit; a ragged-frame run through the real store submits a time inside the limits.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { bossMinMs, minFinishMs, proposeLimits } from "./bound";
import { LEVELS } from "./levels";
import { DROP_MS, MIN_CALL_MS, PROPOSED_LEVEL_LIMITS, RISE_MS, START_MS, STAT, createRun, createStepInput, finalScore, runStars, step, submittedMs, type ArenaRun, type StepInput } from "./rules";
import { colorArenaSurvivalMeta } from "./meta";

const PINNED = [
   [13670, 13300, 150000],
   [15910, 20900, 180000],
   [18890, 31100, 220000],
   [20880, 41200, 250000],
   [28100, 19000, 300000],
];

describe("the limits", () => {
   it("each level's row is its own proposeLimits, pinned, and shipped by meta", () => {
      for (const id of LEVEL_IDS) {
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim).toEqual(proposeLimits(id));
         expect(colorArenaSurvivalMeta.levels![id - 1].scoring).toMatchObject(lim);
      }
      expect(colorArenaSurvivalMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => { const l = PROPOSED_LEVEL_LIMITS[id]; return [l.maxScore, l.minDurationMs, l.maxDurationMs]; })).toEqual(PINNED);
   });

   it("levels 1-4: the floor is the round clock's least; level 5 the Keeper's least defeat", () => {
      for (const id of [1, 2, 3, 4] as const) {
         const r = LEVELS[id].rounds;
         expect(minFinishMs(id)).toBe(START_MS + r * (MIN_CALL_MS + DROP_MS) + (r - 1) * RISE_MS);
      }
      expect(minFinishMs(5)).toBe(bossMinMs());
      expect(bossMinMs()).toBeGreaterThan(15_000);
   });
});

type Policy = "bot" | "random" | "spam";

/** Plays a level to its end; a win's submitted time never beats the row. */
function play(level: LevelId, hero: HeroId, policy: Policy, fps: number, seed = 1): ArenaRun {
   const lim = PROPOSED_LEVEL_LIMITS[level];
   const rng = createRng(seed * 31 + 7);
   const run = createRun(seed, level, hero);
   const bot = createBot(run, 1000 / fps);
   const input: StepInput = createStepInput();
   let held = 0;
   const frames = Math.ceil(((level === 5 ? 240_000 : 120_000) * fps) / 1000);
   for (let f = 0; f < frames && run.ended === null; f++) {
      if (policy === "bot") botInput(bot, run, input);
      else {
         // a random player still runs for the called colour now and then (else it never survives)
         if (policy === "random" && rng() < 0.6) botInput(bot, run, input);
         else if (held-- <= 0) {
            held = 5 + Math.floor(rng() * 40);
            input.moveX = rng() * 2 - 1;
            input.moveZ = rng() * 2 - 1;
            input.yaw = rng() * 6.28;
         }
         input.jumpPressed = policy === "spam" ? true : input.jumpPressed || rng() < 0.05;
         input.actionPressed = policy === "spam" ? true : rng() < 0.04;
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
      it(`level ${level}: every hero wins on three seeds; Vexa with all three stars and no hit`, () => {
         for (const h of HEROES) for (const seed of [1, 2, 3]) expect(play(level, h.id, "bot", 60, seed).ended).toBe("win");
         for (const seed of [1, 2]) {
            const run = play(level, "vexa", "bot", 60, seed);
            expect(runStars(run).stars).toBe(3);
            expect(run.hits).toBe(0);
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
               store.getState().end("win");
            } else if (ev.lost) store.getState().end("lose");
         }
         const s = store.getState();
         expect(s.endReason).toBe("win");
         const fin = finalScore(s);
         const rules = colorArenaSurvivalMeta.levels![level - 1].scoring;
         const sent = normalizeRun({ slug: "color-arena-survival", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-11-17T00:00:00Z" }, rules);
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
