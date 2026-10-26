// Lava Pillar Jump rules: the roofs, the physics, falls and respawns, the coin bonus, the hand-off
// to the store, and the server-limit proof (README "Server limits and why they hold") with an honest
// bot, an idle bot and a spam bot, driven through the real store like the shell does.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { lavaPillarJumpMeta } from "./meta";
import { LEVELS } from "./levels";
import { POWER_MS, V_DASH, heroById } from "./heroes";
import { createBot, botInput } from "./bot";
import {
   BUFFER_MS,
   COURSE,
   COYOTE_MS,
   FALL_DEPTH,
   FOOT,
   G,
   H_JUMP,
   LEVEL1_LIMITS,
   LOST_MS,
   ORB,
   PROPOSED_LEVEL_LIMITS,
   SPAWN_MS,
   STAT,
   V_JUMP,
   V_RUN,
   courseFor,
   createRun,
   lavaY,
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
   type LavaRun,
   type StepInput,
} from "./rules";

const FPS = [30, 60, 144] as const;

const botCache = new Map<string, LavaRun>();

/** Runs the honest bot to the end at a fixed frame rate (rules only). Cached: the proof reads each run once. */
function botRun(level: LevelId, fps: number, seed = 1): LavaRun {
   const key = `${level}:${fps}:${seed}`;
   const hit = botCache.get(key);
   if (hit) return hit;
   const fms = 1000 / fps;
   const run = createRun(seed, level);
   const bot = createBot(run, fms);
   const input = createStepInput();
   for (let f = 0; f < 400_000 && run.ended === null; f++) {
      botInput(bot, run, input);
      step(run, fms, input);
   }
   botCache.set(key, run);
   return run;
}

/** The submitted duration of a finished run. */
const submitted = (run: LavaRun) => runTimeMs(run.finishMs, run.orbs);

describe("the pillars", () => {
   it("level 1 is Warm Cavern: 10 landings, 8 rising sections, no movers, wide and safe, lava under the start", () => {
      const s = COURSE.supports;
      expect(s).toHaveLength(10);
      expect(s[0].kind).toBe("start");
      expect(s[COURSE.goal].kind).toBe("goal");
      expect(s[COURSE.goal].top).toBe(16);
      expect(s.filter((x) => x.top > s[Math.max(0, s.indexOf(x) - 1)].top).length).toBeGreaterThanOrEqual(8);
      expect(s.filter((x) => x.mover)).toHaveLength(0);
      expect(s.filter((x) => x.vanish)).toHaveLength(0);
      expect(s.filter((x) => x.slippery)).toHaveLength(0);
      expect(COURSE.wind).toBe(false);
      expect(COURSE.strikes).toHaveLength(0);
      expect(COURSE.durationMs).toBe(90_000);
      expect(s[0].hw).toBeGreaterThanOrEqual(3);
      expect(COURSE.lava0).toBe(-4.5);
      expect(COURSE.lavaRate).toBeGreaterThan(0);
      expect(s.every((x) => !x.collapse)).toBe(true);
   });

   it("is the same race for every seed (the seed only places decor)", () => {
      const a = createRun(1, 1);
      const b = createRun(987654321, 1);
      expect(a.course).toBe(b.course);
      const input: StepInput = { moveX: 0, moveZ: -1, jumpPressed: false, actionPressed: false };
      for (let f = 0; f < 240; f++) {
         input.jumpPressed = f % 40 === 10;
         step(a, 1000 / 60, input);
         step(b, 1000 / 60, input);
      }
      expect(a.hero).toEqual(b.hero);
   });

   it("levels match the plan: surface counts, climb counts, and the hazards each one adds", () => {
      const expectLevel = {
         1: { surfaces: 10, rises: 8, movers: false, vanish: false, ice: false, wind: false, sparks: false, collapse: false },
         2: { surfaces: 14, rises: 12, movers: true, vanish: false, ice: false, wind: false, sparks: false, collapse: false },
         3: { surfaces: 18, rises: 16, movers: true, vanish: true, ice: true, wind: false, sparks: true, collapse: true },
         4: { surfaces: 22, rises: 20, movers: true, vanish: true, ice: false, wind: true, sparks: true, collapse: true },
         5: { surfaces: 28, rises: 25, movers: true, vanish: true, ice: true, wind: true, sparks: true, collapse: true },
      } as const;
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const spec = expectLevel[id];
         expect(c.supports, `L${id} surfaces`).toHaveLength(spec.surfaces);
         expect(c.supports[c.goal].top).toBe(LEVELS[id].spec.goalTop);
         expect(c.durationMs).toBe(LEVELS[id].durationMs);
         const rises = c.supports.filter((s, i) => i > 0 && s.top > c.supports[i - 1].top).length;
         expect(rises, `L${id} rises`).toBe(spec.rises);
         expect(c.supports.some((s) => s.mover)).toBe(spec.movers);
         expect(c.supports.some((s) => s.vanish)).toBe(spec.vanish);
         expect(c.supports.some((s) => s.slippery)).toBe(spec.ice);
         expect(c.wind).toBe(spec.wind);
         expect(c.strikes.length > 0).toBe(spec.sparks);
         expect(c.supports.some((s) => s.collapse), `L${id} collapse`).toBe(spec.collapse);
         expect(c.lava0).toBe(-4.5);
         expect(c.lavaRate).toBe(LEVELS[id].spec.lavaRate);
         expect(createRun(1, id).course).toBe(createRun(99, id).course);
      }
      expect(courseFor(3).supports.filter((s) => s.mover).length).toBeGreaterThan(courseFor(2).supports.filter((s) => s.mover).length);
      expect(courseFor(5).supports.length).toBeGreaterThan(courseFor(4).supports.length);
   });

   it("every step up is a jump with room under the apex, and every gap is landable", () => {
      for (const id of LEVEL_IDS) {
         const s = courseFor(id).supports;
         for (let i = 1; i < s.length; i++) {
            const rise = s[i].top - s[i - 1].top;
            expect(rise, `L${id} rise ${i}`).toBeGreaterThanOrEqual(0);
            expect(rise, `L${id} rise ${i}`).toBeLessThan(H_JUMP - 0.6);
            const dx = Math.max(0, Math.abs(s[i].cx - s[i - 1].cx) - s[i].hw - s[i - 1].hw - 2 * FOOT);
            const dz = Math.max(0, Math.abs(s[i].cz - s[i - 1].cz) - s[i].hd - s[i - 1].hd - 2 * FOOT);
            expect(Math.hypot(dx, dz), `L${id} gap ${i}`).toBeLessThan(3.2);
         }
      }
   });
});

