// The five levels (docs/arcade-levels.md §6.3 step 6 and §5): declarations, level 1 = today's game
// (replayed against today's createRun), monotone difficulty, every level setting reaching the
// simulation, the limit proof per level and the bots through the real store. rules.test.ts (level 1's
// own proof and bots) is untouched; its oracle bot is copied below with a level and an aim-noise knob.
import { describe, expect, it, vi } from "vitest";
import { solveLaunch } from "@/arcade3d/core/ballistics";
import { definitionLevelProblems, isLevelCleared, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { capScore, withinServerLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { pointAt } from "@/arcade3d/core/path";
import { fixedFrames, randomFrames, simulateRun } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { AIM } from "./aim";
import definition from "./index";
import { LEVELS, SHIP_POOL, type PirateLevel } from "./levels";
import { pirateCannonsMeta as meta } from "./meta";
import {
   BARREL,
   BARREL_FLOATING,
   CHEST,
   DURATION_MS,
   ISLAND,
   LANE_BONUS,
   LIVES,
   MAX_SCORE,
   SEA,
   SHIPS,
   SHIP_COUNT,
   SHIP_SAILING,
   TICK,
   WAVES,
   WORLD,
   ZIG,
   advanceRun,
   ballAt,
   ceilingAt,
   createRun,
   earliestLoss,
   generatePlan,
   harbourRun,
   hitsIsland,
   launchState,
   muzzleAt,
   PROPOSED_LEVEL_LIMITS,
   shipPath,
   zigAmplitude,
   type RunState,
   type Ship,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

const DEG = Math.PI / 180;
const levelMeta = (id: LevelId) => meta.levels![id - 1];
const prev = (id: LevelId) => LEVELS[(id - 1) as LevelId];
const shipsOf = (l: PirateLevel) => l.waves.reduce((n, w) => n + w.types.length, 0);
const hpOf = (l: PirateLevel) => l.waves.reduce((n, w) => n + w.types.reduce((h, t) => h + SHIPS[t].hp, 0), 0);
const seeds = (n: number, from = 1) => Array.from({ length: n }, (_v, i) => from + i * 7919);
/** Comparable state of a run (no closures). */
const snapshot = (run: RunState) => JSON.stringify({ ships: run.ships.map((s) => [s.state, s.hp, s.rider.position.x, s.rider.position.z, s.current]), score: run.score, harbour: run.harbour, time: run.time, wave: run.wave, wind: run.wind, barrels: run.barrels, chest: run.chest, plan: run.plan });


const scratch = { from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 }, s: new Float32Array(6), p: { x: 0, y: 0, z: 0 } };
const params = { gravity: WORLD.gravity, wind: { x: 0, z: 0 } };

/** Aim at a target that is at `where(t)` t s from now; the ball leaves after `delay` s. Null if out of reach or blocked. */
function lead(run: RunState, where: (t: number, out: { x: number; y: number; z: number }) => void, delay: number) {
   params.wind.x = run.wind.x;
   params.wind.z = run.wind.z;
   let yaw = 0;
   let el = 10 * DEG;
   let tf = 1.5;
   for (let k = 0; k < 5; k++) {
      muzzleAt(yaw, el, scratch.from);
      where(delay + tf, scratch.to);
      const v = solveLaunch(scratch.from, scratch.to, WORLD.muzzleSpeed, params, false, scratch.v);
      if (!v) return null;
      yaw = Math.atan2(v.x, -v.z);
      el = Math.asin(v.y / WORLD.muzzleSpeed);
      const dy = scratch.to.y - scratch.from.y;
      tf = (v.y + Math.sqrt(v.y * v.y - 2 * WORLD.gravity * dy)) / WORLD.gravity;
   }
   if (Math.abs(yaw) > AIM.yawMax || el < AIM.elMin || el > AIM.elMax) return null;
   // the island: only a shot whose ground track passes near it is sampled (every 2 ticks)
   const ax = scratch.from.x, az = scratch.from.z, bx = scratch.to.x - ax, bz = scratch.to.z - az;
   const k = Math.max(0, Math.min(1, ((ISLAND.x - ax) * bx + (ISLAND.z - az) * bz) / (bx * bx + bz * bz)));
   if (Math.hypot(ax + bx * k - ISLAND.x, az + bz * k - ISLAND.z) > ISLAND.r + ISLAND.crownR + 3) return { yaw, el, tf };
   const ball = { launch: launchState(yaw, el, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }), params };
   for (let t = TICK; t < tf - 0.05; t += 2 * TICK) {
      ballAt(ball, t, scratch.s, scratch.p);
      if (hitsIsland(scratch.p.x, scratch.p.y, scratch.p.z)) return null;
   }
   return { yaw, el, tf };
}

function shipAhead(ship: Ship, t: number, out: { x: number; y: number; z: number }) {
   pointAt(ship.rider.path, ship.rider.s + ship.current * t, out);
   out.y = ship.spec.y;
}

interface BotRun {
   score: number;
   ms: number;
   reason: string;
   shots: number;
   /** scored shots with a chain bonus, and barrel pairs that went off */
   chains: number;
   pairs: number;
}

interface BotOptions {
   frame: () => number;
   /** press fire on every frame (a buffered press keeps the aim of its own frame) */
   spam?: boolean;
   /** never aim or fire */
   idle?: boolean;
   /** pause with this chance per frame, resume with 0.2 per paused frame (seeded) */
   pauses?: number;
}


/**
 * The oracle through core's simulateRun on the real store: leads the most advanced ship not already
 * covered by balls in flight; a barrel pair when its blasts would reach 2+ ships; the chest.
 */
function botRun(seed: number, opts: BotOptions, level: PirateLevel = LEVELS[1], noise = 0): BotRun {
   const store = createArcadeStore();
   const run = createRun(seed, level);
   const incoming = new Map<number, number[]>();
   const rng = createRng(seed ^ 0x5bd1);
   let aim = { yaw: 0, el: 10 * DEG };
   let shots = 0;
   let chains = 0;
   let blasts = 0;
   let idleUntil = 0;
   const at = { x: 0, y: 0, z: 0 };
   const frame = opts.pauses
      ? () => {
           if (store.getState().phase === "paused" && rng() < 0.2) store.getState().resume();
           return opts.frame();
        }
      : opts.frame;
   const end = simulateRun(store, {
      durationMs: DURATION_MS,
      lives: LIVES,
      frame,
      step: (dt) => {
         let fire = !!opts.spam;
         if (!opts.idle && (opts.spam || !run.buffered) && run.reload <= dt && run.time >= idleUntil) {
            const delay = Math.max(run.reload, 0) + TICK;
            let best: { yaw: number; el: number; tf: number } | null = null;
            let bestKey = -Infinity;
            let target = -1;
            const covered = (i: number) => (incoming.get(i) ?? []).filter((t) => t > run.time).length;
            for (const s of run.ships) {
               if (s.state !== SHIP_SAILING || covered(s.index) >= s.hp) continue;
               const a = lead(run, (t, out) => shipAhead(s, t, out), delay);
               if (!a) continue;
               const key = s.rider.position.x + LANE_BONUS[s.lane] / 10;
               if (key > bestKey) [best, bestKey, target] = [a, key, s.index];
            }
            run.barrels.forEach((b, i) => {
               if (b.state !== BARREL_FLOATING) return;
               const a = lead(run, (t, out) => Object.assign(out, { x: b.x + BARREL.speed * t, y: BARREL.y, z: b.z }), delay);
               if (!a) return;
               const u = delay + a.tf;
               const pair = [b, run.barrels[i ^ 1]].filter((o) => o.state === BARREL_FLOATING);
               const near = run.ships.filter((s) => {
                  if (s.state !== SHIP_SAILING) return false;
                  shipAhead(s, u, at);
                  return pair.some((o) => Math.hypot(at.x - (o.x + BARREL.speed * u), at.z - o.z) < BARREL.radius);
               });
               if (near.length >= 2) [best, bestKey, target] = [a, 1e6, -1];
            });
            if (run.chest.state === 1) {
               const c = run.chest;
               const a = lead(run, (t, out) => Object.assign(out, { x: c.x + CHEST.speed * t, y: CHEST.y, z: c.z }), delay);
               if (a && bestKey < 1e6) [best, bestKey, target] = [a, 1e5, -1];
            }
            if (best) {
               // a human-paced variant aims a little off (seeded, the same on every frame rate)
               aim = { yaw: best.yaw + (rng() * 2 - 1) * noise, el: best.el + (rng() * 2 - 1) * noise };
               fire = true;
               shots++;
               if (target >= 0) incoming.set(target, [...(incoming.get(target) ?? []), run.time + delay + best.tf + 0.05]);
            } else idleUntil = run.time + 0.1;
         }
         advanceRun(run, dt, aim.yaw, aim.el, fire);
         const ev = run.events;
         for (let i = 0; i < ev.scoreCount; i++) {
            store.getState().addScore(ev.scores[i].points);
            if (ev.scores[i].chain > 0) chains++;
         }
         blasts += ev.blastCount;
         for (let i = 0; i < ev.harbour; i++) store.getState().loseLife();
         if (opts.pauses && rng() < opts.pauses) store.getState().pause();
      },
   });
   // the store never holds more than the rules scored (less when a shot resolves after the end)
   expect(end.score).toBeLessThanOrEqual(run.score);
   return { score: end.score, ms: end.elapsedMs, reason: end.endReason ?? "", shots, chains, pairs: blasts / 2 };
}


/** An idle run driven by advanceRun only (no shell): the most ships afloat at once and the third harbour crossing. */
function idleRun(seed: number, level: PirateLevel, until = 90) {
   const run = createRun(seed, level);
   let alive = 0;
   let lossAt = Infinity;
   while (run.time < until) {
      advanceRun(run, 0.05, 0, 0, false);
      let n = 0;
      for (const s of run.ships) if (s.state === SHIP_SAILING) n++;
      alive = Math.max(alive, n);
      if (run.harbour >= LIVES && lossAt === Infinity) lossAt = run.time;
   }
   return { run, alive, lossAt };
}

describe("pirate-cannons levels: declarations", () => {
   it("declares five levels in meta and definition with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(meta.scoring).toMatchObject({ maxScore: 10500, minDurationMs: 19000, maxDurationMs: 92000, base: 1500, maxPointsPerSec: 110 });
      for (const id of LEVEL_IDS) {
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      }
      expect([1, 2, 3, 4].map((id) => levelMeta(id as LevelId).clearScore)).toEqual([3000, 3500, 4000, 4500]);
      expect(levelMeta(5).clearScore).toBeUndefined();
   });

   it("level 1 is today's game: same waves, zig-zag, slots, plan and a replayed run", () => {
      expect(LEVELS[1].waves).toBe(WAVES);
      expect(LEVELS[1].zigFrom).toBe(ZIG.sloopFromWave);
      expect(shipsOf(LEVELS[1])).toBe(SHIP_COUNT);
      expect(ceilingAt(Infinity, LEVELS[1])).toBe(MAX_SCORE);
      expect(earliestLoss(LEVELS[1])).toBeCloseTo(20.54, 2);
      for (const seed of seeds(8)) {
         expect(generatePlan(seed, LEVELS[1])).toEqual(generatePlan(seed));
         const today = createRun(seed);
         const named = createRun(seed, LEVELS[1]);
         const rng = createRng(seed);
         let yaw = 0;
         let el = 10 * DEG;
         for (let n = 0; n < 90 * 30; n++) {
            if (rng() < 0.05) {
               yaw = (rng() * 2 - 1) * 0.6;
               el = (4 + rng() * 14) * DEG;
            }
            const fire = rng() < 0.1;
            advanceRun(today, 1 / 30, yaw, el, fire);
            advanceRun(named, 1 / 30, yaw, el, fire);
         }
         expect(snapshot(named)).toBe(snapshot(today));
      }
      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: DURATION_MS, lives: LIVES, resultDelayMs: 1400 });
      expect(levelInstructions(definition, 1)).toBe(definition.instructions);
      expect(levelHudStats(definition, 1)).toEqual(definition.hudStats);
   });

   it("keeps the clock, lives, chips and instructions on every level; the ship pools hold every level", () => {
      for (const id of LEVEL_IDS) {
         expect(levelRunConfig(definition, id)).toEqual(levelRunConfig(definition, 1));
         expect(levelInstructions(definition, id)).toBe(definition.instructions);
         expect(levelHudStats(definition, id)).toEqual(definition.hudStats);
         expect(shipsOf(LEVELS[id])).toBeLessThanOrEqual(SHIP_POOL);
         expect(LEVELS[id].waves.map((w) => w.start)).toEqual(WAVES.map((w) => w.start));
         for (const w of LEVELS[id].waves) expect(w.lanes.length).toBe(w.types.length);
      }
   });
});

