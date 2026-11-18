// The score proof (README "Server limits and why they hold"): the pinned limits are each level's own
// proposeLimits over bound.ts; in hundreds of random and adversarial runs (every hero, its power
// mashed, random walks onto plates, any frame size) the k-th cell is never charged before
// firstMs + (k - 1) * cadence + the travel floor, and no win beats the limit; the honest bot wins
// every level at 30, 60 and 144 fps inside the limits; idle runs time out unranked; ragged-frame runs
// through the real store submit ranked scores inside the limits; mutation probes.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { SHOWS, parseFloor } from "./factory";
import { bossMinMs, cellSteps, minDurationMsOf, minFinishMs, proposeLimits, travelFloorMs } from "./bound";
import { PROPOSED_LEVEL_LIMITS, STAT, createRun, createStepInput, finalScore, floorFor, mainOrbTotal, runTimeMs, step, type FactoryRun, type StepInput } from "./rules";
import { robotFactoryRunMeta } from "./meta";

const submitted = (run: FactoryRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);
const scoreOf = (level: LevelId, run: FactoryRun) => Math.floor((PROPOSED_LEVEL_LIMITS[level].timeBaseMs - submitted(run)) / 10);

const cache = new Map<string, FactoryRun>();
function botRun(level: LevelId, fps: number, hero: HeroId = "riko", mash = false): FactoryRun {
   const key = `${level}:${fps}:${hero}:${mash}`;
   const hit = cache.get(key);
   if (hit) return hit;
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      if (mash) input.actionPressed = f % 9 === 0;
      step(run, fms, input);
   }
   cache.set(key, run);
   return run;
}

/** minDurationMs, maxDurationMs, timeBaseMs, maxScore per level (README table). */
const PINNED = [
   [7200, 90000, 90000, 8280],
   [13500, 110000, 110000, 9650],
   [8300, 120000, 120000, 11170],
   [10900, 140000, 140000, 12910],
   [15100, 240000, 240000, 22490],
];

describe("the limits", () => {
   it("each row is its own floor's proposeLimits (the bound less about 4.5 %), pinned, shipped by meta", () => {
      for (const id of LEVEL_IDS) {
         const f = floorFor(id);
         const lb = minDurationMsOf(f);
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim).toEqual(proposeLimits(id, f, LEVELS[id].durationMs));
         expect(lim.minDurationMs).toBeLessThanOrEqual(lb);
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(lb * 0.94);
         expect(lim.maxScore).toBe(Math.floor((lim.timeBaseMs - lim.minDurationMs) / 10));
         expect(robotFactoryRunMeta.levels![id - 1].scoring).toMatchObject(lim);
      }
      expect(robotFactoryRunMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].maxDurationMs, PROPOSED_LEVEL_LIMITS[id].timeBaseMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual(PINNED);
   });

   it("every level is worth at least level 1's points, and level 5 at most 3x", () => {
      const l1 = PROPOSED_LEVEL_LIMITS[1].maxScore;
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(l1);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(l1 * 3);
   });

   it("the cell floor: the fewest tile steps (any direction, arms free) at 0.8 s, less what a flick or a magnet hop can save; level 5 is M-8's least defeat", () => {
      expect(cellSteps(floorFor(1))).toBe(10);
      expect(cellSteps(floorFor(3))).toBeLessThan(10);
      for (const id of [1, 2, 3, 4] as const) {
         const f = floorFor(id);
         expect(travelFloorMs(f)).toBeLessThan(cellSteps(f) * 800);
         expect(minFinishMs(f)).toBe(f.spec.firstMs + (f.spec.cells - 1) * f.spec.cadenceMs + travelFloorMs(f));
      }
      expect(minFinishMs(floorFor(5))).toBe(bossMinMs());
   });
});

/** A random player: random walks (it steps on plates on its way), jumps, drops, a mashed power. */
function randomRun(level: LevelId, seed: number, hero: HeroId, onCharge: (k: number, ms: number) => void): FactoryRun {
   const rng = createRng(seed * 104729 + level);
   const run = createRun(seed, level, hero);
   const input: StepInput = createStepInput();
   // half the players start from the wiring the route wants, so cells really flow
   if (seed % 2 === 0) run.board.turns = run.floor.spec.route.slice() as typeof run.board.turns;
   for (let f = 0; f < 5000 && run.ended === null; f++) {
      if (f % 12 === 0) {
         input.moveX = rng() * 2 - 1;
         input.moveZ = rng() * 2 - 1;
      }
      input.jumpPressed = rng() < 0.05;
      input.jumpHeld = input.jumpPressed;
      input.actionPressed = rng() < 0.08;
      input.yaw = rng() < 0.2 ? rng() * 6 : 0;
      const ev = step(run, 4 + rng() * 30, input);
      if (ev.charged) onCharge(run.board.charged, run.simMs);
   }
   return run;
}

