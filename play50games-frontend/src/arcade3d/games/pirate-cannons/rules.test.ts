import { describe, expect, it } from "vitest";
import { solveLaunch, stepProjectile, type Projectile } from "@/arcade3d/core/ballistics";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { withinServerLimits as fitsLimits, capScore as capToLimits } from "@/arcade3d/core/limits";
import { createRng } from "@/arcade3d/core/math";
import { createPath, pointAt, tangentAt } from "@/arcade3d/core/path";
import type { ScoringRules } from "@/arcade3d/types";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { AIM } from "./aim";
import {
   BARREL,
   BARREL_FLOATING,
   BARREL_FUSE,
   CHEST,
   DURATION_MS,
   ISLAND,
   LANES,
   LANE_BONUS,
   LIVES,
   MAX_SCORE,
   SEA,
   SHIPS,
   SHIP_ARRIVED,
   SHIP_SAILING,
   SHIP_SUNK,
   SHIP_TYPES,
   TICK,
   WAVES,
   WORLD,
   advanceRun,
   ballAt,
   ceilingAt,
   createRun,
   generatePlan,
   hitsIsland,
   launchState,
   muzzleAt,
   shipPath,
   shotBase,
   sphereCentre,
   zigAmplitude,
   zigWeight,
   type RunState,
   type Ship,
} from "./rules";

const DEG = Math.PI / 180;
/** The limits this README proposes (meta.ts keeps the provisional ones until Claude's limits PR). */
const PROPOSED: ScoringRules = { kind: "points", maxScore: 10500, minDurationMs: 19000, maxDurationMs: 92000, base: 1500, maxPointsPerSec: 110, unitLabel: "pts", display: "int" };
const seeds = (n: number, from = 1) => Array.from({ length: n }, (_v, i) => from + i * 7919);
const sorted = <T>(a: readonly T[]) => [...a].sort();

/** Run `seconds` of play in frames of `frame` s, with no shots. */
function idle(run: RunState, seconds: number, frame = 1 / 60) {
   for (let t = 0; t < seconds - 1e-9; t += frame) advanceRun(run, frame, 0, 0, false);
}

describe("plan", () => {
   it("is deterministic and keeps each wave's fixed multisets, spawn windows and wind range", () => {
      expect(generatePlan(42)).toEqual(generatePlan(42));
      for (const seed of seeds(1000)) {
         const plan = generatePlan(seed);
         WAVES.forEach((w, wave) => {
            const ships = plan.ships.filter((s) => s.wave === wave);
            expect(sorted(ships.map((s) => s.type))).toEqual(sorted(w.types));
            expect(sorted(ships.map((s) => s.lane))).toEqual(sorted(w.lanes));
            ships.forEach((s, i) => {
               const at = w.start + (i * w.span) / ships.length;
               expect(s.spawnAt).toBeGreaterThanOrEqual(at);
               expect(s.spawnAt).toBeLessThan(at + 1.5);
            });
            const { strength, wind } = plan.waves[wave];
            expect(strength).toBeGreaterThanOrEqual(0.5 * w.wind);
            expect(strength).toBeLessThanOrEqual(w.wind);
            expect(Math.hypot(wind.x, wind.z)).toBeCloseTo(strength, 9);
            const b = plan.barrels[wave];
            expect(b.spawnAt).toBe(w.start + BARREL.delay);
            expect([-22, -43, -52]).toContain(b.z);
         });
         expect(plan.chest.spawnAt).toBeGreaterThanOrEqual(CHEST.minS);
         expect(plan.chest.spawnAt).toBeLessThanOrEqual(CHEST.maxS);
         expect([1, 2]).toContain(plan.chest.lane);
      }
   });
});

