// Candy World Runner's rules (README "Rules" and "Server limits and why they hold"): the road's shape,
// the size mechanic, the twists, the scoring hand-off, the proof's bound and its guards (never faster
// than the level's speed, random and spam players), and the honest bot through the real store.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { candyWorldRunnerMeta } from "./meta";
import { LEVELS } from "./levels";
import { HEROES, type HeroId } from "./heroes";
import { SECRETS } from "./progression";
import { createBot, botInput } from "./bot";
import { BIG, NORMAL, SMALL, courseFor, laneX, needOf } from "./course";
import {
   BURN_MS,
   ORB,
   PROPOSED_LEVEL_LIMITS,
   SLOW,
   STAT,
   STEP_MS,
   bossMinMs,
   comboSpecOf,
   createRun,
   createStepInput,
   finalScore,
   maxOrbs,
   minDurationMsOf,
   minFinishMs,
   proposeLimits,
   runTimeMs,
   step,
   type CandyRun,
   type StepInput,
} from "./rules";

const FPS = [30, 60, 144];

function botRun(level: LevelId, fps = 60, hero: HeroId = "zuno"): CandyRun {
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 240_000 / fms && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   return run;
}

const submitted = (run: CandyRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function frames(run: CandyRun, n: number, input: StepInput = createStepInput()): void {
   for (let i = 0; i < n && run.ended === null; i++) step(run, 1000 / 60, input);
}

describe("the road (beats, coins, the hero routes)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: every Big beat has the coins that grow you there in its lane; beats are at least 25 m apart; ${id <= 2 ? "one lane at every beat is free" : "at least two lanes at a beat hold an obstacle"}`, () => {
         const c = courseFor(id);
         let size = -1;
         for (let i = 0; i < c.beats.length; i++) {
            const b = c.beats[i];
            // the plan's size coming into the beat (each phase of the palace starts Small)
            const before = i === 0 || c.beats[i - 1].phase !== b.phase ? SMALL : size;
            size = b.need;
            if (i > 0 && c.beats[i - 1].phase === b.phase) expect(b.s - c.beats[i - 1].s).toBeGreaterThanOrEqual(25);
            const row = c.obstacles.filter((o) => Math.abs(o.s - b.s) < 0.01 && o.phase === b.phase);
            if (id <= 2) expect(row.length).toBeLessThan(3);
            else expect(row.length).toBeGreaterThanOrEqual(2);
            if (b.need === BIG && before !== BIG) {
               const coins = c.coins.filter((k) => k.lane === b.lane && k.phase === b.phase && k.s < b.s && k.s > b.s - 30);
               expect(coins.length).toBeGreaterThanOrEqual(3);
            }
         }
         expect(c.secrets).toHaveLength(SECRETS[id].length);
         const heroes = new Set(c.orbs.map((o) => o.bonus).filter((b) => b && b !== "donut"));
         for (const h of ["riko", "nami", "kiro", "zuno", "vexa"]) expect(heroes.has(h as HeroId), `L${id} ${h}`).toBe(true);
      });
   }

   it("level 1 teaches in three beats: grow and smash a jelly cube, roll and slip under a cookie arch, then both in a row", () => {
      const c = courseFor(1);
      expect(c.obstacles.find((o) => o.s === c.beats[0].s && o.lane === c.beats[0].lane)!.kind).toBe("jelly");
      expect(c.beats[1].need).toBe(SMALL);
      expect(c.beats.slice(2, 4).map((b) => b.need)).toEqual([BIG, SMALL]);
   });
});

