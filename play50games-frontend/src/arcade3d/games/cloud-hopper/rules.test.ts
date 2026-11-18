// Cloud Hopper rules: the cloud sea, the glide, sinking clouds, feathers, rings, wind, falls and
// respawns, the hand-off to the store, and the server-limit proof (README "Server limits and why they
// hold"): the z guard on every ms, the pinned limits, the dash floor, and an honest, an idle and a
// spam bot, driven through the real store like the shell does.
import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { computeTimeScore, isRankedRun, normalizeRun } from "@/arcade3d/core/scores";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { createRng } from "@/arcade3d/core/math";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { cloudHopperMeta } from "./meta";
import { LEVELS } from "./levels";
import { HEROES, POWER_MS, V_DASH, heroById } from "./heroes";
import { createBot, botInput } from "./bot";
import {
   CENTRE_R,
   COURSE,
   FEATHER,
   GLIDE_FALL,
   GLIDE_MAX_MS,
   H_JUMP,
   LEVEL1_LIMITS,
   LOST_MS,
   ORB,
   PROPOSED_LEVEL_LIMITS,
   SPAWN_MS,
   STAT,
   V_GLIDE,
   V_JUMP,
   V_RUN,
   bossMinMs,
   boundPieces,
   cloudTop,
   comboSpecOf,
   courseFor,
   createRun,
   createStepInput,
   dashFloorMs,
   finalScore,
   minDurationMsOf,
   minFinishMs,
   progressFloorMs,
   runTimeMs,
   solidBoxes,
   courseBoxes,
   step,
   vmaxZ,
   type CloudRun,
   type SolidBox,
   type StepInput,
} from "./rules";

const FPS = [30, 60, 144] as const;
const botCache = new Map<string, CloudRun>();