describe("cannon and ballistics", () => {
   it("puts the muzzle about 3 m up at the platform's front and fires at 28 m/s along the aim", () => {
      const m = muzzleAt(0, 0, { x: 0, y: 0, z: 0 });
      expect(m.y).toBeGreaterThan(2.9);
      expect(m.y).toBeLessThan(3.1);
      expect(m.z).toBeLessThan(-0.6);
      const p = launchState(30 * DEG, 20 * DEG, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
      expect(Math.hypot(p.vx, p.vy, p.vz)).toBeCloseTo(WORLD.muzzleSpeed, 9);
      expect(Math.atan2(p.vx, -p.vz)).toBeCloseTo(30 * DEG, 9);
      expect(p.x).toBeGreaterThan(0);
   });

   it("matches an independent closed form and a 2 kHz Euler reference at the far lane, wind drift = a t² / 2", () => {
      const ball = { launch: launchState(4 * DEG, 18 * DEG, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }), params: { gravity: WORLD.gravity, wind: { x: 2.1, z: -1.3 } } };
      const scratch = new Float32Array(6);
      const at = { x: 0, y: 0, z: 0 };
      const l = ball.launch;
      const t = 2;
      ballAt(ball, t, scratch, at);
      expect(at.x).toBeCloseTo(l.x + l.vx * t + 2.1 * t * t * 0.5, 4);
      expect(at.y).toBeCloseTo(l.y + l.vy * t - WORLD.gravity * t * t * 0.5, 4);
      expect(at.z).toBeCloseTo(l.z + l.vz * t - 1.3 * t * t * 0.5, 4);
      const still = { launch: l, params: { gravity: WORLD.gravity, wind: { x: 0, z: 0 } } };
      const calm = ballAt(still, t, scratch, { x: 0, y: 0, z: 0 });
      expect(at.x - calm.x).toBeCloseTo(0.5 * 2.1 * t * t, 4);
      const euler: Projectile = { ...l };
      for (let k = 0; k < 4000; k++) stepProjectile(euler, 0.0005, ball.params);
      expect(Math.hypot(euler.x - at.x, euler.y - at.y, euler.z - at.z)).toBeLessThan(0.01);
   });

   it("reaches the 25 / 40 / 55 m lanes at about 1.5° / 10° / 18° and about 79 m at 35° (no wind)", () => {
      const range = (el: number) => {
         const ball = { launch: launchState(0, el, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }), params: { gravity: WORLD.gravity, wind: { x: 0, z: 0 } } };
         const at = ballAt(ball, 10, new Float32Array(6), { x: 0, y: 0, z: 0 });
         return -at.z;
      };
      expect(range(1.5 * DEG)).toBeGreaterThan(24);
      expect(range(1.5 * DEG)).toBeLessThan(27);
      expect(range(10 * DEG)).toBeGreaterThan(39);
      expect(range(10 * DEG)).toBeLessThan(44);
      expect(range(18 * DEG)).toBeGreaterThan(54);
      expect(range(18 * DEG)).toBeLessThan(60);
      expect(range(AIM.elMax)).toBeGreaterThan(77);
      expect(range(AIM.elMax)).toBeLessThan(81);
   });
});

