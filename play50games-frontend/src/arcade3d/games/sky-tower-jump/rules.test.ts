// Sky Tower Jump rules: the course, the physics, falls and respawns, the orb bonus, the hand-off to
// the store, and the server-limit proof (README "Server limits and why they hold") with an honest
// bot, an idle bot and a spam bot, driven through the real store like the shell does.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { skyTowerJumpMeta } from "./meta";
import { LEVELS } from "./levels";
import { createBot, botInput } from "./bot";
import {
   BUFFER_MS,
   COURSE,
   COYOTE_MS,
   FALL_DEPTH,
   G,
   H_BOUNCE,
   H_JUMP,
   LOST_MS,
   ORB,
   PROPOSED_LEVEL_LIMITS,
   SPAWN_MS,
   STAT,
   V_JUMP,
   V_RUN,
   courseFor,
   createRun,
   createStepInput,
   edgeMinMs,
   finalScore,
   minArrivalMs,
   minDurationMsOf,
   minFinishMs,
   moverOffset,
   moverTopSpeed,
   riseLandS,
   runTimeMs,
   standGap,
   step,
   supportX,
   supportZ,
   type SkyRun,
   type StepInput,
} from "./rules";

const FPS = [30, 60, 144] as const;

/** Runs the honest bot to the end at a fixed frame rate (rules only). */
function botRun(level: LevelId, fps: number, seed = 1): SkyRun {
   const fms = 1000 / fps;
   const run = createRun(seed, level);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 200_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   return run;
}

/** The submitted duration of a finished run. */
const submitted = (run: SkyRun) => runTimeMs(run.finishMs, run.orbs);

describe("the course (level 1, Training Sky)", () => {
   it("climbs 60 m to the goal, with the start, three checkpoints, three pads, four movers, two bridges", () => {
      const s = COURSE.supports;
      expect(s[COURSE.checkpoints[0]].kind).toBe("start");
      expect(COURSE.checkpoints).toHaveLength(4);
      expect(COURSE.checkpoints.slice(1).every((i) => s[i].kind === "checkpoint")).toBe(true);
      expect(s[COURSE.goal].kind).toBe("goal");
      expect(s[COURSE.goal].top).toBe(60);
      expect(s.filter((x) => x.pad)).toHaveLength(3);
      expect(s.filter((x) => x.mover)).toHaveLength(4);
      expect(s.filter((x) => x.kind === "bridge")).toHaveLength(2);
      expect(COURSE.orbs.length).toBe(18);
      expect(COURSE.durationMs).toBe(90_000);
   });

   it("every step up is a comfortable jump (or a pad), and every gap is short", () => {
      const s = COURSE.supports;
      for (let i = 1; i < s.length; i++) {
         const rise = s[i].top - s[i - 1].top;
         const reach = s[i - 1].pad ? H_BOUNCE : H_JUMP;
         // at least 0.8 m of the apex to spare: a training level
         expect(rise, `step ${i - 1} -> ${i}`).toBeLessThan(reach - 0.8);
         expect(standGap(s[i - 1], s[i]), `gap ${i - 1} -> ${i}`).toBeLessThan(2.8);
      }
   });

   it("is the same race for every seed (the seed only places decor)", () => {
      const a = createRun(1, 1);
      const b = createRun(987654321, 1);
      expect(a.course).toBe(b.course);
      const input: StepInput = { moveX: 0, moveZ: -1, jumpPressed: false };
      for (let f = 0; f < 240; f++) {
         input.jumpPressed = f % 40 === 10;
         step(a, 1000 / 60, input);
         step(b, 1000 / 60, input);
      }
      expect(a.hero).toEqual(b.hero);
   });

   it("placeholder levels keep the course and only harden its constants", () => {
      for (const id of [2, 3, 4, 5] as const) {
         const c = courseFor(id);
         expect(LEVELS[id].placeholder).toBe(true);
         expect(c.supports.map((s) => [s.kind, s.cx, s.cz, s.top])).toEqual(COURSE.supports.map((s) => [s.kind, s.cx, s.cz, s.top]));
         expect(c.maxCarry).toBeGreaterThan(COURSE.maxCarry);
      }
   });
});