describe("pirate-cannons levels: difficulty", () => {
   it("is monotone: more ships and hull, farther lanes, faster ships, more wind, earlier zig-zags", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = prev(id);
         const b = LEVELS[id];
         expect(shipsOf(b)).toBeGreaterThanOrEqual(shipsOf(a));
         expect(hpOf(b)).toBeGreaterThanOrEqual(hpOf(a));
         expect(b.zigFrom).toBeLessThanOrEqual(a.zigFrom);
         b.waves.forEach((w, i) => {
            const v = a.waves[i];
            expect(w.speed).toBeGreaterThanOrEqual(v.speed);
            expect(w.wind).toBeGreaterThanOrEqual(v.wind);
            const far = (x: typeof w) => x.lanes.reduce((n, l) => n + LANE_BONUS[l], 0);
            expect(far(w)).toBeGreaterThanOrEqual(far(v));
         });
         const harder = shipsOf(b) > shipsOf(a) || b.zigFrom < a.zigFrom || b.waves.some((w, i) => w.speed > a.waves[i].speed || w.wind > a.waves[i].wind);
         expect(harder).toBe(true);
         expect(levelMeta(id).clearScore ?? Infinity).toBeGreaterThan(levelMeta((id - 1) as LevelId).clearScore!);
      }
   });
});