describe("ships", () => {
   it("spawn with the bow at x -20 and keep a straight lane past the island on every course", () => {
      let clear = Infinity;
      for (const type of SHIP_TYPES)
         for (let lane = 0; lane < 3; lane++)
            for (const wave of [0, 4]) {
               const path = shipPath(type, lane, wave);
               expect(path.points[0].x + SHIPS[type].length / 2).toBeCloseTo(SEA.spawnBowX, 9);
               const p = { x: 0, y: 0, z: 0 };
               const tan = { x: 0, y: 0, z: 0 };
               for (let s = 0; s <= path.total; s += 0.1) {
                  pointAt(path, s, p);
                  // flat within 6 m of the island (the 1 m polyline blurs the edge by up to 1 m)
                  if (Math.abs(p.x - ISLAND.x) <= 5) expect(p.z).toBeCloseTo(LANES[lane], 6);
                  // no hull sphere ever enters the island cylinder
                  tangentAt(path, s, tan);
                  const len = Math.hypot(tan.x, tan.z);
                  for (const o of SHIPS[type].spheres) {
                     const edge = Math.hypot(p.x + (tan.x / len) * o - ISLAND.x, p.z + (tan.z / len) * o - ISLAND.z) - SHIPS[type].r;
                     clear = Math.min(clear, edge);
                  }
                  expect(Math.abs(p.z - LANES[lane])).toBeLessThanOrEqual(zigAmplitude(type, wave) + 1e-9);
               }
            }
      // the nearest hull sphere edge stays 1.8 m outside the island cylinder
      expect(clear).toBeGreaterThan(ISLAND.r + 1.7);
      expect(zigWeight(ISLAND.x + 6)).toBe(0);
      expect(zigWeight(ISLAND.x - 10)).toBe(1);
      // barrels and the chest float clear of the island (their lanes are fixed lines)
      for (const z of [-22, -43, -52, ...LANES.slice(1)]) expect(Math.abs(z - ISLAND.z) - 0.6).toBeGreaterThan(ISLAND.r);
   });

   it("enter the view within 0.5 s of spawning, keep at most 8 alive and the same-lane gap", () => {
      let crowded = 0;
      let overlap = Infinity;
      let late = 0;
      for (const seed of seeds(60)) {
         const run = createRun(seed);
         const spawned = new Array<number>(run.ships.length).fill(-1);
         const seen = new Array<number>(run.ships.length).fill(-1);
         for (let f = 0; f < 2700; f++) {
            advanceRun(run, 1 / 30, 0, 0, false);
            let alive = 0;
            for (const s of run.ships) {
               if (s.state !== SHIP_SAILING) continue;
               alive++;
               if (spawned[s.index] < 0) spawned[s.index] = run.time;
               if (seen[s.index] < 0 && s.rider.position.x + s.spec.length / 2 >= -19) seen[s.index] = run.time;
               for (const o of run.ships)
                  if (o !== s && o.state === SHIP_SAILING && o.lane === s.lane && o.rider.position.x > s.rider.position.x)
                     overlap = Math.min(overlap, o.rider.position.x - o.spec.length / 2 - (s.rider.position.x + s.spec.length / 2));
            }
            crowded = Math.max(crowded, alive);
         }
         for (let i = 0; i < run.ships.length; i++) if (seen[i] >= 0) late = Math.max(late, seen[i] - spawned[i]);
      }
      expect(crowded).toBeLessThanOrEqual(SEA.maxAlive);
      expect(overlap).toBeGreaterThan(0);
      expect(late).toBeLessThanOrEqual(0.5);
   });

   it("never drops a tick at 50 ms frames, and the rules time never runs ahead of play time", () => {
      const run = createRun(9);
      let played = 0;
      for (let i = 0; i < 400; i++) {
         advanceRun(run, 0.05, 0, 0, false);
         played += 0.05;
         expect(run.time).toBeLessThanOrEqual(played + 1e-9);
         expect(played - run.time).toBeLessThan(TICK + 1e-9);
      }
   });
});

/** A run whose ship 0 sits still at (x, lane z), heading +x, for hand-made hits. */
function staged(type: Ship["type"], x: number, lane = 0): { run: RunState; ship: Ship } {
   const run = createRun(1);
   for (const s of run.ships) s.spawnAt = 1e9;
   for (const b of run.barrels) b.spawnAt = 1e9;
   run.chest.spawnAt = 1e9;
   const ship = run.ships[0];
   const path = createPath([{ x: -100, y: 0, z: LANES[lane] }, { x: 100, y: 0, z: LANES[lane] }]);
   Object.assign(ship, { type, spec: SHIPS[type], hp: SHIPS[type].hp, lane, state: SHIP_SAILING, speed: 0, current: 0, hx: 1, hz: 0, spawnAt: 0 });
   ship.rider = { path, s: x + 100, position: { x, y: 0, z: LANES[lane] }, overflow: 0 };
   return { run, ship };
}
const moveShip = (ship: Ship, x: number) => {
   ship.rider.s = x + 100;
   ship.rider.position.x = x;
};

/** Drop a ball straight down so that after `ticks` ticks its centre is at (x, y, z). */
function dropBall(run: RunState, x: number, y: number, z: number, ticks: number) {
   advanceRun(run, 0, 0, 0, true);
   run.reload = 0;
   run.tick(TICK);
   const ball = run.balls.find((b) => b.active)!;
   const t = ticks * TICK;
   Object.assign(ball.launch, { x, y: y + 0.5 * WORLD.gravity * t * t, z, vx: 0, vy: 0, vz: 0 });
   ball.params.wind.x = 0;
   ball.params.wind.z = 0;
   ball.ticks = 0;
   return ball;
}

