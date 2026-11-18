// Dragon Cave Rush rules: the rails and the lean, hops and ducks, lanes, breaths, the meter, falls and
// respawns, the hand-off to the store, and the server-limit proof (README "Server limits and why they
// hold"): the speed guard on every substep, the pinned limits, the boss floor, and an honest, an idle and
// a spam bot driven through the real store like the shell does.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { dragonCaveRushMeta } from "./meta";
import { LEVELS } from "./levels";
import { HEROES } from "./heroes";
import { SECRETS } from "./progression";
import { createBot, botInput } from "./bot";
import { segmentAt } from "./track";
import {
   BREATH,
   LEAN_BONUS,
   METER,
   ORB,
   PROPOSED_LEVEL_LIMITS,
   STAT,
   STEP_MS,
   bossMinMs,
   comboSpecOf,
   courseFor,
   createRun,
   createStepInput,
   finalScore,
   minDurationMsOf,
   minFinishMs,
   runTimeMs,
   step,
   travelFloorMs,
   vmaxAt,
   type CaveRun,
   type StepInput,
} from "./rules";

const FPS = [30, 60, 144];

function botRun(level: LevelId, fps = 60, hero: (typeof HEROES)[number]["id"] = "riko"): CaveRun {
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

const submitted = (run: CaveRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function frames(run: CaveRun, n: number, input: StepInput = createStepInput()): void {
   for (let i = 0; i < n && run.ended === null; i++) step(run, 1000 / 60, input);
}

describe("the cave (one rail line, side tracks, hazards)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: every curve leans, every hazard and orb lies before the exit, all five heroes have a side route, 1-3 secrets`, () => {
         const c = courseFor(id);
         expect(c.segments.filter((g) => g.turn !== 0).length).toBeGreaterThanOrEqual(4);
         for (const h of c.hazards) expect(h.s + h.len).toBeLessThanOrEqual(c.finishS);
         for (const o of c.orbs) expect(o.s).toBeLessThan(c.finishS);
         const gates = new Set(c.orbs.map((o) => o.bonus).filter((b) => b !== null));
         for (const h of ["riko", "nami", "kiro", "zuno", "vexa"]) expect(gates.has(h as never), h).toBe(true);
         expect(c.secrets.length).toBe(SECRETS[id].length);
         expect(!!c.loop).toBe(LEVELS[id].boss);
         expect(c.lanterns.length).toBeGreaterThanOrEqual(3);
      });

      it(`level ${id}: no breath fires over a rock or a gap on the main line (one action at a time)`, () => {
         const c = courseFor(id);
         const v = c.config.speed;
         for (const br of c.breaths) {
            const a = br.s + v * 0.95;
            const b = br.s + v * LEAN_BONUS * 1.65;
            for (const hz of c.hazards) {
               if ((hz.kind !== "rock" && hz.kind !== "gap") || hz.lane !== 0) continue;
               expect(hz.s - v * 0.35 >= b || hz.s + hz.len + 2 <= a, `breath ${br.s} / ${hz.kind} ${hz.s}`).toBe(true);
            }
         }
      });
   }

   it("level 1 teaches in three beats: curves first, then a gap and a beam, then the hoard wakes the dragon for a 20 s escape with 2 breaths", () => {
      const c = courseFor(1);
      const firstHazard = Math.min(...c.hazards.filter((h) => h.lane === 0).map((h) => h.s));
      expect(c.segments.filter((g) => g.turn !== 0 && g.s0 < firstHazard).length).toBeGreaterThanOrEqual(3);
      expect(c.hoardS).toBeGreaterThan(firstHazard);
      expect(c.wake).toBeGreaterThanOrEqual(c.hoardS);
      expect(c.breaths.length).toBe(2);
      expect(c.breaths.every((b) => b.s > c.wake)).toBe(true);
      const escapeS = (c.finishS - c.wake) / c.config.speed;
      expect(escapeS).toBeGreaterThan(17);
      expect(escapeS).toBeLessThan(24);
      for (const id of [2, 3, 4, 5] as LevelId[]) expect(courseFor(id).config.speed).toBeGreaterThan(courseFor(1).config.speed);
      expect(courseFor(1).config.speed).toBe(14);
      expect(courseFor(5).config.speed).toBe(22);
   });
});