describe("pirate-cannons levels: the simulation reads the level", () => {
   it("the plan sails each wave's ships, lanes and wind of the level", () => {
      for (const id of LEVEL_IDS) {
         const l = LEVELS[id];
         for (const seed of seeds(20)) {
            const plan = generatePlan(seed, l);
            expect(plan.ships.length).toBe(shipsOf(l));
            l.waves.forEach((w, wave) => {
               const mine = plan.ships.filter((s) => s.wave === wave);
               expect(mine.map((s) => s.type).sort()).toEqual([...w.types].sort());
               expect(mine.map((s) => s.lane).sort()).toEqual([...w.lanes].sort());
               expect(plan.waves[wave].strength).toBeLessThanOrEqual(w.wind + 1e-12);
            });
         }
      }
      // level 5's last wave can blow harder than level 1's maximum
      expect(Math.max(...seeds(50).map((seed) => generatePlan(seed, LEVELS[5]).waves[4].strength))).toBeGreaterThan(WAVES[4].wind);
   });

   it("ships sail at the level's speed on the level's zig-zag course", () => {
      for (const id of [1, 3, 5] as const) {
         const l = LEVELS[id];
         const run = createRun(7, l);
         expect(run.plan).toEqual(generatePlan(7, l));
         expect(run.ships.length).toBe(shipsOf(l));
         for (const s of run.ships) {
            expect(s.speed).toBeCloseTo(SHIPS[s.type].speed * l.waves[s.wave].speed, 12);
            expect(s.rider.path.total).toBeCloseTo(shipPath(s.type, s.lane, s.wave, l.zigFrom).total, 9);
            if (s.type === "sloop" && s.wave === 0) {
               expect(zigAmplitude(s.type, s.wave, l.zigFrom), `L${id}`).toBe(id >= 3 ? SHIPS.sloop.zig : 0);
               // a zig-zag course is longer than the straight one
               if (id >= 3) expect(s.rider.path.total).toBeGreaterThan(shipPath(s.type, s.lane, s.wave).total + 0.5);
            }
         }
      }
   });
});