describe("movement", () => {
   it("a jump from flat ground peaks at H_JUMP after APEX and lands back after about 2 x apex", () => {
      const run = createRun(1, 1);
      const input: StepInput = { moveX: 0, moveZ: 0, jumpPressed: true, actionPressed: false };
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
      const input: StepInput = { moveX: 0, moveZ: 0, jumpPressed: true, actionPressed: false };
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
      const input: StepInput = { moveX: 1, moveZ: 0, jumpPressed: false, actionPressed: false };
      let lostAt = -1;
      let backAt = -1;
      for (let ms = 0; ms < 6000; ms++) {
         const ev = step(run, 1, input);
         if (ev.lost) {
            lostAt = run.simMs;
            // lost at the fall line, or sooner where the rising lava is higher than it (lava0 is only 4.5 m under the start)
            expect(run.hero.y).toBeLessThanOrEqual(Math.max(0 - FALL_DEPTH, lavaY(COURSE, run.simMs)) + 0.05);
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
      it(`level ${level}: the proposed limits sit under the bound, at least 90 % of it, and maxScore follows from them`, () => {
         const c = courseFor(level);
         const lb = minDurationMsOf(c);
         const lim = PROPOSED_LEVEL_LIMITS[level];
         expect(Number.isFinite(lb), `level ${level} reachable`).toBe(true);
         expect(Number.isFinite(lim.maxScore)).toBe(true);
         expect(lim.minDurationMs).toBeLessThanOrEqual(lb);
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(lb * 0.9);
         expect(lim.maxScore).toBe(Math.floor((lim.timeBaseMs - lim.minDurationMs) / 10));
         expect(lim.maxDurationMs).toBe(c.durationMs);
         expect(lim.timeBaseMs).toBe(c.durationMs);
         // meta (and arcade-games.json, registry.sync.test.ts) ship exactly these limits on this level
         expect(lavaPillarJumpMeta.levels![level - 1].scoring).toMatchObject(lim);
         if (level === 1) expect(lim).toEqual(LEVEL1_LIMITS);
      });
   }

   it("a dash does not pull level 1's least finish under the shipped floor", () => {
      const dashed = minFinishMs(COURSE, V_DASH) - COURSE.orbs.length * ORB.bonusMs;
      expect(dashed).toBeGreaterThanOrEqual(LEVEL1_LIMITS.minDurationMs);
   });

   for (const level of LEVEL_IDS) {
      it(`level ${level}: Riko's dashes cannot pull the least finish under the shipped floor`, () => {
         // A dash is on for at most POWER_MS.dash + 1 rules ms (dashUntil is inclusive) at V_DASH instead of V_RUN,
         // so it adds at most that many ms × (V_DASH - V_RUN) of horizontal travel. Every edge bound is
         // max(flat, vertical) with flat = distance / (V_RUN + carry), so the extra travel saves at most
         // extra / V_RUN of the summed bound. A run that finishes at T fired at most 1 + floor(T / cooldown) dashes.
         const c = courseFor(level);
         const F = minFinishMs(c);
         const perDash = ((POWER_MS.dash + 1) * (V_DASH - V_RUN)) / V_RUN;
         const cooldown = heroById("riko").cooldownMs;
         let T = 0;
         // the least T with T + perDash · dashes(T) >= F
         while (T + perDash * (1 + Math.floor(T / cooldown)) < F) T += 1;
         const floor = T - c.orbs.length * ORB.bonusMs;
         expect(floor, `level ${level} dashed floor ${floor} vs min ${PROPOSED_LEVEL_LIMITS[level].minDurationMs}`).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[level].minDurationMs);
      });
   }

   it("pins the shipped per-level limits (meta.ts and arcade-games.json repeat them)", () => {
      const rows = LEVEL_IDS.map((id) => {
         const l = PROPOSED_LEVEL_LIMITS[id];
         return [l.minDurationMs, l.maxDurationMs, l.timeBaseMs, l.maxScore];
      });
      expect(rows).toEqual([
         [4100, 90000, 90000, 8590],
         [4800, 120000, 120000, 11520],
         [8500, 150000, 150000, 14150],
         [10600, 180000, 180000, 16940],
         [11600, 210000, 210000, 19840],
      ]);
   });

   it("every proposed level is worth at least level 1's points, and level 5 is at most about 3x", () => {
      const l1 = PROPOSED_LEVEL_LIMITS[1].maxScore;
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(l1);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(Math.round(l1 * 3));
   });
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
            // the limit is not loose: the bot's time is within 2.2x of the floor (a sweeping route costs more than a straight climb)
            expect(d, `${fps} fps submitted ${d} vs 2.2x ${lim.minDurationMs}`).toBeLessThan(lim.minDurationMs * 2.2);
         }
      });
   }

   it("the honest bot's points: each level at least level 1, a clear is at least 90% of that level's max, level 5 at most about 3x", () => {
      const points = (id: LevelId) => {
         const run = botRun(id, 60);
         expect(run.ended, `level ${id}`).toBe("win");
         return Math.floor((PROPOSED_LEVEL_LIMITS[id].timeBaseMs - submitted(run)) / 10);
      };
      const first = points(1);
      let last = first;
      for (const id of LEVEL_IDS) {
         const score = id === 1 ? first : points(id);
         last = score;
         expect(score, `level ${id} score ${score} / max ${PROPOSED_LEVEL_LIMITS[id].maxScore}`).toBeGreaterThanOrEqual(first);
         expect(score, `level ${id} score ${score} / max ${PROPOSED_LEVEL_LIMITS[id].maxScore}`).toBeGreaterThanOrEqual(Math.floor(PROPOSED_LEVEL_LIMITS[id].maxScore * 0.9));
      }
      expect(last).toBeLessThanOrEqual(first * 3.05);
   });

   it("the idle hero is swallowed by the lava before the clock: unranked, nothing sent", () => {
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
         if (ev.lava) store.getState().end("lose");
         if (ev.timeup) store.getState().end("timeup");
      }
      const s = store.getState();
      expect(s.endReason).toBe("lose");
      expect(run.ended).toBe("lose");
      expect(run.simMs).toBeLessThan(90_000);
      expect(run.simMs).toBeGreaterThan(20_000);
      expect(isRankedRun(lavaPillarJumpMeta.scoring, s.endReason)).toBe(false);
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
         expect(run.ended === null || run.ended === "win" || run.ended === "timeup" || run.ended === "lose").toBe(true);
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
      const rules = lavaPillarJumpMeta.scoring;
      const sent = normalizeRun({ slug: "lava-pillar-jump", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-25T00:00:00Z" }, rules);
      expect(isRankedRun(rules, s.endReason)).toBe(true);
      expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
      expect(sent.durationMs).toBeLessThanOrEqual(rules.maxDurationMs);
      expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
      expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
   });
});