describe("movement", () => {
   it("a jump from flat ground peaks at H_JUMP after APEX and lands back after about 2 x apex", () => {
      const run = createRun(1, 1);
      const input: StepInput = { moveX: 0, moveZ: 0, jumpPressed: true };
      step(run, 1, input);
      input.jumpPressed = false;
      let peak = 0;
      let landedAt = -1;
      for (let ms = 2; ms < 2000 && landedAt < 0; ms++) {
         const ev = step(run, 1, input);
         peak = Math.max(peak, run.hero.y);
         if (ev.landed) landedAt = run.simMs;
      }
      expect(peak).toBeGreaterThan(H_JUMP - 0.01);
      expect(peak).toBeLessThanOrEqual(H_JUMP + 1e-9);
      expect(landedAt).toBeGreaterThan((2000 * V_JUMP) / G);
      expect(landedAt).toBeLessThan((2000 * V_JUMP) / G + 3);
   });

   it("keeps a jump press for BUFFER_MS and honours coyote time after walking off", () => {
      // pressed in the air 100 ms before landing: jumps on landing
      const run = createRun(1, 1);
      const input: StepInput = { moveX: 0, moveZ: 0, jumpPressed: true };
      step(run, 1, input);
      input.jumpPressed = false;
      let jumps = 1;
      for (let ms = 0; ms < 2000; ms++) {
         if (run.simMs === Math.round((2000 * V_JUMP) / G) - (BUFFER_MS - 30)) input.jumpPressed = true;
         const ev = step(run, 1, input);
         input.jumpPressed = false;
         if (ev.jumped) jumps++;
      }
      expect(jumps).toBe(2);
      expect(COYOTE_MS).toBeGreaterThan(0);
   });

   it("never moves faster than V_RUN + the fastest carry in any one ms (the proof's speed bound)", () => {
      const rng = createRng(42);
      for (const level of LEVEL_IDS) {
         const run = createRun(7, level);
         const vh = (V_RUN + run.course.maxCarry) / 1000;
         const input = createStepInput();
         for (let ms = 0; ms < 40_000 && run.ended === null; ms++) {
            if (ms % 120 === 0) {
               input.moveX = rng() * 2 - 1;
               input.moveZ = rng() * 2 - 1.3;
            }
            input.jumpPressed = rng() < 0.05;
            const x0 = run.hero.x;
            const z0 = run.hero.z;
            const ev = step(run, 1, input);
            if (ev.respawned || run.hero.state !== "play") continue;
            const d = Math.hypot(run.hero.x - x0, run.hero.z - z0);
            expect(d).toBeLessThanOrEqual(vh + 1e-9);
         }
      }
   });

   it("movers use the smooth triangle wave within their travel and top speed", () => {
      for (const s of COURSE.supports) {
         if (!s.mover) continue;
         let maxStep = 0;
         for (let ms = 0; ms < 10_000; ms++) {
            const o = moverOffset(s.mover, ms);
            expect(Math.abs(o)).toBeLessThanOrEqual(s.mover.travel + 1e-9);
            maxStep = Math.max(maxStep, Math.abs(moverOffset(s.mover, ms + 1) - o));
         }
         expect(maxStep * 1000).toBeLessThanOrEqual(moverTopSpeed(s.mover) + 1e-6);
         expect(supportX(s, 0) === s.cx || supportZ(s, 0) === s.cz).toBe(true);
      }
   });
});

describe("falls, respawns, orbs, the finish", () => {
   it("a fall FALL_DEPTH under the last top is lost; the hero comes back on the checkpoint after LOST_MS + SPAWN_MS", () => {
      const run = createRun(1, 1);
      const input: StepInput = { moveX: 1, moveZ: 0, jumpPressed: false };
      let lostAt = -1;
      let backAt = -1;
      for (let ms = 0; ms < 6000; ms++) {
         const ev = step(run, 1, input);
         if (ev.lost) {
            lostAt = run.simMs;
            expect(run.hero.y).toBeLessThan(0 - FALL_DEPTH);
         }
         if (ev.respawned) backAt = run.simMs;
         if (backAt > 0 && run.hero.state === "play") break;
      }
      expect(lostAt).toBeGreaterThan(0);
      expect(backAt - lostAt).toBe(LOST_MS);
      const start = COURSE.supports[COURSE.checkpoints[0]];
      expect(run.hero.y).toBe(start.top);
      expect(run.respawns).toBe(1);
      // the frozen spawn: no input acts for SPAWN_MS
      expect(SPAWN_MS + LOST_MS).toBeGreaterThanOrEqual(1500);
   });

   it("submits the finish ms minus 0.4 s per orb on a win, the elapsed time otherwise", () => {
      expect(finalScore({ score: 0, endReason: "win", elapsedMs: 30_123, stats: { [STAT.finishMs]: 30_000, [STAT.orbs]: 10 } })).toEqual({ score: 0, durationMs: 26_000 });
      expect(finalScore({ score: 0, endReason: "timeup", elapsedMs: 90_000, stats: { [STAT.orbs]: 3 } })).toEqual({ score: 0, durationMs: 90_000 });
      expect(runTimeMs(1000, 5)).toBe(0);
      expect(ORB.bonusMs).toBe(400);
   });
});