describe("pirate-cannons levels: limit proof per level (README)", () => {
   for (const id of LEVEL_IDS) it(`L${id}: the ceiling, C(t) under base + pps t, and the earliest loss over 300 idle seeds`, () => {
      const l = LEVELS[id];
      const limits = PROPOSED_LEVEL_LIMITS[id];
      expect(limits.maxScore).toBe(ceilingAt(Infinity, l));
      expect(limits.maxDurationMs).toBe(DURATION_MS + 2000);
      const times = [90, CHEST.minS, ...l.waves.flatMap((w) => [w.start + BARREL.delay, ...w.types.map((_t, i) => w.start + (i * w.span) / w.types.length)])];
      for (const t of times) expect(ceilingAt(t, l), `t ${t}`).toBeLessThanOrEqual(limits.base! + limits.maxPointsPerSec! * t);
      const loss = earliestLoss(l);
      expect(limits.minDurationMs).toBe(Math.floor((loss * 925) / 500) * 500);
      expect(harbourRun("dinghy")).toBe(39.5);
      let earliest = Infinity;
      for (const seed of seeds(300)) earliest = Math.min(earliest, idleRun(seed, l, 40).lossAt);
      expect(earliest).toBeGreaterThanOrEqual(loss - TICK);
      expect(earliest * 1000).toBeGreaterThanOrEqual(limits.minDurationMs);
   }, 60_000);
});

