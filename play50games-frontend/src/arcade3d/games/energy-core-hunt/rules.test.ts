// Energy Core Hunt's rules (README "Rules" and "Server limits and why they hold"): the arena's shape, the
// order and its waves, wrong picks, fading, orbiting and capsule cores, decoys, tesla coils, the gate,
// the scoring hand-off, the proof's bound and its guards (random and spam players, every hero), and the
// honest bot through the real store.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { energyCoreHuntMeta } from "./meta";
import { LEVELS } from "./levels";
import { HEROES, type HeroId } from "./heroes";
import { SECRETS } from "./progression";
import { createBot, botInput } from "./bot";
import { courseFor } from "./course";
import {
   DROP_MS,
   ORB,
   PROPOSED_LEVEL_LIMITS,
   STAT,
   STEP_MS,
   bossMinMs,
   comboSpecOf,
   corePos,
   createRun,
   createStepInput,
   finalScore,
   maxOrbs,
   minDurationMsOf,
   minFinishMs,
   proposeLimits,
   quotaUpTo,
   runTimeMs,
   step,
   teslaOn,
   waveMinMs,
   wanted,
   type CoreRun,
   type StepInput,
} from "./rules";

const FPS = [30, 60, 144];

export function botRun(level: LevelId, fps = 60, hero: HeroId = "vexa", routes = false): CoreRun {
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run, fms, routes);
   const input = createStepInput();
   for (let f = 0; f < 150_000 / fms && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   return run;
}

const submitted = (run: CoreRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function frames(run: CoreRun, n: number, input: StepInput = createStepInput()): void {
   for (let i = 0; i < n && run.ended === null; i++) step(run, 1000 / 60, input);
}

/** Stand on core i of the wave in play once it has landed. */
function onCore(run: CoreRun, i: number): void {
   frames(run, Math.ceil(DROP_MS / (1000 / 60)) + 2);
   const p = corePos(run, i);
   run.hero.x = p.x;
   run.hero.z = p.z;
   frames(run, 1);
}

describe("the arena (the order, the waves, the hero routes)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: the order is the card's ${LEVELS[id].cores} cores in its ${LEVELS[id].colors} colours; every wave can be filled; every core inside the arena`, () => {
         const c = courseFor(id);
         expect(c.order.reduce((a, b) => a + b, 0)).toBe(LEVELS[id].cores);
         for (let k = 0; k < 5; k++) if (c.order[k] > 0) expect(k).toBeLessThan(LEVELS[id].colors);
         for (const w of c.waves) {
            for (let k = 0; k < 5; k++) expect(w.cores.filter((q) => q.needed && q.color === k).length).toBe(w.quota[k]);
            for (const q of w.cores) {
               expect(Math.abs(q.x)).toBeLessThan(c.half - 0.5);
               expect(Math.abs(q.z)).toBeLessThan(c.half - 0.5);
               expect(Math.abs(q.altX)).toBeLessThan(c.half - 0.5);
               expect(Math.abs(q.altZ)).toBeLessThan(c.half - 0.5);
               expect(q.color).toBeLessThan(LEVELS[id].colors);
            }
         }
         expect(c.secrets.map((s) => s.id)).toEqual(SECRETS[id].map((s) => s.id));
         expect(c.orbs.some((o) => o.bonus === "ring")).toBe(true);
      });
   }

   it("the levels grow: wrong colours (1), fading cores (2), orbiting and capsule cores (3), decoys and teslas (4), the Core Sprite (5)", () => {
      expect(courseFor(1).waves[0].cores.some((q) => !q.needed && quotaUpTo(courseFor(1), 0)[q.color] === 0)).toBe(true);
      expect(courseFor(2).waves.some((w) => w.cores.some((q) => q.altX !== q.x))).toBe(true);
      const c3 = courseFor(3);
      expect(c3.waves.some((w) => w.cores.some((q) => q.kind === "orbit")) && c3.waves.some((w) => w.cores.some((q) => q.kind === "capsule"))).toBe(true);
      const c4 = courseFor(4);
      expect(c4.waves.some((w) => w.decoys.length > 0) && c4.teslas.length > 0).toBe(true);
      expect(courseFor(5).boss?.colors).toHaveLength(4);
   });
});

