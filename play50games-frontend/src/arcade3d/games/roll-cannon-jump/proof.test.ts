// The score proof (README "Server limits and why they hold"): the pinned limits are each level's own
// proposeLimits over the Dijkstra bound (bound.ts); every node's first arrival in thousands of random
// and adversarial runs (random aims, any power, nudges, dives, every hero's power mashed) is never
// earlier than the bound says; the honest bot wins every level at 30, 60 and 144 fps with every
// main orb, inside the limits; idle runs time out unranked; a ragged-frame run through the real store
// submits a ranked score inside the limits; and mutation probes show the rows read their own level.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { createBot, botInput } from "./bot";
import { HEROES, type HeroId } from "./heroes";
import { LEVELS } from "./levels";
import { LAYOUTS, buildCourse } from "./layouts";
import { bossMinMs, buildNodes, dijkstra, minDurationMsOf, minFinishMs, progressFloorMs, proposeLimits } from "./bound";
import { LEVEL1_LIMITS, PROPOSED_LEVEL_LIMITS, STAT, courseFor, createRun, createStepInput, finalScore, runTimeMs, step, type CannonRun, type StepInput } from "./rules";
import { rollCannonJumpMeta } from "./meta";
import type { ShowBuilder } from "./show";

const submitted = (run: CannonRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);
const scoreOf = (level: LevelId, run: CannonRun) => Math.floor((PROPOSED_LEVEL_LIMITS[level].timeBaseMs - submitted(run)) / 10);

const cache = new Map<string, CannonRun>();
function botRun(level: LevelId, fps: number, hero: HeroId = "riko", mash = false): CannonRun {
   const key = `${level}:${fps}:${hero}:${mash}`;
   const hit = cache.get(key);
   if (hit) return hit;
   const fms = 1000 / fps;
   const run = createRun(1, level, hero);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      if (mash) input.actionPressed = f % 7 === 0;
      step(run, fms, input);
   }
   cache.set(key, run);
   return run;
}

/** minDurationMs, maxDurationMs, timeBaseMs, maxScore per level (README table). */
const PINNED = [
   [1400, 75000, 75000, 7360],
   [2100, 90000, 90000, 8790],
   [3200, 110000, 110000, 10680],
   [4300, 125000, 125000, 12070],
   [24000, 200000, 200000, 17600],
];

describe("the limits", () => {
   it("each level's row is its own course's proposeLimits (the Dijkstra bound less about 4.5 %), pinned, and shipped by meta", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const lb = minDurationMsOf(c);
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim).toEqual(proposeLimits(id, c));
         expect(lim.minDurationMs).toBeLessThanOrEqual(lb);
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(lb * 0.94);
         expect(lim.maxScore).toBe(Math.floor((lim.timeBaseMs - lim.minDurationMs) / 10));
         expect(lim.timeBaseMs).toBe(LEVELS[id].durationMs);
         expect(rollCannonJumpMeta.levels![id - 1].scoring).toMatchObject(lim);
      }
      expect(LEVEL1_LIMITS).toBe(PROPOSED_LEVEL_LIMITS[1]);
      expect(rollCannonJumpMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].maxDurationMs, PROPOSED_LEVEL_LIMITS[id].timeBaseMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual(PINNED);
   });

   it("every level is worth at least level 1's points, and level 5 at most 3x", () => {
      const l1 = PROPOSED_LEVEL_LIMITS[1].maxScore;
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(l1);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(l1 * 3);
   });

   it("level 5 adds Ashbag's least defeat time from the stage (every window hit at its first ms)", () => {
      const c = courseFor(5);
      expect(bossMinMs()).toBeGreaterThan(20_000);
      expect(minFinishMs(c)).toBe(progressFloorMs(c) + bossMinMs());
   });
});