function botRun(level: LevelId, fps: number, seed = 1): CloudRun {
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

const submitted = (run: CloudRun) => runTimeMs(run.finishMs, run.orbs, run.combo.bonusTotal);

function hold(run: CloudRun, ms: number, input: StepInput): void {
   let left = ms;
   while (left > 0 && run.ended === null) {
      const d = Math.min(16, left);
      step(run, d, input);
      left -= d;
   }
}

/** Puts the hero on route cloud `k` (its centre), at rest. */
function standOn(run: CloudRun, k: number): void {
   const i = run.course.route[k];
   const c = run.course.clouds[i];
   Object.assign(run.hero, { x: c.cx, y: c.top, z: c.cz, vx: 0, vz: 0, grounded: true, support: i, lastTop: c.top, gliding: false });
}

describe("the cloud sea (a horizontal run, not a climb)", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: runs ${LEVELS[id].length} m along -z with little height, start and bridge on the route, anchors at most 75 m apart (centre to centre)`, () => {
         const c = courseFor(id);
         const start = c.clouds[c.route[0]];
         const goal = c.clouds[c.goal];
         expect(start.kind).toBe("start");
         expect(goal.kind).toBe("goal");
         expect(c.route[c.route.length - 1]).toBe(c.goal);
         expect(-goal.cz).toBeGreaterThan(LEVELS[id].length - 16);
         expect(-goal.cz).toBeLessThan(LEVELS[id].length + 16);
         let lo = Infinity;
         let hi = -Infinity;
         for (const k of c.route) {
            lo = Math.min(lo, c.clouds[k].top);
            hi = Math.max(hi, c.clouds[k].top);
         }
         expect(hi - lo, "height span").toBeLessThan(9);
         // the route only goes forward, cloud after cloud
         for (let k = 1; k < c.route.length; k++) expect(c.clouds[c.route[k]].cz).toBeLessThan(c.clouds[c.route[k - 1]].cz);
         // solid anchors (checkpoints) along the way, never a sinking cloud
         let last = start.cz;
         for (const i of c.checkpoints.slice(1)) {
            const a = c.clouds[i];
            expect(a.kind).toBe("anchor");
            expect(a.sinks).toBe(false);
            expect(last - a.cz).toBeLessThanOrEqual(75);
            last = a.cz;
         }
         expect(last - goal.cz).toBeLessThanOrEqual(80);
      });
   }

   it("level 1 teaches in three beats: big clouds 2 m apart, then a feather before a 10 m gap, then a ring a glide reaches", () => {
      const c = COURSE;
      const r = c.route.map((i) => c.clouds[i]);
      for (let k = 1; k <= 3; k++) {
         expect(r[k].hw * 2).toBe(5);
         expect(r[k - 1].cz - r[k - 1].hd - (r[k].cz + r[k].hd)).toBeCloseTo(k === 1 ? 2 : 2, 6);
      }
      const gap = r[3].cz - r[3].hd - (r[4].cz + r[4].hd);
      expect(gap).toBeCloseTo(10, 6);
      expect(c.feathers.some((f) => Math.abs(f.z - r[3].cz) <= r[3].hd)).toBe(true);
      const wind = c.rings.filter((x) => x.kind === "wind");
      expect(wind.length).toBeGreaterThanOrEqual(1);
      expect(c.level).toBe(1);
      // L1's risk fix: soft clouds sink at 0.3 m/s and hold 5 s
      expect(LEVELS[1].sinkMps).toBe(0.3);
      expect(LEVELS[1].burstMs).toBe(5000);
   });

   it("the same level is the same race for every seed", () => {
      const a = createRun(1, 3);
      const b = createRun(999, 3);
      expect(a.course).toBe(b.course);
      const input = createStepInput();
      input.moveZ = -1;
      hold(a, 3000, input);
      hold(b, 3000, input);
      expect([a.hero.x, a.hero.y, a.hero.z]).toEqual([b.hero.x, b.hero.y, b.hero.z]);
   });
});

describe("hop, glide, sink", () => {
   it("a jump peaks at H_JUMP; holding Jump past the apex glides at V_GLIDE forward and GLIDE_FALL down, draining the meter 1 ms a ms", () => {
      const run = createRun(1, 1);
      run.hero.glideMs = 3000;
      const input = createStepInput();
      input.jumpPressed = true;
      step(run, 1, input);
      input.jumpPressed = false;
      let peak = 0;
      for (let t = 0; t < 420; t++) {
         step(run, 1, input);
         peak = Math.max(peak, run.hero.y);
      }
      expect(peak).toBeGreaterThan(H_JUMP - 0.05);
      expect(peak).toBeLessThanOrEqual(H_JUMP + 1e-9);
      input.jumpHeld = true;
      input.moveZ = -1;
      hold(run, 120, input);
      expect(run.hero.gliding).toBe(true);
      const y0 = run.hero.y;
      const z0 = run.hero.z;
      const g0 = run.hero.glideMs;
      hold(run, 1000, input);
      expect(run.hero.gliding).toBe(true);
      expect(y0 - run.hero.y).toBeCloseTo(GLIDE_FALL, 2);
      expect(g0 - run.hero.glideMs).toBe(1000);
      // eased up to the glide speed, never past it
      expect(z0 - run.hero.z).toBeLessThanOrEqual(V_GLIDE + 1e-9);
      expect(z0 - run.hero.z).toBeGreaterThan(V_GLIDE * 0.85);
      // letting go ends the glide
      input.jumpHeld = false;
      step(run, 16, input);
      expect(run.hero.gliding).toBe(false);
   });

   it("no glide without feathers; a feather adds 1.5 s, the meter caps at 4.5 s, and a taken feather comes back after 4 s", () => {
      const run = createRun(1, 1);
      expect(run.hero.glideMs).toBe(0);
      const f = run.course.feathers[0];
      Object.assign(run.hero, { x: f.x, z: f.z, y: f.y - ORB.centerY });
      step(run, 1, createStepInput());
      expect(run.hero.glideMs).toBe(FEATHER.glideMs);
      for (let k = 0; k < 4; k++) {
         run.featherAt[0] = -1;
         step(run, 1, createStepInput());
      }
      expect(run.hero.glideMs).toBe(GLIDE_MAX_MS);
      const at = run.featherAt[0];
      expect(at).toBeGreaterThan(0);
      run.hero.glideMs = 0;
      hold(run, FEATHER.respawnMs - 100, createStepInput());
      expect(run.featherAt[0]).toBe(at);
   });

   it("a cloud sinks once you land on it, bursts after burstMs and re-forms; anchors never sink", () => {
      const c = courseFor(2);
      const k = c.route.findIndex((i) => c.clouds[i].sinks);
      const i = c.route[k];
      const run = createRun(1, 2);
      run.landAt[i] = 1000;
      const cl = c.clouds[i];
      expect(cloudTop(run, i, 1000)).toBe(cl.top);
      expect(cloudTop(run, i, 2000)).toBeCloseTo(cl.top - LEVELS[2].sinkMps, 9);
      expect(Number.isNaN(cloudTop(run, i, 1000 + LEVELS[2].burstMs))).toBe(true);
      expect(cloudTop(run, i, 1000 + LEVELS[2].burstMs + LEVELS[2].reformMs)).toBe(cl.top);
      for (const a of c.checkpoints) expect(c.clouds[a].sinks).toBe(false);
   });

   it("standing on a sinking cloud carries you down with it and drops you when it bursts", () => {
      const run = createRun(1, 2);
      const k = run.course.route.findIndex((i) => run.course.clouds[i].sinks && !run.course.clouds[i].drift);
      standOn(run, k);
      const i = run.course.route[k];
      run.landAt[i] = 1;
      hold(run, 1500, createStepInput());
      expect(run.hero.grounded).toBe(true);
      expect(run.hero.y).toBeLessThan(run.course.clouds[i].top - 0.5);
      hold(run, LEVELS[2].burstMs, createStepInput());
      expect(run.hero.grounded && run.hero.support === i).toBe(false);
   });

   it("a first landing on the bright centre adds a streak point; off-centre breaks it", () => {
      const run = createRun(1, 1);
      const a = run.course.clouds[run.course.route[1]];
      Object.assign(run.hero, { x: a.cx, z: a.cz, y: a.top + 0.5, grounded: false, support: -1, arcStart: 0, arcY0: a.top + 0.5, arcV: 0 });
      hold(run, 400, createStepInput());
      expect(run.events.landed || run.hero.grounded).toBe(true);
      expect(run.streak).toBe(1);
      const b = run.course.clouds[run.course.route[2]];
      Object.assign(run.hero, { x: b.cx + CENTRE_R + 0.6, z: b.cz, y: b.top + 0.5, grounded: false, support: -1, arcStart: run.simMs, arcY0: b.top + 0.5, arcV: 0 });
      hold(run, 400, createStepInput());
      expect(run.streak).toBe(0);
      expect(run.bestStreak).toBe(1);
   });
});

describe("wind and the z guard (the proof's one rule)", () => {
   it("level 3's bands: a tail wind doubles a glide, a head wind halves it; vmaxZ is the most any state reaches", () => {
      const c = courseFor(3);
      const tail = c.bands.find((b) => b.wz < 0)!;
      const head = c.bands.find((b) => b.wz > 0)!;
      expect(V_GLIDE - tail.wz).toBeCloseTo(2 * V_GLIDE, 9);
      expect(V_GLIDE - head.wz).toBeCloseTo(V_GLIDE / 2, 9);
      expect(vmaxZ(c, (tail.z0 + tail.z1) / 2)).toBe(2 * V_GLIDE);
      expect(vmaxZ(c, (head.z0 + head.z1) / 2)).toBe(V_RUN);
      expect(c.bands.some((b) => b.wx !== 0 && b.wz === 0)).toBe(true);
      for (const id of [1, 2, 4] as const) expect(courseFor(id).bands).toHaveLength(0);
      // a glider in the tail band really gets twice as far
      const run = createRun(1, 3);
      Object.assign(run.hero, { x: 0, y: 30, z: (tail.z0 + tail.z1) / 2 + 6, grounded: false, support: -1, glideMs: 4000, arcStart: 0, arcY0: 30, arcV: 0, lastTop: 30 });
      const input = createStepInput();
      input.jumpHeld = true;
      input.moveZ = -1;
      hold(run, 600, input);
      const z0 = run.hero.z;
      hold(run, 500, input);
      expect(z0 - run.hero.z).toBeGreaterThan(V_GLIDE * 0.5 * 1.7);
   });

   it("on every level, 30 s of random input never moves the hero further towards -z in one ms than vmaxZ (V_DASH in a dash)", () => {
      for (const id of LEVEL_IDS) {
         for (const hero of HEROES) {
            const rng = createRng(id * 31 + hero.id.length);
            const run = createRun(2, id, hero.id);
            run.hero.glideMs = GLIDE_MAX_MS;
            const input = createStepInput();
            for (let ms = 0; ms < 30_000 && run.ended === null; ms++) {
               if (ms % 50 === 0) {
                  input.moveX = rng() * 2 - 1;
                  input.moveZ = rng() * 2 - 1.4;
                  input.jumpHeld = rng() < 0.7;
               }
               input.jumpPressed = rng() < 0.05;
               input.actionPressed = rng() < 0.02;
               const z0 = run.hero.z;
               const dashing = run.hero.dashUntil >= run.simMs + 1;
               const cap = Math.max(vmaxZ(run.course, z0), V_DASH) / 1000;
               step(run, 1, input);
               if (run.events.respawned) continue;
               expect(z0 - run.hero.z, `L${id} ${hero.id} ms ${ms}${dashing ? " dash" : ""}`).toBeLessThanOrEqual(cap + 1e-9);
            }
         }
      }
   });
});

describe("falls and respawns", () => {
   it("a fall below the fall line is lost for LOST_MS, then SPAWN_MS on the anchor; the clouds re-form and the meter keeps at least 1.5 s", () => {
      const run = createRun(1, 1);
      Object.assign(run.hero, { x: 40, grounded: false, support: -1, arcStart: 0, arcY0: 0, arcV: 0 });
      run.landAt[3] = 10;
      let lostAt = -1;
      let spawnAt = -1;
      for (let ms = 0; ms < 5000 && spawnAt < 0; ms++) {
         step(run, 1, createStepInput());
         if (run.events.lost) lostAt = run.simMs;
         if (run.events.respawned) spawnAt = run.simMs;
      }
      expect(lostAt).toBeGreaterThan(0);
      expect(spawnAt - lostAt).toBe(LOST_MS);
      expect(run.hits).toBe(1);
      expect(run.landAt[3]).toBe(-1);
      expect(run.hero.glideMs).toBeGreaterThanOrEqual(1500);
      hold(run, SPAWN_MS - 1, createStepInput());
      expect(run.hero.state).toBe("spawn");
      step(run, 2, createStepInput());
      expect(run.hero.state).toBe("play");
   });
});

describe("scoring hand-off", () => {
   it("finalScore: a win submits the finish minus 400 ms per orb and the flow bonus; anything else keeps elapsedMs", () => {
      const stats = { [STAT.finishMs]: 40_000, [STAT.orbs]: 10, [STAT.comboMs]: 500 };
      expect(finalScore({ score: 0, endReason: "win", stats, elapsedMs: 41_000 }).durationMs).toBe(40_000 - 4000 - 500);
      expect(finalScore({ score: 0, endReason: "timeup", stats, elapsedMs: 41_000 }).durationMs).toBe(41_000);
      expect(runTimeMs(1000, 10)).toBe(0);
   });
});

describe("the lower bound (README 'Server limits')", () => {
   it("the z floor is the band pieces' lengths over their speeds, less 4 ms a piece", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const pieces = boundPieces(c);
         let sum = 0;
         for (const p of pieces) sum += ((p.from - p.to) * 1000) / p.v - 4;
         expect(progressFloorMs(c)).toBeCloseTo(sum, 6);
         const len = pieces.reduce((a, p) => a + p.from - p.to, 0);
         expect(len).toBeCloseTo(c.startZ - c.goalNearZ, 6);
      }
      // no wind: the whole run at the glide's 7 m/s
      expect(progressFloorMs(COURSE)).toBeCloseTo(((COURSE.startZ - COURSE.goalNearZ) * 1000) / V_GLIDE - 4, 6);
   });

   it("level 5 adds Gloom Nimbus's least defeat time (every window hit at once) as a floor", () => {
      const c = courseFor(5);
      expect(c.boss).toBe(true);
      expect(bossMinMs()).toBeGreaterThan(10_000);
      expect(minFinishMs(c)).toBe(Math.max(progressFloorMs(c), bossMinMs()));
      for (const id of [1, 2, 3, 4] as const) expect(minFinishMs(courseFor(id))).toBe(progressFloorMs(courseFor(id)));
   });

   it("the least duration takes off every orb and the most flow bonus", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(minDurationMsOf(c)).toBe(minFinishMs(c) - c.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(c)));
      }
   });

   it("the dash floor: (POWER_MS.dash + 1) ms at V_DASH where the floor counted V_RUN, one dash per cooldown and the first", () => {
      expect(POWER_MS.dash).toBe(500);
      expect(V_DASH).toBe(12);
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const per = ((POWER_MS.dash + 1) * (V_DASH - V_RUN)) / V_RUN;
         const F = progressFloorMs(c);
         let T = 0;
         while (T + per * (1 + Math.floor(T / heroById("riko").cooldownMs)) < F) T += 1;
         if (c.boss) T = Math.max(T, bossMinMs());
         expect(dashFloorMs(c)).toBe(T - c.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(c)));
         expect(PROPOSED_LEVEL_LIMITS[id].minDurationMs).toBeLessThanOrEqual(dashFloorMs(c));
      }
   });

   it("every level's minDurationMs sits in 90-100 % of its bound and under the dash floor; the limits are pinned", () => {
      for (const id of LEVEL_IDS) {
         const lb = minDurationMsOf(courseFor(id));
         const lim = PROPOSED_LEVEL_LIMITS[id];
         expect(lim.minDurationMs).toBeLessThanOrEqual(lb);
         expect(lim.minDurationMs).toBeGreaterThanOrEqual(lb * 0.88);
         expect(lim.maxScore).toBe(Math.floor((lim.timeBaseMs - lim.minDurationMs) / 10));
         expect(lim.timeBaseMs).toBe(LEVELS[id].durationMs);
         expect(lim.maxDurationMs).toBe(LEVELS[id].durationMs);
      }
      expect(LEVEL1_LIMITS).toBe(PROPOSED_LEVEL_LIMITS[1]);
      expect(LEVEL_IDS.map((id) => [PROPOSED_LEVEL_LIMITS[id].minDurationMs, PROPOSED_LEVEL_LIMITS[id].maxDurationMs, PROPOSED_LEVEL_LIMITS[id].timeBaseMs, PROPOSED_LEVEL_LIMITS[id].maxScore])).toEqual(PINNED);
      expect(cloudHopperMeta.scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[1]);
      for (const id of LEVEL_IDS) expect(cloudHopperMeta.levels![id - 1].scoring).toMatchObject(PROPOSED_LEVEL_LIMITS[id]);
   });

   it("every level is worth at least level 1's points, and level 5 at most 3x", () => {
      const l1 = PROPOSED_LEVEL_LIMITS[1].maxScore;
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(l1);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(l1 * 3);
   });
});

/** minDurationMs, maxDurationMs, timeBaseMs, maxScore per level (README table). */
const PINNED = [
   [20300, 130000, 130000, 10970],
   [26700, 150000, 150000, 12330],
   [24700, 180000, 180000, 15530],
   [38200, 210000, 210000, 17180],
   [39700, 240000, 240000, 20030],
];

describe("bots (README 'What the bots reached')", () => {
   for (const level of LEVEL_IDS) {
      it(`level ${level}: the honest bot reaches the bridge at 30, 60 and 144 fps, never under the floor, at least 90 % of maxScore`, () => {
         const lim = PROPOSED_LEVEL_LIMITS[level];
         for (const fps of FPS) {
            const run = botRun(level, fps);
            expect(run.ended, `${fps} fps`).toBe("win");
            expect(run.finishMs).toBeGreaterThanOrEqual(minFinishMs(run.course));
            const d = submitted(run);
            expect(d).toBeGreaterThanOrEqual(lim.minDurationMs);
            expect(d).toBeLessThanOrEqual(lim.maxDurationMs);
            const score = Math.floor((lim.timeBaseMs - d) / 10);
            expect(score, `${fps} fps ${score} / ${lim.maxScore}`).toBeGreaterThanOrEqual(lim.maxScore * 0.9);
            expect(run.mainOrbs, `${fps} fps every main orb`).toBe(run.course.mainOrbs);
         }
      });
   }

   it("the honest bot's points: each level at least level 1, level 5 at most 3x", () => {
      const points = (id: LevelId) => Math.floor((PROPOSED_LEVEL_LIMITS[id].timeBaseMs - submitted(botRun(id, 60))) / 10);
      const first = points(1);
      for (const id of LEVEL_IDS) expect(points(id)).toBeGreaterThanOrEqual(first);
      expect(points(5)).toBeLessThanOrEqual(first * 3);
   });

   it("idle never wins: the sunset ends it unranked (level 5: the boss keeps catching you)", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(3, id);
         const none = createStepInput();
         for (let f = 0; f < 40_000 && run.ended === null; f++) step(run, 50, none);
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
      expect(isRankedRun(cloudHopperMeta.scoring, store.getState().endReason)).toBe(false);
   });

   it("200 spam bots on level 1 (random stick, jump mashing and holding, power, random frame times) never beat the floor", () => {
      const lim = PROPOSED_LEVEL_LIMITS[1];
      for (let seed = 1; seed <= 200; seed++) {
         const rng = createRng(seed * 7919);
         const run = createRun(seed, 1, HEROES[seed % 5].id);
         const input = createStepInput();
         for (let f = 0; f < 6000 && run.ended === null; f++) {
            if (f % 10 === 0) {
               input.moveX = rng() * 2 - 1;
               input.moveZ = -rng();
               input.jumpHeld = rng() < 0.6;
            }
            input.jumpPressed = rng() < 0.5;
            input.actionPressed = rng() < 0.1;
            step(run, 4 + rng() * 46, input);
         }
         if (run.ended === "win") expect(submitted(run)).toBeGreaterThanOrEqual(lim.minDurationMs);
      }
   });

   it("the honest bot through the real store with ragged frames: a ranked win inside the limits, the score from the time", () => {
      const store = createArcadeStore();
      store.getState().configure({ resultDelayMs: 1600 });
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
      const rules = cloudHopperMeta.scoring;
      const sent = normalizeRun({ slug: "cloud-hopper", score: fin.score, durationMs: fin.durationMs, finishedAt: "2026-10-27T00:00:00Z" }, rules);
      expect(isRankedRun(rules, s.endReason)).toBe(true);
      expect(sent.durationMs).toBeGreaterThanOrEqual(rules.minDurationMs);
      expect(sent.score).toBe(computeTimeScore(rules, sent.durationMs));
      expect(sent.score).toBeLessThanOrEqual(rules.maxScore);
   });
});

describe("camera-relative stick and solid boxes (for menu2/camera)", () => {
   it("yaw 0 is the world direction itself; a turned camera turns the stick", () => {
      const a = createRun(1, 1);
      const ia = createStepInput();
      ia.moveZ = -1;
      hold(a, 500, ia);
      const c = createRun(1, 1);
      const ic = createStepInput();
      ic.moveZ = -1;
      ic.yaw = Math.PI / 2;
      hold(c, 500, ic);
      // with the camera turned a quarter, the stick's "up" points along -x
      expect(a.hero.z).toBeLessThan(createRun(1, 1).hero.z - 1);
      expect(c.hero.x).toBeLessThan(a.hero.x - 1);
      expect(Math.abs(c.hero.z - createRun(1, 1).hero.z)).toBeLessThan(0.05);
   });

   it("solidBoxes lists every cloud where it is now and every standing wall; courseBoxes the resting ones", () => {
      const run = createRun(1, 2);
      const out: SolidBox[] = [];
      const n = solidBoxes(run, 0, out);
      expect(n).toBe(run.course.clouds.length + run.course.walls.length);
      expect(courseBoxes(run.course)).toHaveLength(n);
      const first = run.course.clouds[0];
      expect(out[0]).toEqual({ minX: first.cx - first.hw, maxX: first.cx + first.hw, minY: first.bottom, maxY: first.top, minZ: first.cz - first.hd, maxZ: first.cz + first.hd });
      run.broken[0] = 1;
      expect(solidBoxes(run, 0, out)).toBe(n - 1);
   });
});

void V_JUMP;