describe("the size mechanic", () => {
   it("3 candy coins grow you a size; Big takes no more; the roll drops one size per 0.6 s", () => {
      const run = createRun(1, 1);
      const c = run.course;
      const lane = c.coins[0].lane;
      run.runner.lane = lane;
      run.runner.x = laneX(lane);
      run.runner.s = c.coins[0].s - 1;
      frames(run, 60);
      expect(run.runner.size).toBeGreaterThanOrEqual(NORMAL);
      // past the coins (rolling while you still eat would grow you again)
      run.runner.s = c.coins.filter((k) => k.lane === lane).reduce((m, k) => Math.max(m, k.s), 0) + 2;
      const roll = createStepInput();
      roll.roll = true;
      const before = run.runner.size;
      frames(run, Math.ceil(BURN_MS / (1000 / 60)) + 2, roll);
      expect(run.runner.size).toBe(before - 1);
   });

   it("meeting an obstacle at the wrong size is a size miss: half speed for 0.8 s; the right size clears it", () => {
      for (const right of [true, false]) {
         const run = createRun(1, 1);
         const b = run.course.beats[0];
         run.runner.lane = b.lane;
         run.runner.x = laneX(b.lane);
         run.runner.s = b.s - 0.5;
         run.runner.size = right ? b.need : b.need === BIG ? SMALL : BIG;
         run.course.coins.forEach((_k, i) => (run.coinLap[i] = 0));
         frames(run, 6);
         expect(run.misses).toBe(right ? 0 : 1);
         if (!right) expect(run.runner.slowUntil).toBeGreaterThan(run.ms);
      }
   });

   it("the twists: a Big hero cracks a chocolate bridge; a Small one bounces off a donut; a gummy bites you down a size", () => {
      const r2 = createRun(1, 2);
      const br = r2.course.bridges[0];
      r2.runner.lane = br.lane;
      r2.runner.x = laneX(br.lane);
      r2.runner.s = br.s0 + 1;
      r2.runner.size = BIG;
      frames(r2, 3);
      expect(r2.bridgeCracked[0]).toBe(1);
      const r3 = createRun(1, 2);
      const d = r3.course.donuts[0];
      r3.runner.lane = d.lane;
      r3.runner.x = laneX(d.lane);
      r3.runner.s = d.s - 0.3;
      frames(r3, 5);
      expect(r3.runner.h).toBeGreaterThan(0.1);
      const r4 = createRun(1, 4);
      const g = r4.course.gummies[0];
      r4.runner.lane = g.lane;
      r4.runner.x = laneX(g.lane);
      r4.runner.s = g.s - 0.5;
      r4.runner.size = BIG;
      frames(r4, 5);
      expect(r4.runner.size).toBe(NORMAL);
   });
});

describe("scoring hand-off", () => {
   it("finalScore: a win submits the finish minus 100 ms per orb and the flow bonus; anything else keeps elapsedMs", () => {
      const win = finalScore({ score: 0, endReason: "win", elapsedMs: 50_000, stats: { [STAT.finishMs]: 40_000, [STAT.orbs]: 10, [STAT.comboMs]: 500 } });
      expect(win.durationMs).toBe(40_000 - 10 * ORB.bonusMs - 500);
      expect(finalScore({ score: 0, endReason: "timeup", elapsedMs: 50_000, stats: {} }).durationMs).toBe(50_000);
   });
});

describe("the lower bound (README 'Server limits')", () => {
   it("the floor is the road at the level's speed; level 5 adds the king's least defeat time (or a lap)", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         if (!c.loop) expect(minFinishMs(c)).toBeCloseTo((c.finishS / c.config.speed) * 1000 - STEP_MS, 6);
         else expect(minFinishMs(c)).toBeGreaterThan(bossMinMs());
      }
   });

   it("the least duration takes off the most orbs one hero can take and the most flow bonus; the limits are pinned", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(minDurationMsOf(c)).toBeCloseTo(Math.max(0, minFinishMs(c) - maxOrbs(c) * ORB.bonusMs - comboMaxBonus(comboSpecOf(c))), 6);
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim).toEqual(proposeLimits(c));
         expect(lim.minDurationMs).toBeLessThanOrEqual(minDurationMsOf(c));
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(minDurationMsOf(c) * 0.94);
         expect(lim.timeBaseMs).toBe(LEVELS[id].durationMs);
         expect(candyWorldRunnerMeta.levels![id - 1].scoring).toMatchObject(lim);
      }
      expect(candyWorldRunnerMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].timeBaseMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual(PINNED);
   });
});