/** Every node's least first-arrival over the three motion variants (the bound's own numbers). */
function arrivalFloors(level: LevelId): Map<string, number> {
   const c = courseFor(level);
   const nodes = buildNodes(c);
   const out = new Map<string, number>();
   for (const v of ["plain", "riko", "nami"] as const) {
      const d = dijkstra(c, v, nodes);
      d.labels.forEach((l, i) => out.set(l, Math.min(out.get(l) ?? Infinity, d.arrival[i])));
   }
   return out;
}

/** A random but purposeful player: random aims and moments, nudges, dives, mashed powers. */
function randomRun(level: LevelId, seed: number, hero: HeroId, check: (label: string, ms: number) => void): CannonRun {
   const rng = createRng(seed * 7919 + level * 31);
   const run = createRun(seed, level, hero);
   const input = createStepInput();
   let aimFor = -2;
   let fireAt = 0;
   let sx = 0;
   let sz = 0;
   for (let f = 0; f < 4000 && run.ended === null; f++) {
      const h = run.hero;
      input.jumpPressed = false;
      input.actionPressed = rng() < 0.06;
      input.yaw = rng() < 0.3 ? (rng() * 2 - 1) * 4 : 0;
      if (h.mode === "aim") {
         if (aimFor !== h.aimFrom) {
            aimFor = h.aimFrom;
            fireAt = rng() * 1300;
            sx = rng() * 2 - 1;
            sz = rng() * 2 - 1;
         }
         const t = run.simMs - h.aimFrom;
         input.moveX = t < 300 ? sx : 0;
         input.moveZ = t < 300 ? sz : 0;
         input.jumpPressed = t >= fireAt;
         input.jumpHeld = input.jumpPressed;
      } else {
         if (f % 8 === 0) {
            input.moveX = rng() * 2 - 1;
            input.moveZ = rng() * 2 - 1.3;
         }
         input.jumpPressed = rng() < 0.05;
         input.jumpHeld = input.jumpPressed || (input.jumpHeld && rng() < 0.9);
      }
      const ev = step(run, 4 + rng() * 30, input);
      if (ev.caught >= 0) check(`c${ev.caught}`, run.simMs);
      if (ev.landed >= 0) check(`p${ev.landed}`, run.simMs);
      if (ev.bounced >= 0) check(`t${ev.bounced}`, run.simMs);
      if (ev.balloon >= 0) check(`b${ev.balloon}`, run.simMs);
      if (ev.finished && !run.boss) check("finish", run.simMs);
   }
   return run;
}