describe("hits", () => {
   it("touch a hull sphere at r_sum and not 1 mm outside it; a graze between ticks misses only within 1 cm", () => {
      const rsum = WORLD.ballRadius + SHIPS.sloop.r;
      for (const [gap, hit] of [[-0.001, true], [0.001, false]] as const) {
         const { run, ship } = staged("sloop", 0);
         const c = sphereCentre(ship, 1, { x: 0, y: 0, z: 0 });
         dropBall(run, c.x, c.y + rsum + gap, c.z, 30);
         for (let k = 0; k < 29; k++) run.tick(TICK);
         run.events.hitCount = 0;
         run.tick(TICK);
         expect(run.events.hitCount > 0, `gap ${gap}`).toBe(hit);
      }
      // a level pass at 28 m/s moves 0.233 m a tick: the deepest a chord can miss inside r_sum
      const half = (WORLD.muzzleSpeed * TICK) / 2;
      expect(rsum - Math.sqrt(rsum * rsum - half * half)).toBeLessThan(0.01);
   });

   it("are blocked by the island's mound, trunks and crowns", () => {
      expect(hitsIsland(ISLAND.x, 0.8, ISLAND.z)).toBe(true);
      expect(hitsIsland(ISLAND.palms[0].x, 2, ISLAND.palms[0].z)).toBe(true);
      expect(hitsIsland(ISLAND.palms[1].x, ISLAND.crownY + 1.4, ISLAND.palms[1].z)).toBe(true);
      expect(hitsIsland(ISLAND.x, 6, ISLAND.z)).toBe(false);
      expect(hitsIsland(ISLAND.x + 5, 0.3, ISLAND.z)).toBe(false);
   });

   it("sink a ship at 0 HP: never a target again and never costs a life", () => {
      const { run, ship } = staged("dinghy", 0);
      const c = sphereCentre(ship, 0, { x: 0, y: 0, z: 0 });
      dropBall(run, c.x, c.y, c.z, 1);
      run.tick(TICK);
      expect(ship.state).toBe(SHIP_SUNK);
      moveShip(ship, 30);
      idle(run, 1);
      expect(run.harbour).toBe(0);
      expect(run.score).toBe(shotBase(1, LANE_BONUS[0], false, false));
   });

   it("blast every ship with a sphere within 6 m + r, set off barrels within 6 m 0.15 s later, damage a ship once per shot", () => {
      const { run, ship } = staged("galleon", 0, 0);
      const b0 = run.barrels[0];
      const b1 = run.barrels[1];
      // barrels drift 0.6 m/s: they start two ticks back so barrel 0 is at x 0 on the hit tick
      const back = -2 * BARREL.speed * TICK;
      Object.assign(b0, { state: BARREL_FLOATING, x: back, z: -22 });
      Object.assign(b1, { state: BARREL_FLOATING, x: 5.9 + back, z: -22 });
      // the galleon's nearest sphere centre at exactly 6 + r - 1 mm from barrel 0
      const d = BARREL.radius + SHIPS.galleon.r - 0.001;
      moveShip(ship, Math.sqrt(d * d - (SHIPS.galleon.y - BARREL.y) ** 2 - (LANES[0] + 22) ** 2) + 2.85);
      dropBall(run, 0, BARREL.y, -22, 1);
      run.tick(TICK);
      expect(ship.hp).toBe(SHIPS.galleon.hp - 1);
      expect(b1.state).toBe(BARREL_FUSE);
      for (let k = 0; k < 17; k++) run.tick(TICK);
      expect(b1.state).toBe(BARREL_FUSE);
      run.tick(TICK); // 18 ticks = 0.15 s
      expect(b1.state).not.toBe(BARREL_FUSE);
      expect(ship.hp).toBe(SHIPS.galleon.hp - 1);
      expect(run.score).toBe(100); // one ship: no chain bonus
      // 2 mm further: out of the blast
      const far = staged("galleon", 0, 0);
      Object.assign(far.run.barrels[0], { state: BARREL_FLOATING, x: back, z: -22 });
      moveShip(far.ship, ship.rider.position.x + 0.002);
      dropBall(far.run, 0, BARREL.y, -22, 1);
      far.run.tick(TICK);
      expect(far.ship.hp).toBe(SHIPS.galleon.hp);
   });
});