/** minDurationMs, timeBaseMs, maxScore per level (README table). */
const PINNED = [
   [40800, 120000, 7920],
   [39900, 130000, 9010],
   [30000, 140000, 11000],
   [27100, 150000, 12290],
   [32600, 200000, 16740],
];

describe("the speed guard (the proof's one rule)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: 30 s of random input (every hero, ragged frames) never moves the runner further in a step than the level's speed allows`, () => {
         for (const hero of HEROES) {
            const rng = createRng(id * 17 + hero.id.length);
            const run = createRun(1, id, hero.id);
            const input = createStepInput();
            for (let f = 0; f < 1500 && run.ended === null; f++) {
               input.left = rng() < 0.08;
               input.right = rng() < 0.08;
               input.roll = rng() < 0.3;
               input.jumpPressed = rng() < 0.08;
               input.actionPressed = rng() < 0.05;
               const s0 = run.runner.s;
               const lap0 = run.lap;
               const ms0 = run.ms;
               step(run, 5 + rng() * 40, input);
               if (run.lap === lap0) expect(run.runner.s - s0).toBeLessThanOrEqual((run.course.config.speed * (run.ms - ms0)) / 1000 + 1e-6);
            }
         }
         expect(SLOW).toBeLessThan(1);
      });
   }
});

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot (Zuno) wins at 30, 60 and 144 fps with every main orb and no size miss, never under the floor, at least 80 % of maxScore`, () => {
         for (const fps of FPS) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            expect(run.mainOrbs).toBe(run.course.mainOrbs);
            expect(run.misses).toBe(0);
            const lim = PROPOSED_LEVEL_LIMITS[level];
            expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(Math.floor((lim.timeBaseMs - submitted(run)) / 10)).toBeGreaterThanOrEqual(lim.maxScore * 0.8);
         }
      }, 120_000);
   }

   it("idle runs into wrong sizes but still reaches the end slower (the clock never stops a runner); the result is unranked only on a time-up", () => {
      const run = createRun(1, 1);
      frames(run, 60 * 200);
      expect(run.ended).toBe("win");
      expect(run.misses).toBeGreaterThan(0);
      expect(submitted(run)).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[1].minDurationMs);
      expect(isRankedRun(candyWorldRunnerMeta.scoring, "timeup")).toBe(false);
   });

   it("60 spam runs (random lanes, rolls, jumps, powers, frame times, any hero) never beat the floor", () => {
      for (let k = 0; k < 60; k++) {
         const level = LEVEL_IDS[k % 5];
         const rng = createRng(1000 + k);
         const run = createRun(k, level, HEROES[k % 5].id);
         const input = createStepInput();
         for (let f = 0; f < 20_000 && run.ended === null; f++) {
            input.left = rng() < 0.1;
            input.right = rng() < 0.1;
            input.roll = rng() < 0.4;
            input.jumpPressed = rng() < 0.1;
            input.actionPressed = rng() < 0.1;
            step(run, 8 + rng() * 40, input);
         }
         if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
      }
   }, 120_000);

   it("the honest bot through the real store with ragged frames: a ranked win inside the limits, the score from the time", () => {
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1800 });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(5, 1);
      const bot = createBot(run);
      const input = createStepInput();
      const rng = createRng(11);
      for (let f = 0; f < 50_000 && store.getState().phase !== "over"; f++) {
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
      expect(run.finishMs).toBeLessThanOrEqual(s.elapsedMs + 1);
      const fin = finalScore(s);
      const rules = candyWorldRunnerMeta.scoring;
      const sent = normalizeRun({ slug: "candy-world-runner", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-29T00:00:00Z" }, rules);
      expect(isRankedRun(rules, s.endReason)).toBe(true);
      expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
      expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
      expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
   });
});

void needOf;