describe("the mechanics", () => {
   it("a wanted core counts; a core of a colour that is full is a wrong pick (stunned, a hit)", () => {
      const run = createRun(1, 1, "kiro");
      const w = run.course.waves[0];
      const good = w.cores.findIndex((q) => wanted(run, q.color));
      onCore(run, good);
      expect(run.count.reduce((a, b) => a + b, 0)).toBe(1);
      const run2 = createRun(1, 1, "kiro");
      const bad = w.cores.findIndex((q) => !wanted(run2, q.color));
      onCore(run2, bad);
      expect(run2.wrongs).toBe(1);
      expect(run2.hits).toBe(1);
      expect(run2.hero.heldUntil).toBeGreaterThan(run2.ms);
   });

   it("a core cannot be taken while it falls; the next wave drops once this one's share is in", () => {
      const run = createRun(1, 1, "kiro");
      const p = corePos(run, 0);
      run.hero.x = p.x;
      run.hero.z = p.z;
      frames(run, 3);
      expect(run.count.reduce((a, b) => a + b, 0)).toBe(0);
      const w = run.course.waves[0];
      for (let i = 0; i < w.cores.length; i++) if (w.cores[i].needed) onCore(run, i);
      expect(run.wave).toBe(1);
   });

   it("a capsule core is taken only once Action opens its capsule (level 3)", () => {
      const run = createRun(1, 3, "kiro");
      // fill wave 0 to reach the wave with a capsule
      for (let i = 0; i < run.course.waves[0].cores.length; i++) if (run.course.waves[0].cores[i].needed) onCore(run, i);
      const i = run.course.waves[1].cores.findIndex((q) => q.kind === "capsule");
      onCore(run, i);
      expect(run.taken[i]).toBe(0);
      step(run, 1000 / 60, { ...createStepInput(), actionPressed: true });
      frames(run, 2);
      expect(run.taken[i]).toBe(1);
   });

   it("a fading core drops again at its other spot (level 2)", () => {
      const run = createRun(1, 2, "kiro");
      run.hero.x = 9;
      run.hero.z = 9;
      frames(run, Math.ceil((DROP_MS + LEVELS[2].lifeMs + 200) / (1000 / 60)));
      expect(Array.from(run.alt).some((a) => a === 1)).toBe(true);
   });

   it("a live tesla coil zaps the hero near it; Kiro's shield shrugs it off", () => {
      for (const hero of ["riko", "kiro"] as HeroId[]) {
         const run = createRun(1, 4, hero);
         const t = run.course.teslas[0];
         run.hero.x = t.x + 1;
         run.hero.z = t.z;
         // just before it sparks
         let guard = 0;
         while (!(!teslaOn(run, 0) && teslaOn(run, 0, run.ms + 150)) && guard++ < 400) frames(run, 1);
         run.hero.invulnUntil = -1;
         run.hero.heldUntil = -1;
         const before = run.hits;
         step(run, 1000 / 60, { ...createStepInput(), actionPressed: true });
         guard = 0;
         while (!teslaOn(run, 0) && guard++ < 400) frames(run, 1);
         frames(run, 3);
         expect(run.hits - before, hero).toBe(hero === "kiro" ? 0 : 1);
      }
   });

   it("the gate opens only once the order is complete", () => {
      const run = botRun(1);
      expect(run.ended).toBe("win");
      expect(run.count).toEqual(run.course.order);
      const run2 = createRun(1, 1, "kiro");
      run2.hero.x = run2.course.gate.x;
      run2.hero.z = run2.course.gate.z;
      frames(run2, 30);
      expect(run2.ended).toBeNull();
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
   it("the floor is every wave's least time one after another; level 5 adds the Core Sprite's least defeat time", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         let sum = 0;
         for (let w = 0; w < c.waves.length; w++) {
            expect(waveMinMs(c, w)).toBeGreaterThanOrEqual(DROP_MS);
            sum += waveMinMs(c, w);
         }
         expect(minFinishMs(c)).toBeCloseTo(sum + (c.boss ? bossMinMs() : 0) - STEP_MS, 6);
      }
   });

   it("the least duration takes off the most orbs one hero can take and the most flow bonus; the limits are pinned", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(minDurationMsOf(c)).toBeCloseTo(Math.max(0, minFinishMs(c) - maxOrbs(c) * ORB.bonusMs - comboMaxBonus(comboSpecOf(c))), 6);
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim).toEqual(proposeLimits(c));
         expect(lim.minDurationMs).toBeLessThanOrEqual(minDurationMsOf(c));
         expect(lim.timeBaseMs).toBe(LEVELS[id].durationMs);
         expect(energyCoreHuntMeta.levels![id - 1].scoring).toMatchObject(lim);
      }
      expect(energyCoreHuntMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].timeBaseMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual(PINNED);
   });
});