describe("the bound holds against every shot (soundness probes)", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: 150 random players (every hero, random aims, any power, nudges, dives, powers) never reach any rest before the bound's floor for it`, () => {
         const floors = arrivalFloors(level);
         const slack = 2 * buildNodes(courseFor(level)).length + 1;
         let checks = 0;
         let finishes = 0;
         for (let seed = 1; seed <= 150; seed++) {
            const hero = HEROES[seed % HEROES.length].id;
            const run = randomRun(level, seed, hero, (label, ms) => {
               checks++;
               const fl = floors.get(label) ?? Infinity;
               expect(ms, `${hero} ${label}`).toBeGreaterThanOrEqual(Math.floor(fl) - slack);
            });
            if (run.ended === "win") {
               finishes++;
               expect(submitted(run)).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
            }
         }
         expect(checks).toBeGreaterThan(5);
         void finishes;
      }, 240_000);
   }

   it("the honest bot's rests are never before their floors either (it plays close to them)", () => {
      for (const level of [1, 2, 3, 4] as const) {
         const floors = arrivalFloors(level);
         const run = createRun(1, level);
         const bot = createBot(run);
         const input = createStepInput();
         for (let f = 0; f < 100_000 && run.ended === null; f++) {
            botInput(bot, run, input);
            const ev = step(run, 1000 / 60, input);
            if (ev.caught >= 0) expect(run.simMs).toBeGreaterThanOrEqual(Math.floor(floors.get(`c${ev.caught}`)!) - 80);
         }
         expect(run.ended).toBe("win");
         expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.course));
      }
   }, 120_000);
});

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot wins at 30, 60 and 144 fps with every main orb, never under the floor, at least 85 % of maxScore`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const fps of [30, 60, 144]) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.course));
            const d = submitted(run);
            expect(d).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(d).toBeLessThanOrEqual(lim.maxDurationMs);
            expect(scoreOf(level, run), `${fps} fps`).toBeGreaterThanOrEqual(lim.maxScore * 0.85);
            expect(run.mainOrbs, `${fps} fps main orbs`).toBe(run.course.mainOrbs);
         }
      }, 240_000);
   }

   it("every hero clears every level with the plain bot; with its power mashed a finish never beats the floor", () => {
      for (const level of LEVEL_IDS) {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const h of HEROES) {
            expect(botRun(level, 60, h.id).ended, `${h.id} L${level}`).toBe("win");
            const m = botRun(level, 60, h.id, true);
            if (m.ended === "win") expect(submitted(m)).toBeGreaterThanOrEqual(lim.minDurationMs);
         }
      }
   }, 600_000);

   it("idle never wins: the show's time cap ends it unranked", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(3, id);
         const none = createStepInput();
         for (let f = 0; f < 10_000 && run.ended === null; f++) step(run, 50, none);
         expect(run.ended).toBe("timeup");
         expect(run.simMs).toBe(LEVELS[id].durationMs);
      }
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1600 });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(3, 1);
      const input = createStepInput();
      for (let f = 0; f < 20_000 && store.getState().phase !== "over"; f++) {
         advanceRunClock(store, 1 / 60);
         const dt = playedFrameDt(store.getState());
         if (dt <= 0) continue;
         const ev = step(run, dt * 1000, input);
         if (ev.timeup) store.getState().end("timeup");
      }
      expect(store.getState().endReason).toBe("timeup");
      expect(isRankedRun(rollCannonJumpMeta.scoring, store.getState().endReason)).toBe(false);
   });

   for (const level of [1, 5] as const) {
      it(`level ${level}: the honest bot through the real store with ragged frames: a ranked win inside the limits, the score from the time`, () => {
         const store = createArcadeStore();
         store.getState().configure({ resultDelayMs: 1600 });
         store.getState().markReady();
         store.getState().start();
         const run = createRun(5, level);
         const bot = createBot(run);
         const input: StepInput = createStepInput();
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
         expect(run.finishMs).toBeLessThanOrEqual(s.elapsedMs + 1);
         const fin = finalScore(s);
         const rules = rollCannonJumpMeta.levels![level - 1].scoring;
         const sent = normalizeRun({ slug: "roll-cannon-jump", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-28T00:00:00Z" }, rules);
         expect(isRankedRun(rules, s.endReason)).toBe(true);
         expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
         expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
         expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
      }, 240_000);
   }
});

describe("mutation probes: the limits read the level they claim to", () => {
   it("no two levels share a row, and no level's row is another level's proposeLimits", () => {
      expect(new Set(LEVEL_IDS.map((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]))).size).toBe(5);
      for (const a of LEVEL_IDS) for (const b of LEVEL_IDS) if (a !== b) expect(PROPOSED_LEVEL_LIMITS[b]).not.toEqual(proposeLimits(a, courseFor(a)));
   });

   for (const level of [1, 2, 3, 4] as const) {
      it(`level ${level}: the finish ring moved 30 % closer falls outside the limits window`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         const accepts = (lb: number) => lim.minDurationMs <= lb && lim.minDurationMs >= lb * 0.94;
         expect(accepts(minDurationMsOf(courseFor(level)))).toBe(true);
         const closer = buildCourse(LEVELS[level], (b: ShowBuilder) => {
            LAYOUTS[level](b);
            const f = b.d.finish!;
            b.d.finish = { ...f, z: f.z * 0.7 };
         });
         expect(accepts(minDurationMsOf(closer))).toBe(false);
      });
   }
});