describe("riding", () => {
   it("the cart runs at the track speed; the right lean on a curve adds 15 %, a wrong lean nothing", () => {
      const c = courseFor(1);
      const curve = c.segments.find((g) => g.turn !== 0)!;
      for (const [lean, want] of [[1, LEAN_BONUS], [-1, 1], [0, 1]] as const) {
         const run = createRun(1, 1);
         run.cart.s = curve.s0 + 2;
         const i = createStepInput();
         const h = c.samples[Math.round(run.cart.s / 0.5) * 4 + 3];
         const inside = curve.turn > 0 ? -1 : 1;
         i.moveX = Math.cos(h) * inside * lean;
         i.moveZ = -Math.sin(h) * inside * lean;
         frames(run, 5, i);
         expect(run.cart.v).toBeCloseTo(c.config.speed * want, 6);
      }
   });

   it("a sharp curve with no lean tips the cart (the warning); the next one without a lean derails it", () => {
      const run = createRun(1, 1);
      const sharp = run.course.segments.filter((g) => g.sharp);
      run.cart.s = sharp[0].s0 - 1;
      run.awake = false;
      let tilted = false;
      for (let i = 0; i < 400 && run.cart.s < sharp[0].s0 + sharp[0].len + 2; i++) if (step(run, 16, createStepInput()).tilted) tilted = true;
      expect(tilted).toBe(true);
      expect(run.cart.tilted).toBe(true);
      expect(run.cart.state).toBe("ride");
      run.cart.s = sharp[1].s0 - 1;
      let lost = false;
      for (let i = 0; i < 400 && !lost; i++) if (step(run, 16, createStepInput()).lost) lost = true;
      expect(lost).toBe(true);
   });

   it("a hop clears a rock; riding into it is a hit (slower, the meter drops); a beam needs a duck", () => {
      const c = courseFor(1);
      const rock = c.hazards.find((h) => h.kind === "rock")!;
      const run = createRun(1, 1);
      run.awake = true;
      run.cart.s = rock.s - 8;
      frames(run, 40);
      expect(run.hits).toBe(1);
      expect(run.meter).toBeLessThan(METER.start - 20);
      const beam = c.hazards.find((h) => h.kind === "beam")!;
      const duck = createRun(1, 1);
      duck.cart.s = beam.s - 6;
      const i = createStepInput();
      i.duck = true;
      frames(duck, 40, i);
      expect(duck.hits).toBe(0);
   });

   it("a gap without a hop is a fall: back at the last lantern, the clock running on", () => {
      const c = courseFor(1);
      const gap = c.hazards.find((h) => h.kind === "gap")!;
      const run = createRun(1, 1);
      run.cart.s = gap.s - 5;
      run.checkpoint = 1;
      frames(run, 120);
      expect(run.respawns).toBe(1);
      expect(run.cart.s).toBeLessThan(gap.s);
      expect(run.cart.s).toBeGreaterThanOrEqual(c.lanterns[1]);
   });

   it("a breath fires a second after it is triggered, at the lane the cart was on: a duck or a lane swap avoids it", () => {
      const c = courseFor(1);
      const br = c.breaths[0];
      for (const duck of [false, true]) {
         const run = createRun(1, 1);
         run.awake = true;
         run.cart.s = br.s - 2;
         run.nextBreath = 0;
         const i = createStepInput();
         i.duck = duck;
         frames(run, Math.ceil(((BREATH.telegraphMs + BREATH.fireMs) / 1000) * 60) + 4, i);
         expect(run.hits, `duck ${duck}`).toBe(duck ? 0 : 1);
      }
   });

   it("the meter creeps down once the dragon is awake; at 0 she catches you (a fall back to the lantern)", () => {
      const run = createRun(1, 2);
      expect(run.awake).toBe(true);
      run.meter = 0.6;
      frames(run, 220);
      expect(run.respawns).toBeGreaterThanOrEqual(1);
      expect(run.meter).toBeGreaterThanOrEqual(METER.respawn - 2);
   });
});

describe("scoring hand-off", () => {
   it("finalScore: a win submits the finish minus 250 ms per orb and the flow bonus; anything else keeps elapsedMs", () => {
      const stats = { [STAT.finishMs]: 50_000, [STAT.orbs]: 10, [STAT.comboMs]: 400 };
      expect(finalScore({ score: 0, endReason: "win", stats, elapsedMs: 51_000 }).durationMs).toBe(50_000 - 10 * ORB.bonusMs - 400);
      expect(finalScore({ score: 0, endReason: "timeup", stats, elapsedMs: 90_000 }).durationMs).toBe(90_000);
   });
});

describe("the lower bound (README 'Server limits')", () => {
   it("the floor is every piece's length over its speed bound (straights at the track speed, curves +15 %), a substep slack each", () => {
      const c = courseFor(1);
      let ms = 0;
      for (const g of c.segments) {
         const hi = Math.min(c.finishS, g.s0 + g.len);
         if (hi <= g.s0) continue;
         ms += ((hi - g.s0) * 1000) / vmaxAt(c, g.s0 + 0.1) - STEP_MS;
      }
      expect(minFinishMs(c)).toBeCloseTo(ms, 6);
   });

   it("level 5: the run in, then Cindermaw's least done time (every window hit at once) or a lap, then the way out", () => {
      const c = courseFor(5);
      const l = c.loop!;
      expect(bossMinMs()).toBeGreaterThan(20_000);
      expect(minFinishMs(c)).toBeCloseTo(travelFloorMs(c, 0, l.s0) + Math.max(travelFloorMs(c, l.s0, l.s1), bossMinMs()) + travelFloorMs(c, l.s1, c.finishS), 6);
   });

   it("the least duration takes off every orb and the most flow bonus", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(minDurationMsOf(c)).toBeCloseTo(minFinishMs(c) - c.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(c)), 6);
      }
   });

   it("every level's minDurationMs sits in 88-100 % of its bound; the limits are pinned", () => {
      for (const id of LEVEL_IDS) {
         const lb = minDurationMsOf(courseFor(id));
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim.minDurationMs).toBeLessThanOrEqual(lb);
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(lb * 0.88);
         expect(lim.maxScore).toBe(Math.floor((lim.timeBaseMs - lim.minDurationMs) / 10));
         expect(lim.timeBaseMs).toBe(LEVELS[id].durationMs);
      }
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].maxDurationMs, PROPOSED_LEVEL_LIMITS[id].timeBaseMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual(PINNED);
      expect(dragonCaveRushMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      for (const id of LEVEL_IDS) expect(dragonCaveRushMeta.levels![id - 1].scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[id]);
   });

   it("every level is worth at least level 1's points, and level 5 at most 3x", () => {
      const l1 = PROPOSED_LEVEL_LIMITS[1].maxScore;
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(l1);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(l1 * 3);
   });
});