describe("the bound holds (soundness probes)", () => {
   for (const level of [1, 2, 3, 4] as const) {
      it(`level ${level}: 120 random players (every hero, powers mashed, half pre-wired) never charge the k-th cell before firstMs + (k-1) * cadence + the travel floor`, () => {
         const f = floorFor(level);
         const travel = travelFloorMs(f);
         let charges = 0;
         for (let seed = 1; seed <= 120; seed++) {
            const run = randomRun(level, seed, HEROES[seed % 5].id, (k, ms) => {
               charges++;
               expect(ms).toBeGreaterThanOrEqual(f.spec.firstMs + (k - 1) * f.spec.cadenceMs + travel);
            });
            if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
         }
         expect(charges).toBeGreaterThan(10);
      }, 240_000);
   }
});

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot wins at 30, 60 and 144 fps, never under the floor, at least 75 % of maxScore`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const fps of [30, 60, 144]) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.floor));
            const d = submitted(run);
            expect(d).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(scoreOf(level, run), `${fps} fps`).toBeGreaterThanOrEqual(lim.maxScore * 0.75);
            if (level < 5) expect(run.mainOrbs, `${fps} fps main orbs`).toBe(mainOrbTotal(run.floor));
         }
      }, 240_000);
   }

   it("every hero clears every level with the plain bot; with its power mashed a finish never beats the floor", () => {
      for (const level of LEVEL_IDS) {
         for (const h of HEROES) {
            expect(botRun(level, 60, h.id).ended, `${h.id} L${level}`).toBe("win");
            const m = botRun(level, 60, h.id, true);
            if (m.ended === "win") expect(submitted(m)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
         }
      }
   }, 600_000);

   it("idle never wins: the shift's cap ends it unranked", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(3, id);
         for (let f = 0; f < 10_000 && run.ended === null; f++) step(run, 50, createStepInput());
         expect(run.ended).toBe("timeup");
         expect(isRankedRun(robotFactoryRunMeta.scoring, "timeup")).toBe(false);
      }
   });

   for (const level of [1, 5] as const) {
      it(`level ${level}: the honest bot through the real store with ragged frames: a ranked win inside the limits`, () => {
         const store = createArcadeStore();
         store.getState().configure({ resultDelayMs: 1800 });
         store.getState().markReady();
         store.getState().start();
         const run = createRun(5, level);
         const bot = createBot(run);
         const input = createStepInput();
         const rng = createRng(11);
         for (let f = 0; f < 80_000 && store.getState().phase !== "over"; f++) {
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
         const rules = robotFactoryRunMeta.levels![level - 1].scoring;
         const sent = normalizeRun({ slug: "robot-factory-run", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-28T00:00:00Z" }, rules);
         expect(isRankedRun(rules, s.endReason)).toBe(true);
         expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
         expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
         expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
      }, 240_000);
   }
});

describe("mutation probes: the limits read the level they claim to", () => {
   it("no two levels share a row; no row is another level's proposeLimits", () => {
      expect(new Set(LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]))).size).toBe(5);
      for (const a of LEVEL_IDS) for (const b of LEVEL_IDS) if (a !== b) expect(PROPOSED_LEVEL_LIMITS[b]).not.toEqual(proposeLimits(a, floorFor(a), LEVELS[a].durationMs));
   });

   for (const level of [1, 2, 3, 4] as const) {
      it(`level ${level}: a faster dispenser beat falls outside the limits window`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         const accepts = (lb: number) => lim.minDurationMs <= lb && lim.minDurationMs >= lb * 0.94;
         expect(accepts(minDurationMsOf(floorFor(level)))).toBe(true);
         const fast = parseFloor(level, { ...SHOWS[level], cadenceMs: SHOWS[level].cadenceMs * 0.5 });
         expect(accepts(minDurationMsOf(fast))).toBe(false);
      });
   }
});