describe("scoring", () => {
   it("prices hits, sinks, chains (capped), the chest and the combo", () => {
      expect(shotBase(1, 0, false, false)).toBe(100);
      expect(shotBase(1, 100, false, false)).toBe(200);
      expect(shotBase(3, 50, true, false)).toBe(300 + 50 + 200);
      expect(shotBase(6, 0, true, false)).toBe(600 + 300);
      expect(shotBase(0, 0, true, false)).toBe(0);
      expect(shotBase(0, 0, false, true)).toBe(300);
      // the streak: the 3rd consecutive scoring shot and later at x1.5, a miss resets it
      const { run, ship } = staged("galleon", 0);
      const c = sphereCentre(ship, 1, { x: 0, y: 0, z: 0 });
      const fire = () => {
         dropBall(run, c.x, c.y, c.z, 1);
         run.tick(TICK);
      };
      fire();
      fire();
      ship.hp = 3;
      fire();
      expect(run.score).toBe(100 + 100 + 150);
      dropBall(run, 0, 0, 5, 1);
      run.tick(TICK);
      ship.hp = 3;
      ship.state = SHIP_SAILING;
      const before = run.score;
      fire();
      expect(run.score - before).toBe(100);
   });

   it("counts the streak in resolution order: a near shot fired after a far one resolves first", () => {
      const { run, ship } = staged("galleon", 0);
      const c = sphereCentre(ship, 1, { x: 0, y: 0, z: 0 });
      dropBall(run, 50, 30, 0, 200); // fired first: a miss that lands about 500 ticks later
      dropBall(run, c.x, c.y, c.z, 1);
      run.tick(TICK);
      expect(run.score).toBe(100);
      expect(run.streak).toBe(1);
      for (let k = 0; k < 600; k++) run.tick(TICK);
      expect(run.streak).toBe(0);
   });

   it("adds up to the 10,500 ceiling, which C(t) keeps under 1500 + 110 t at every spawn time", () => {
      expect(MAX_SCORE).toBe(10500);
      const times = [0, 90, ...WAVES.flatMap((w) => [w.start + BARREL.delay, ...w.types.map((_t, i) => w.start + (i * w.span) / w.types.length)]), CHEST.minS];
      for (let t = 0; t <= 90; t += 0.05) times.push(t);
      for (const t of times) expect(ceilingAt(t), `t ${t}`).toBeLessThanOrEqual(PROPOSED.base + PROPOSED.maxPointsPerSec * t);
      expect(ceilingAt(84)).toBe(10350);
   });

   it("an idle run loses its third life no earlier than 20.54 s (1,000 seeds)", () => {
      let earliest = Infinity;
      for (const seed of seeds(1000)) {
         const run = createRun(seed);
         while (run.harbour < LIVES && run.time < 90) advanceRun(run, 0.05, 0, 0, false);
         earliest = Math.min(earliest, run.time);
         if (run.harbour >= LIVES) expect(run.ships.filter((s) => s.state === SHIP_ARRIVED || s.state === 4).length).toBeGreaterThanOrEqual(LIVES);
      }
      expect(earliest).toBeGreaterThanOrEqual(20.54 - TICK);
      expect(earliest * 1000).toBeGreaterThanOrEqual(PROPOSED.minDurationMs);
   });
});

// ---------- the oracle bot through the real store ----------

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
}

/** The oracle: leads the most advanced ship not already covered by balls in flight; a barrel when it would hit 2+ ships; the chest. */
function botRun(seed: number, frame: () => number): BotRun {
   const store = createArcadeStore();
   store.getState().configure({ durationMs: DURATION_MS, lives: LIVES });
   store.getState().markReady();
   store.getState().start();
   const run = createRun(seed);
   const incoming = new Map<number, number[]>();
   let aim = { yaw: 0, el: 10 * DEG };
   let shots = 0;
   let idleUntil = 0;
   const at = { x: 0, y: 0, z: 0 };
   while (store.getState().phase !== "over") {
      advanceRunClock(store, frame());
      const dt = playedFrameDt(store.getState());
      if (dt === 0) continue;
      let fire = false;
      if (!run.buffered && run.reload <= dt && run.time >= idleUntil) {
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
         for (const b of run.barrels) {
            if (b.state !== BARREL_FLOATING) continue;
            const a = lead(run, (t, out) => Object.assign(out, { x: b.x + BARREL.speed * t, y: BARREL.y, z: b.z }), delay);
            if (!a) continue;
            const near = run.ships.filter((s) => {
               if (s.state !== SHIP_SAILING) return false;
               shipAhead(s, delay + a.tf, at);
               return Math.hypot(at.x - (b.x + BARREL.speed * (delay + a.tf)), at.z - b.z) < BARREL.radius;
            });
            if (near.length >= 2) [best, bestKey, target] = [a, 1e6, -1];
         }
         if (run.chest.state === 1) {
            const c = run.chest;
            const a = lead(run, (t, out) => Object.assign(out, { x: c.x + CHEST.speed * t, y: CHEST.y, z: c.z }), delay);
            if (a && bestKey < 1e6) [best, bestKey, target] = [a, 1e5, -1];
         }
         if (best) {
            aim = { yaw: best.yaw, el: best.el };
            fire = true;
            shots++;
            if (target >= 0) incoming.set(target, [...(incoming.get(target) ?? []), run.time + delay + best.tf + 0.05]);
         } else idleUntil = run.time + 0.1;
      }
      advanceRun(run, dt, aim.yaw, aim.el, fire);
      const ev = run.events;
      const s = store.getState();
      for (let i = 0; i < ev.scoreCount; i++) s.addScore(ev.scores[i].points);
      for (let i = 0; i < ev.harbour; i++) store.getState().loseLife();
   }
   const s = store.getState();
   expect(s.score).toBe(Math.min(run.score, s.score));
   return { score: s.score, ms: s.elapsedMs, reason: s.endReason ?? "", shots };
}