describe("pirate-cannons levels: bots through the real store", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: the oracle and the human-paced bot stay inside the limits and clear; spam is legal; idle never clears`, () => {
         const l = LEVELS[id];
         const limits = PROPOSED_LEVEL_LIMITS[id];
         const target = levelMeta(id).clearScore ?? levelMeta(4).clearScore!;
         const legal = (r: BotRun, what: string) => {
            expect(withinServerLimits(r.score, r.ms, limits), `${what}: ${r.score} in ${r.ms} ms`).toBe(true);
            expect(capScore(r.score, r.ms, limits)).toBe(r.score);
            expect(r.score).toBeLessThanOrEqual(limits.maxScore);
            expect(r.ms).toBeGreaterThanOrEqual(limits.minDurationMs);
         };
         let best = 0;
         for (const [n, rate] of [[10, 1000 / 60], [6, 50]] as const) {
            for (const seed of seeds(n, 11)) {
               const r = botRun(seed, { frame: fixedFrames(rate) }, l);
               legal(r, `oracle ${seed}`);
               best = Math.max(best, r.score);
            }
         }
         expect(best).toBeGreaterThanOrEqual(0.7 * limits.maxScore);
         let cleared = 0;
         const honest = seeds(20, 101);
         for (const seed of honest) {
            const r = botRun(seed, { frame: randomFrames(seed) }, l, 0.6 * DEG);
            legal(r, `human ${seed}`);
            if (r.score >= target) cleared += 1;
            if (id < 5) expect(isLevelCleared(r.reason as never, r.score, levelMeta(id))).toBe(r.score >= target);
         }
         expect(cleared / honest.length).toBeGreaterThanOrEqual(0.99);
         for (const seed of seeds(4, 3)) legal(botRun(seed, { frame: randomFrames(seed), spam: true }, l), `spam ${seed}`);
         for (const seed of seeds(3, 5)) {
            const r = botRun(seed, { frame: fixedFrames(1000 / 60), idle: true }, l);
            legal(r, `idle ${seed}`);
            expect(r.score).toBe(0);
            expect(isLevelCleared(r.reason as never, r.score, levelMeta(id))).toBe(false);
         }
      }, 180_000);
   }
});