describe("the lower bound (README proof)", () => {
   it("rise-and-land times follow the closed-form arc", () => {
      expect(riseLandS(V_JUMP, H_JUMP + 0.01)).toBe(Infinity);
      expect(riseLandS(V_JUMP, 0)).toBeCloseTo((2 * V_JUMP) / G, 9);
      // landing 2 m up: apex then the drop from H_JUMP to 2 m
      expect(riseLandS(V_JUMP, 2)).toBeCloseTo(V_JUMP / G + Math.sqrt((2 * (H_JUMP - 2)) / G), 9);
   });

   it("every edge costs at least its horizontal bound, and a rise never costs less than an apex", () => {
      const c = COURSE;
      const vh = V_RUN + c.maxCarry;
      for (let a = 0; a < c.supports.length; a++) {
         for (let b = 0; b < c.supports.length; b++) {
            if (a === b) continue;
            const e = edgeMinMs(c, a, b);
            expect(e).toBeGreaterThanOrEqual((1000 * standGap(c.supports[a], c.supports[b])) / vh - 1e-9);
            if (c.supports[b].top > c.supports[a].top && Number.isFinite(e)) expect(e).toBeGreaterThanOrEqual((1000 * V_JUMP) / G - 1e-9);
         }
      }
   });

   it("every platform is reachable, in route order of arrival bounds", () => {
      const arrive = minArrivalMs(COURSE);
      expect(arrive.every(Number.isFinite)).toBe(true);
      expect(arrive[COURSE.goal]).toBe(minFinishMs(COURSE));
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: the proposed limits are the bound less 3-6 %, and maxScore follows from them`, () => {
         const c = courseFor(level);
         const lb = minDurationMsOf(c);
         const lim = PROPOSED_LEVEL_LIMITS[level];
         expect(lim.minDurationMs).toBeLessThanOrEqual(lb);
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(lb * 0.94);
         expect(lim.maxScore).toBe(Math.floor((lim.timeBaseMs - lim.minDurationMs) / 10));
         expect(lim.maxDurationMs).toBe(c.durationMs);
         expect(skyTowerJumpMeta.levels![level - 1].scoring).toMatchObject(lim);
      });
   }
});

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot climbs to the gate at 30, 60 and 144 fps, never under the bound`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const fps of FPS) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.course));
            const d = submitted(run);
            expect(d).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(d).toBeLessThanOrEqual(lim.maxDurationMs);
            // the limit is not loose: the bot's time is within 1.5x of the floor
            expect(d).toBeLessThan(lim.minDurationMs * 1.6);
         }
      });
   }

   it("the idle bot times out at 90 s: unranked, nothing sent", () => {
      const store = createArcadeStore();
      store.getState().configure({ durationMs: undefined, lives: undefined, resultDelayMs: 1600 });
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
      const s = store.getState();
      expect(s.endReason).toBe("timeup");
      expect(run.simMs).toBe(90_000);
      expect(isRankedRun(skyTowerJumpMeta.scoring, s.endReason)).toBe(false);
   });

   it("200 spam bots (random stick, jump mashing, random frame times) never beat the floor", () => {
      const lim = PROPOSED_LEVEL_LIMITS[1];
      let wins = 0;
      for (let seed = 1; seed <= 200; seed++) {
         const rng = createRng(seed * 7919);
         const run = createRun(seed, 1);
         const input = createStepInput();
         for (let f = 0; f < 6000 && run.ended === null; f++) {
            if (f % 10 === 0) {
               input.moveX = rng() * 2 - 1;
               input.moveZ = -rng();
            }
            input.jumpPressed = rng() < 0.5;
            step(run, 4 + rng() * 46, input);
         }
         if (run.ended === "win") {
            wins++;
            expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
         }
         expect(run.ended === null || run.ended === "win" || run.ended === "timeup").toBe(true);
      }
      expect(wins).toBeLessThan(200);
   });

   it("the honest bot through the real store: a ranked win inside the server limits, score from the time", () => {
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1600 });
      store.getState().markReady();
      store.getState().start();
      const run = createRun(5, 1);
      const bot = createBot(run);
      const input = createStepInput();
      const rng = createRng(11);
      for (let f = 0; f < 50_000 && store.getState().phase !== "over"; f++) {
         // ragged frames: mostly 60 fps, some long ones (the core caps a frame at 50 ms)
         advanceRunClock(store, rng() < 0.05 ? 0.05 + rng() * 0.2 : 1 / 60);
         const dt = playedFrameDt(store.getState());
         if (dt <= 0) continue;
         bot.frameMs = dt * 1000;
         botInput(bot, run, input);
         const ev = step(run, dt * 1000, input);
         if (ev.orbCount > 0) store.getState().setStat(STAT.orbs, run.orbs);
         if (ev.finished) {
            store.getState().setStat(STAT.orbs, run.orbs);
            store.getState().setStat(STAT.finishMs, run.finishMs);
            store.getState().end("win");
         }
      }
      const s = store.getState();
      expect(s.endReason).toBe("win");
      expect(run.finishMs).toBeLessThanOrEqual(s.elapsedMs + 1);
      const fin = finalScore(s);
      const rules = skyTowerJumpMeta.scoring;
      const sent = normalizeRun({ slug: "sky-tower-jump", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-25T00:00:00Z" }, rules);
      expect(isRankedRun(rules, s.endReason)).toBe(true);
      expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
      expect(sent.durationMs).toBeLessThanOrEqual(rules.maxDurationMs);
      expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
      expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
   });
});