describe("limit proof: the oracle bot on the real store", () => {
   const frames: Array<[string, (rng: () => number) => () => number]> = [
      ["60 fps", () => () => 1 / 60],
      ["20 fps", () => () => 1 / 20],
      ["random 4-50 ms", (rng) => () => 0.004 + rng() * 0.046],
   ];
   for (const [name, make] of frames) {
      it(`stays within the proposed limits at ${name} (200 seeds)`, () => {
         const rng = createRng(77);
         let best: BotRun & { seed: number } = { score: -1, ms: 0, reason: "", shots: 0, seed: 0 };
         let worst = Infinity;
         for (const seed of seeds(200, 11)) {
            const r = botRun(seed, make(rng));
            expect(fitsLimits(r.score, r.ms, PROPOSED), `seed ${seed}: ${r.score} in ${r.ms} ms`).toBe(true);
            expect(capToLimits(r.score, r.ms, PROPOSED)).toBe(r.score);
            expect(r.score).toBeLessThanOrEqual(MAX_SCORE);
            if (r.score > best.score) best = { ...r, seed };
            worst = Math.min(worst, r.score);
         }
         console.log(`pirate-cannons bot ${name}: best ${best.score} (${((best.score / MAX_SCORE) * 100).toFixed(1)} %, seed ${best.seed}, ${best.reason}, ${best.shots} shots), worst ${worst}`);
         expect(best.score).toBeGreaterThanOrEqual(0.7 * MAX_SCORE);
      });
   }

   it("frame rate does not change a run: the same aims and fire times at 30, 60, 144 fps and random frames hit the same ticks", () => {
      const results = new Set<string>();
      const rng = createRng(3);
      for (const frame of [() => 1 / 30, () => 1 / 60, () => 1 / 144, () => 0.004 + rng() * 0.046]) {
         const run = createRun(21);
         const log: string[] = [];
         let t = 0;
         let next = 1.5;
         let fire = false;
         let aim = { yaw: 0, el: 0.1 };
         while (t < 40) {
            // frames end exactly on each fire time, so every frame rate fires on the same tick, aimed
            // from the same state at the most advanced ship
            const dt = Math.min(frame(), next - t);
            if (fire) {
               const s = run.ships.filter((o) => o.state === SHIP_SAILING).sort((a, b) => b.rider.position.x - a.rider.position.x)[0];
               const a = s && lead(run, (u, out) => shipAhead(s, u, out), TICK);
               if (a) aim = { yaw: a.yaw, el: a.el };
            }
            advanceRun(run, dt, aim.yaw, aim.el, fire);
            fire = false;
            t += dt;
            if (Math.abs(t - next) < 1e-9) {
               t = next;
               fire = true;
               next += 1.5;
            }
            for (let i = 0; i < run.events.hitCount; i++) log.push(`${run.events.hits[i].tick}:${run.events.hits[i].ship}`);
         }
         expect(log.length).toBeGreaterThan(3);
         results.add(`${log.join(",")}|${run.score}`);
      }
      expect(results.size).toBe(1);
   });
});