/** minDurationMs, timeBaseMs, maxScore per level (README table). */
const PINNED = [
   [1600, 60000, 5840],
   [700, 75000, 7430],
   [1400, 90000, 8860],
   [1500, 105000, 10350],
   [14800, 120000, 10520],
];

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot wins at 30, 60 and 144 fps with the exact order, every main orb, never hit, never under the floor, at least 80 % of maxScore`, () => {
         for (const fps of FPS) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            expect(run.count).toEqual(run.course.order);
            expect(run.mainOrbs).toBe(run.course.mainOrbs);
            expect(run.hits).toBe(0);
            const lim = PROPOSED_LEVEL_LIMITS[level];
            expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(Math.floor((lim.timeBaseMs - submitted(run)) / 10)).toBeGreaterThanOrEqual(lim.maxScore * 0.8);
         }
      }, 120_000);
   }

   it("every hero's bot with its own route wins every level, never under the floor; Vexa takes the ring shard, Nami the crate-top sticker", () => {
      for (const level of LEVEL_IDS) {
         for (const h of HEROES) {
            const run = botRun(level, 60, h.id, true);
            expect(run.ended, `L${level} ${h.id}`).toBe("win");
            expect(submitted(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
            const ids = SECRETS[level].map((s) => s.id);
            if (h.id === "vexa") expect(run.secrets.found[ids.indexOf("ring")], `L${level}`).toBe(1);
            if (h.id === "nami" && ids.includes("high")) expect(run.secrets.found[ids.indexOf("high")], `L${level}`).toBe(1);
         }
      }
   }, 240_000);

   it("idle never finishes (a time-up is unranked)", () => {
      const run = createRun(1, 1);
      frames(run, 60 * 62);
      expect(run.ended).toBe("timeup");
      expect(isRankedRun(energyCoreHuntMeta.scoring, "timeup")).toBe(false);
   });

   it("60 spam runs (random moves, jumps, actions, frame times, any hero) never beat the floor", () => {
      for (let k = 0; k < 60; k++) {
         const level = LEVEL_IDS[k % 5];
         const rng = createRng(1000 + k);
         const run = createRun(k, level, HEROES[k % 5].id);
         const input = createStepInput();
         for (let f = 0; f < 12_000 && run.ended === null; f++) {
            input.moveX = rng() * 2 - 1;
            input.moveY = rng() * 2 - 1;
            input.yaw = rng() * 6;
            input.jumpPressed = rng() < 0.1;
            input.actionPressed = rng() < 0.1;
            step(run, 8 + rng() * 40, input);
         }
         if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
      }
   }, 120_000);

   it("every hero with its power mashed (and the plan) never beats the floor", () => {
      for (const level of LEVEL_IDS) {
         for (const h of HEROES) {
            const run = createRun(1, level, h.id);
            const bot = createBot(run, 1000 / 60, false);
            const input = createStepInput();
            for (let f = 0; f < 60 * 150 && run.ended === null; f++) {
               botInput(bot, run, input);
               if (f % 9 === 0 && !input.actionPressed) input.actionPressed = run.ms >= run.powerReadyAt;
               step(run, 1000 / 60, input);
            }
            if (run.ended === "win") expect(submitted(run), `L${level} ${h.id}`).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
         }
      }
   }, 240_000);

   for (const level of [1, 5] as const) {
      it(`level ${level}: the honest bot through the real store with ragged frames: a ranked win inside the limits, the score from the time`, () => {
         const store = createArcadeStore();
         store.getState().configure({ resultDelayMs: 1800 });
         store.getState().markReady();
         store.getState().start();
         const run = createRun(5, level);
         const bot = createBot(run, 1000 / 60, false);
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
         const rules = energyCoreHuntMeta.levels![level - 1].scoring;
         const sent = normalizeRun({ slug: "energy-core-hunt", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-11-17T00:00:00Z" }, rules);
         expect(isRankedRun(rules, s.endReason)).toBe(true);
         expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
         expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
         expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
      }, 120_000);
   }
});