/** minDurationMs, maxDurationMs, timeBaseMs, maxScore per level (README table). */
const PINNED = [
   [36400, 90000, 90000, 5360],
   [33300, 110000, 110000, 7670],
   [30600, 120000, 120000, 8940],
   [28300, 130000, 130000, 10170],
   [33900, 180000, 180000, 14610],
];

describe("the speed guard (the proof's one rule)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: 30 s of random input (every hero) never moves the cart further along a substep than its piece's speed bound`, () => {
         for (let k = 0; k < 5; k++) {
            const rng = createRng(id * 31 + k);
            const run = createRun(k, id, HEROES[k].id);
            const input = createStepInput();
            let prev = run.cart.s;
            for (let f = 0; f < 15_000 && run.ended === null; f++) {
               if (f % 30 === 0) {
                  input.moveX = rng() * 2 - 1;
                  input.moveZ = rng() * 2 - 1;
               }
               input.jumpPressed = rng() < 0.02;
               input.duck = rng() < 0.2;
               input.swapLeft = rng() < 0.01;
               input.swapRight = rng() < 0.01;
               input.actionPressed = rng() < 0.01;
               const segBefore = segmentAt(run.course, prev);
               step(run, STEP_MS, input);
               const ds = run.cart.s - prev;
               if (run.cart.state === "ride" && ds > 0) expect(ds).toBeLessThanOrEqual((vmaxAt(run.course, segBefore.s0 + 0.01) * STEP_MS) / 1000 + 1e-9);
               prev = run.cart.s;
            }
         }
      }, 60_000);
   }
});

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot (Riko) wins at 30, 60 and 144 fps with every main orb, never under the floor, at least 85 % of maxScore`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const fps of FPS) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.course));
            const d = submitted(run);
            expect(d).toBeGreaterThanOrEqual(lim.minDurationMs);
            const score = Math.floor((lim.timeBaseMs - d) / 10);
            expect(score, `${fps} fps ${score} / ${lim.maxScore}`).toBeGreaterThanOrEqual(lim.maxScore * 0.85);
            expect(run.mainOrbs, `${fps} fps every main orb`).toBe(run.course.mainOrbs);
         }
      }, 60_000);
   }

   it("idle never wins: the dragon catches the cart again and again, the clock ends it unranked", () => {
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1800 });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(3, 2);
      const input = createStepInput();
      for (let f = 0; f < 20_000 && store.getState().phase !== "over"; f++) {
         advanceRunClock(store, 1 / 60);
         const dt = playedFrameDt(store.getState());
         if (dt <= 0) continue;
         const ev = step(run, dt * 1000, input);
         if (ev.timeup) store.getState().end("timeup");
         if (ev.finished) store.getState().end("win");
      }
      expect(store.getState().endReason).toBe("timeup");
      expect(isRankedRun(dragonCaveRushMeta.scoring, store.getState().endReason)).toBe(false);
   });

   it("60 spam runs per level (random stick, hops, ducks, swaps, power, random frame times, any hero) never beat the floor", () => {
      for (const level of LEVEL_IDS) {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (let seed = 1; seed <= 60; seed++) {
            const rng = createRng(seed * 7919 + level);
            const run = createRun(seed, level, HEROES[seed % 5].id);
            const input = createStepInput();
            for (let f = 0; f < 6000 && run.ended === null; f++) {
               if (f % 10 === 0) {
                  input.moveX = rng() * 2 - 1;
                  input.moveZ = rng() * 2 - 1;
               }
               input.jumpPressed = rng() < 0.3;
               input.duck = rng() < 0.3;
               input.swapLeft = rng() < 0.1;
               input.swapRight = rng() < 0.1;
               input.actionPressed = rng() < 0.2;
               step(run, 4 + rng() * 46, input);
            }
            if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
         }
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
      const rules = dragonCaveRushMeta.scoring;
      const sent = normalizeRun({ slug: "dragon-cave-rush", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-28T00:00:00Z" }, rules);
      expect(isRankedRun(rules, s.endReason)).toBe(true);
      expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
      expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
      expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
   });
});
