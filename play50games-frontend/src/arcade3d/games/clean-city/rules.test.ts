import { describe, expect, it } from "vitest";
import type { AABB } from "@/arcade3d/core/collision";
import { FRAME_PRIORITY, MAX_FRAME_DT, advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createRng, rngNext } from "@/arcade3d/core/math";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { cleanCityMeta } from "./meta";
import {
   BEST_SCORE,
   BONUS_PER_SECOND,
   BOUNDS,
   BREAK_EVEN_MS,
   DURATION_MS,
   FALLBACK_SPOTS,
   FASTEST_FINISH_MS,
   FLOOD_N,
   FLOOD_STEP,
   FLOOR_HALF,
   GUARANTEED_MIN_ROUTE,
   HALF,
   ITEMS_PER_MAP,
   LITTER_KINDS,
   LITTER_POINTS,
   LITTER_RADIUS,
   MAPS,
   MAP_COUNT,
   MAP_MIN_ROUTE,
   MAP_SEED_MIX,
   MAX_PASSES,
   MAX_STEP_MS,
   MIN_CORRIDOR,
   NONE,
   PAIR_SPACING,
   PER_KIND,
   PICKUP_REACH,
   PROP_CLEARANCE,
   RUNNER,
   SPAWN_GRID,
   SPAWN_HALF,
   SPOT_N,
   START_PAD,
   START_SPACING,
   acceptsCentre,
   advanceClock,
   buildMapCache,
   capScore,
   createRun,
   createRunner,
   createStepInput,
   generateLayout,
   inReach,
   isClear,
   isReachable,
   isValidLayout,
   layoutSeedFor,
   obstacleBox,
   runScore,
   spotX,
   spotZ,
   step,
   stepRunner,
   timeBonus,
   withinServerLimits,
   type CleanRun,
   type Layout,
   type MapCache,
   type StepEvents,
   type StepInput,
} from "./rules";

// ---------- shared helpers ----------

const IDLE: StepInput = { moveX: 0, moveY: 0 };
const MAX_LOOP = 100_000;
const CACHES: MapCache[] = MAPS.map((_m, map) => buildMapCache(map));
const BOXES: AABB[][] = MAPS.map((m) => m.obstacles.map(obstacleBox));

/** Horizontal gap between two ground boxes (0 when they touch or overlap). */
function boxGap(a: AABB, b: AABB): number {
   const dx = Math.max(0, b.min.x - a.max.x, a.min.x - b.max.x);
   const dz = Math.max(0, b.min.z - a.max.z, a.min.z - b.max.z);
   return Math.hypot(dx, dz);
}

/** Test-side clearance (own formula, not distanceToBoxXZ). */
function clearance(x: number, z: number, boxes: readonly AABB[]): number {
   let best = Infinity;
   for (const b of boxes) {
      const dx = x < b.min.x ? b.min.x - x : x > b.max.x ? x - b.max.x : 0;
      const dz = z < b.min.z ? b.min.z - z : z > b.max.z ? z - b.max.z : 0;
      best = Math.min(best, Math.sqrt(dx * dx + dz * dz));
   }
   return best;
}

const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

function layoutOf(map: number, spots: ReadonlyArray<readonly [number, number]>, kinds?: number[]): Layout {
   return {
      map,
      seed: 0,
      x: spots.map((s) => s[0]),
      z: spots.map((s) => s[1]),
      kinds: kinds ?? Array.from({ length: ITEMS_PER_MAP }, (_v, i) => Math.floor(i / PER_KIND)),
      passes: 1,
      fallback: false,
   };
}

const cloneLayout = (l: Layout): Layout => ({ ...l, x: [...l.x], z: [...l.z], kinds: [...l.kinds] });

function place(run: CleanRun, x: number, z: number): void {
   run.runner.x = x;
   run.runner.z = z;
   run.runner.vx = 0;
   run.runner.vz = 0;
}

// ---------- frame patterns (ms per step) ----------

interface Pattern {
   name: string;
   make: (seed: number) => () => number;
}
const fixed = (ms: number) => () => ms;
const P_8: Pattern = { name: "8.3 ms", make: () => fixed(8.3) };
const P_16: Pattern = { name: "16.7 ms", make: () => fixed(16.7) };
const P_50: Pattern = { name: "50 ms", make: () => fixed(50) };
const P_RANDOM: Pattern = {
   name: "random 1-50 ms",
   make: (seed) => {
      const rng = createRng(seed ^ 0x5bd1e995);
      return () => 1 + rng() * 49;
   },
};
const PATTERNS = [P_8, P_16, P_50, P_RANDOM];

// ---------- a 0.25 grid of runner centres (test helper, not game code) ----------

const N = FLOOD_N * FLOOD_N;
const MID = (FLOOD_N - 1) / 2;
const nodeX = (i: number) => (i - MID) * FLOOD_STEP;
const nodeZ = (j: number) => (j - MID) * FLOOD_STEP;
const STEPS8: ReadonlyArray<readonly [number, number, number]> = [
   [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
   [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/** Runner centres `margin` farther than touching from every obstacle square, inside the wall clamp. */
function freeMask(boxes: readonly AABB[], margin: number): Uint8Array {
   const free = new Uint8Array(N);
   for (let i = 0; i < FLOOD_N; i++) {
      for (let j = 0; j < FLOOD_N; j++) {
         if (clearance(nodeX(i), nodeZ(j), boxes) >= RUNNER.radius + margin - 1e-9) free[i * FLOOD_N + j] = 1;
      }
   }
   return free;
}
const FREE = BOXES.map((b) => freeMask(b, 0.05));

class Heap {
   keys: Float64Array;
   vals: Int32Array;
   size = 0;
   top = 0;
   constructor(capacity: number) {
      this.keys = new Float64Array(capacity);
      this.vals = new Int32Array(capacity);
   }
   push(key: number, val: number): void {
      let i = this.size++;
      while (i > 0) {
         const parent = (i - 1) >> 1;
         if (this.keys[parent] <= key) break;
         this.keys[i] = this.keys[parent];
         this.vals[i] = this.vals[parent];
         i = parent;
      }
      this.keys[i] = key;
      this.vals[i] = val;
   }
   pop(): number {
      const val = this.vals[0];
      this.top = this.keys[0];
      const key = this.keys[--this.size];
      const last = this.vals[this.size];
      let i = 0;
      for (;;) {
         let child = 2 * i + 1;
         if (child >= this.size) break;
         if (child + 1 < this.size && this.keys[child + 1] < this.keys[child]) child += 1;
         if (this.keys[child] >= key) break;
         this.keys[i] = this.keys[child];
         this.vals[i] = this.vals[child];
         i = child;
      }
      this.keys[i] = key;
      this.vals[i] = last;
      return val;
   }
}

/** Grid move without cutting a corner: every node of the box the move spans is free. */
function canStep(free: Uint8Array, i: number, j: number, di: number, dj: number): boolean {
   const ni = i + di;
   const nj = j + dj;
   if (ni < 0 || nj < 0 || ni >= FLOOD_N || nj >= FLOOD_N) return false;
   for (let a = Math.min(i, ni); a <= Math.max(i, ni); a++) {
      for (let b = Math.min(j, nj); b <= Math.max(j, nj); b++) if (free[a * FLOOD_N + b] !== 1) return false;
   }
   return true;
}

const HEAP = new Heap(N * 9);
/** Dijkstra from every free goal node: grid path length to the nearest goal, Infinity = unreachable. */
function distanceField(free: Uint8Array, isGoal: (x: number, z: number) => boolean, out = new Float64Array(N)): Float64Array {
   out.fill(Infinity);
   HEAP.size = 0;
   for (let i = 0; i < FLOOD_N; i++) {
      for (let j = 0; j < FLOOD_N; j++) {
         const n = i * FLOOD_N + j;
         if (free[n] && isGoal(nodeX(i), nodeZ(j))) {
            out[n] = 0;
            HEAP.push(0, n);
         }
      }
   }
   while (HEAP.size > 0) {
      const n = HEAP.pop();
      const d = HEAP.top;
      if (d > out[n]) continue;
      const i = (n / FLOOD_N) | 0;
      const j = n % FLOOD_N;
      for (const [di, dj, w] of STEPS8) {
         if (!canStep(free, i, j, di, dj)) continue;
         const m = (i + di) * FLOOD_N + (j + dj);
         const nd = d + w * FLOOD_STEP;
         if (nd < out[m]) {
            out[m] = nd;
            HEAP.push(nd, m);
         }
      }
   }
   return out;
}

/** The free node nearest to a point. */
function nearestFree(free: Uint8Array, x: number, z: number): number {
   const ci = Math.round(x / FLOOD_STEP + MID);
   const cj = Math.round(z / FLOOD_STEP + MID);
   let best = -1;
   let bestD = Infinity;
   for (let i = ci - 4; i <= ci + 4; i++) {
      for (let j = cj - 4; j <= cj + 4; j++) {
         if (i < 0 || j < 0 || i >= FLOOD_N || j >= FLOOD_N || !free[i * FLOOD_N + j]) continue;
         const d = dist(nodeX(i), nodeZ(j), x, z);
         if (d < bestD) {
            bestD = d;
            best = i * FLOOD_N + j;
         }
      }
   }
   return best;
}

/** Test-side reachability: grid distance from the start pad over a free mask (5 cm off the squares). */
const isStartNode = (x: number, z: number) => dist(x, z, START_PAD.x, START_PAD.z) < 1e-9;
const FROM_START = FREE.map((free) => distanceField(free, isStartNode));

/** A node reached from the start pad lies within the reach of (x, z) (the 9 x 9 nodes around it cover 0.8). */
function reachedOn(field: Float64Array, x: number, z: number): boolean {
   const ci = Math.round(x / FLOOD_STEP + MID);
   const cj = Math.round(z / FLOOD_STEP + MID);
   for (let i = Math.max(0, ci - 4); i <= Math.min(FLOOD_N - 1, ci + 4); i++) {
      for (let j = Math.max(0, cj - 4); j <= Math.min(FLOOD_N - 1, cj + 4); j++) {
         if (field[i * FLOOD_N + j] < Infinity && dist(nodeX(i), nodeZ(j), x, z) <= PICKUP_REACH) return true;
      }
   }
   return false;
}

const reachableByTest = (map: number, x: number, z: number): boolean => reachedOn(FROM_START[map], x, z);

/**
 * Test-side check of the placement rules (own formulas, not isValidLayout): the sorted names of the
 * rules a layout's spots break. "pairPrev" is a clash with the piece just before it.
 */
function brokenRules(l: Layout, boxes: readonly AABB[], fromStart: Float64Array): string[] {
   const broken = new Set<string>();
   for (let i = 0; i < l.x.length; i++) {
      const x = l.x[i];
      const z = l.z[i];
      if (Math.abs(x) > SPAWN_HALF || Math.abs(z) > SPAWN_HALF) broken.add("box");
      if (Math.abs(x * 2 - Math.round(x * 2)) > 1e-9 || Math.abs(z * 2 - Math.round(z * 2)) > 1e-9) broken.add("grid");
      if (clearance(x, z, boxes) < PROP_CLEARANCE - 1e-9) broken.add("clear");
      if (dist(x, z, START_PAD.x, START_PAD.z) < START_SPACING - 1e-9) broken.add("start");
      if (!reachedOn(fromStart, x, z)) broken.add("reach");
      for (let j = 0; j < i; j++) if (dist(x, z, l.x[j], l.z[j]) < PAIR_SPACING - 1e-9) broken.add(j === i - 1 ? "pairPrev" : "pair");
   }
   return [...broken].sort();
}

// ---------- bots ----------

interface Bot {
   next(run: CleanRun, dtMs: number): StepInput;
}

/**
 * Plays like a perfect player with no reaction time: walks the grid path at full speed to the
 * nearest remaining piece (straight-line nearest, grid path), aiming 0.1 inside the reach.
 */
function pathBot(): Bot {
   const input = createStepInput();
   const field = new Float64Array(N);
   let target = NONE;
   let map = NONE;
   return {
      next(run) {
         const r = run.runner;
         if (map !== run.map || target === NONE || !run.litter[target].active) {
            map = run.map;
            let best = Infinity;
            for (let i = 0; i < ITEMS_PER_MAP; i++) {
               const s = run.litter[i];
               if (!s.active) continue;
               const d = dist(s.x, s.z, r.x, r.z);
               if (d < best) {
                  best = d;
                  target = i;
               }
            }
            const t = run.litter[target];
            distanceField(FREE[map], (x, z) => dist(x, z, t.x, t.z) <= PICKUP_REACH - 0.1, field);
         }
         const t = run.litter[target];
         let aimX = t.x;
         let aimZ = t.z;
         const free = FREE[map];
         const n = nearestFree(free, r.x, r.z);
         if (n >= 0 && field[n] > 0 && field[n] < Infinity) {
            let m = n;
            for (let k = 0; k < 5 && field[m] > 0; k++) {
               const i = (m / FLOOD_N) | 0;
               const j = m % FLOOD_N;
               let next = m;
               for (const [di, dj] of STEPS8) {
                  if (!canStep(free, i, j, di, dj)) continue;
                  const c = (i + di) * FLOOD_N + (j + dj);
                  if (field[c] < field[next]) next = c;
               }
               if (next === m) break;
               m = next;
            }
            if (field[m] > 0) {
               aimX = nodeX((m / FLOOD_N) | 0);
               aimZ = nodeZ(m % FLOOD_N);
            }
         }
         const dx = aimX - r.x;
         const dz = aimZ - r.z;
         const len = Math.hypot(dx, dz);
         input.moveX = len > 1e-6 ? dx / len : 0;
         input.moveY = len > 1e-6 ? dz / len : 0;
         return input;
      },
   };
}

/** Adversarial: straight at the nearest piece through everything, with an over-long stick (x1.7). */
function straightBot(): Bot {
   const input = createStepInput();
   return {
      next(run) {
         const r = run.runner;
         let best = Infinity;
         let tx = 0;
         let tz = 0;
         for (const s of run.litter) {
            if (!s.active) continue;
            const d = dist(s.x, s.z, r.x, r.z);
            if (d < best) {
               best = d;
               tx = s.x;
               tz = s.z;
            }
         }
         const len = Math.hypot(tx - r.x, tz - r.z) || 1;
         input.moveX = ((tx - r.x) / len) * 1.7;
         input.moveY = ((tz - r.z) / len) * 1.7;
         return input;
      },
   };
}

/** Random driving with spikes: long sticks, NaN and Infinity now and then. */
function randomBot(seed: number): Bot {
   const rng = createRng(seed);
   const input = createStepInput();
   let angle = rng() * Math.PI * 2;
   let length = 1;
   return {
      next() {
         if (rng() < 0.05) {
            angle = rng() * Math.PI * 2;
            length = rng() < 0.2 ? 0 : 0.3 + rng() * 1.5;
         }
         const spike = rng();
         input.moveX = spike < 0.01 ? Number.NaN : Math.cos(angle) * length;
         input.moveY = spike > 0.99 ? Number.POSITIVE_INFINITY : Math.sin(angle) * length;
         return input;
      },
   };
}

/** Flips direction every frame (stick mashing). */
function jitterBot(): Bot {
   const input = createStepInput();
   let flip = 1;
   return {
      next() {
         flip = -flip;
         input.moveX = flip;
         input.moveY = -flip * 0.5;
         return input;
      },
   };
}

const idleBot = (): Bot => ({ next: () => IDLE });

/** Plays `bot` until the run has `k` pieces, then lets go of the stick. */
const untilCollected = (bot: Bot, k: number): Bot => ({ next: (run, dtMs) => (run.collected < k ? bot.next(run, dtMs) : IDLE) });

// ---------- a whole run, with every invariant checked at every step ----------

interface PlayResult {
   run: CleanRun;
   problems: string[];
   pickups: number;
   maps: number[];
}

function play(run: CleanRun, bot: Bot, nextDt: () => number): PlayResult {
   const problems: string[] = [];
   const fail = (what: string) => {
      if (problems.length < 10) problems.push(`seed ${run.seed} at ${run.simMs} ms: ${what}`);
   };
   const events = run.events;
   const slots = [...run.litter];
   const seenOnMap = new Set<number>();
   const maps = [run.map];
   let pickups = 0;
   for (let guard = 0; run.ended === null && guard < 200_000; guard++) {
      const dtMs = nextDt();
      const input = bot.next(run, dtMs);
      const fromX = run.runner.x;
      const fromZ = run.runner.z;
      const wasActive = run.litter.map((s) => s.active);
      const mapBefore = run.map;
      const ev = step(run, dtMs, input);
      if (ev !== events) fail("step returned another events object");
      if (run.litter.some((s, i) => s !== slots[i])) fail("a litter slot was replaced");
      if (ev.nextMap === NONE) {
         const moved = dist(fromX, fromZ, run.runner.x, run.runner.z);
         if (moved > (RUNNER.speed * run.stepMs) / 1000 + 1e-9) fail(`moved ${moved} in ${run.stepMs} ms`);
      }
      if (Math.abs(run.runner.x) > SPAWN_HALF + 1e-9 || Math.abs(run.runner.z) > SPAWN_HALF + 1e-9) fail("left the spawn box");
      if (clearance(run.runner.x, run.runner.z, BOXES[run.map]) < RUNNER.radius - 0.05) fail("inside an obstacle");
      if (ev.collected !== NONE) {
         pickups += 1;
         if (!wasActive[ev.collected]) fail(`collected inactive slot ${ev.collected}`);
         const key = mapBefore * 100 + ev.collected;
         if (seenOnMap.has(key)) fail(`slot ${ev.collected} collected twice on map ${mapBefore}`);
         seenOnMap.add(key);
      }
      if (ev.nextMap !== NONE) {
         maps.push(ev.nextMap);
         if (ev.nextMap !== mapBefore + 1 || !ev.mapCleared) fail(`map ${mapBefore} -> ${ev.nextMap}`);
         if (run.items !== 0 || run.litter.some((s) => !s.active)) fail("next map not fresh");
         if (run.runner.x !== START_PAD.x || run.runner.z !== START_PAD.z || run.runner.vx !== 0 || run.runner.vz !== 0) fail("runner not parked");
      }
      if (run.collected !== run.map * ITEMS_PER_MAP + run.items && run.ended !== "win") fail("counters");
      const s = run.score;
      if (s > 6000 || s * 1000 > 1000 * 1000 + 100 * run.simMs) fail(`score ${s} over the bound at ${run.simMs}`);
      if (run.ended === "win") {
         if (run.collected !== 60 || run.simMs < FASTEST_FINISH_MS) fail(`win with ${run.collected} at ${run.simMs}`);
         if (s !== runScore(60, true, DURATION_MS - run.simMs)) fail("win score");
      } else if (s !== LITTER_POINTS * run.collected) fail("score != 50 * collected");
   }
   if (pickups !== run.collected) problems.push(`seed ${run.seed}: pickups ${pickups} != collected ${run.collected}`);
   return { run, problems, pickups, maps };
}

/** Lower bound of the route on one layout: start leg + 19 x the smallest pair (README "Test plan"), and the MST variant. */
function routeBounds(layout: Layout): { chain: number; mst: number } {
   const { x, z } = layout;
   let nearestStart = Infinity;
   let minPair = Infinity;
   for (let i = 0; i < ITEMS_PER_MAP; i++) {
      nearestStart = Math.min(nearestStart, dist(x[i], z[i], START_PAD.x, START_PAD.z));
      for (let j = 0; j < i; j++) minPair = Math.min(minPair, dist(x[i], z[i], x[j], z[j]));
   }
   const chain = nearestStart - PICKUP_REACH + (ITEMS_PER_MAP - 1) * (minPair - 2 * PICKUP_REACH);
   // Prim's MST, reach subtracted on every edge
   const inTree = new Array<boolean>(ITEMS_PER_MAP).fill(false);
   const best = new Array<number>(ITEMS_PER_MAP).fill(Infinity);
   best[0] = 0;
   let mst = 0;
   for (let k = 0; k < ITEMS_PER_MAP; k++) {
      let u = -1;
      for (let i = 0; i < ITEMS_PER_MAP; i++) if (!inTree[i] && (u < 0 || best[i] < best[u])) u = i;
      inTree[u] = true;
      if (k > 0) mst += best[u] - 2 * PICKUP_REACH;
      for (let i = 0; i < ITEMS_PER_MAP; i++) if (!inTree[i]) best[i] = Math.min(best[i], dist(x[u], z[u], x[i], z[i]));
   }
   return { chain, mst: mst + nearestStart - PICKUP_REACH };
}

// ---------- tests ----------

describe("clean-city constants (golden)", () => {
   it("pins every number of README 'Constants'", () => {
      expect(DURATION_MS).toBe(240_000);
      expect(RUNNER).toEqual({ radius: 0.5, speed: 5, accel: 24, brake: 30, turnRate: 14 });
      expect(START_PAD).toEqual({ x: 0, z: 12, heading: Math.PI });
      expect([LITTER_RADIUS, PICKUP_REACH, PAIR_SPACING, START_SPACING, PROP_CLEARANCE]).toEqual([0.3, 0.8, 5.4, 4.0, 1.0]);
      expect(PICKUP_REACH).toBeCloseTo(RUNNER.radius + LITTER_RADIUS, 12);
      expect([FLOOR_HALF, SPAWN_HALF, SPAWN_GRID, MIN_CORRIDOR]).toEqual([14, 13.5, 0.5, 2.2]);
      expect([ITEMS_PER_MAP, MAP_COUNT, MAX_PASSES, PER_KIND]).toEqual([20, 3, 40, 5]);
      expect([LITTER_POINTS, BONUS_PER_SECOND, MAX_STEP_MS, FLOOD_STEP]).toEqual([50, 10, 50, 0.25]);
      expect(LITTER_KINDS).toEqual(["bottle", "paperBag", "tinCan", "banana"]);
      expect(MAP_SEED_MIX).toEqual([0x9e3779b9, 0x85ebca6b, 0xc2b2ae35]);
      expect([SPOT_N, FLOOD_N, NONE]).toEqual([55, 109, -1]);
      expect([BOUNDS.min.x, BOUNDS.max.x, BOUNDS.min.z, BOUNDS.max.z]).toEqual([-14, 14, -14, 14]);
      expect(createRunner()).toEqual({ x: 0, y: 0, z: 12, vx: 0, vz: 0, heading: Math.PI });
      expect(MAPS.map((m) => m.id)).toEqual(["park", "city", "beach"]);
   });

   it("pins the proof's numbers and recomputes them (README 'Server limits')", () => {
      expect(MAP_MIN_ROUTE).toBeCloseTo(75.4, 9);
      expect(GUARANTEED_MIN_ROUTE).toBeCloseTo(226.2, 9);
      expect(MAP_MIN_ROUTE).toBeCloseTo(START_SPACING - PICKUP_REACH + 19 * (PAIR_SPACING - 2 * PICKUP_REACH), 12);
      expect(FASTEST_FINISH_MS).toBe(45_190);
      expect(FASTEST_FINISH_MS).toBe(Math.round((226.2 / 5 - MAX_FRAME_DT) * 1000));
      expect(BEST_SCORE).toBe(4940);
      expect(BEST_SCORE).toBe(3000 + 10 * 194);
      expect(BREAK_EVEN_MS).toBe(40_000);
      // the break-even: 5000 against a cap of 5000 at 40.0 s; 39.9 s is the same bonus bucket and fails
      const winAt = (ms: number) => runScore(60, true, DURATION_MS - ms);
      expect(winAt(BREAK_EVEN_MS)).toBe(5000);
      expect(withinServerLimits(winAt(BREAK_EVEN_MS), BREAK_EVEN_MS)).toBe(true);
      expect(winAt(39_900)).toBe(5000);
      expect(withinServerLimits(winAt(39_900), 39_900)).toBe(false);
      // the earliest win: 4,940,000 <= 5,519,000
      expect(winAt(FASTEST_FINISH_MS)).toBe(BEST_SCORE);
      expect(BEST_SCORE * 1000).toBeLessThanOrEqual(1000 * 1000 + 100 * FASTEST_FINISH_MS);
      expect(1000 * 1000 + 100 * FASTEST_FINISH_MS - BEST_SCORE * 1000).toBe(579_000);
      // every win from 45.19 s to 240 s passes both limits and the cap is a no-op
      for (let ms = FASTEST_FINISH_MS; ms <= DURATION_MS; ms += 10) {
         const s = winAt(ms);
         if (!withinServerLimits(s, ms) || capScore(s, ms) !== s) throw new Error(`win at ${ms}: ${s}`);
      }
      // every time-up score passes; the earliest single pickup (route 3.2 at 5 u/s) passes
      for (let k = 0; k < 60; k++) {
         const s = runScore(k, false, 0);
         expect(withinServerLimits(s, DURATION_MS)).toBe(true);
         expect(capScore(s, DURATION_MS)).toBe(s);
      }
      expect(50 * 1000).toBeLessThanOrEqual(1000 * 1000 + 100 * ((START_SPACING - PICKUP_REACH) / RUNNER.speed) * 1000);
   });

   it("the scoring limits equal meta.ts, and the server check rounds like GameShell", () => {
      expect(cleanCityMeta.scoring).toEqual({
         kind: "points",
         maxScore: 6000,
         minDurationMs: 10000,
         maxDurationMs: 900000,
         base: 1000,
         maxPointsPerSec: 100,
         unitLabel: "pts",
         display: "int",
      });
      expect(withinServerLimits(6000, 900_000)).toBe(true);
      expect(withinServerLimits(6001, 900_000)).toBe(false);
      expect(withinServerLimits(2000, 10_000)).toBe(true);
      expect(withinServerLimits(2001, 10_000)).toBe(false);
      expect(withinServerLimits(0, 9_999)).toBe(false);
      expect(capScore(9000, 900_000)).toBe(6000);
      expect(capScore(5000, 39_900)).toBe(4990);
      expect(capScore(2000, 9_999.6)).toBe(2000);
   });
});

describe("clean-city scoring", () => {
   it("50 per piece; the bonus is 10 per full second left on a win only (README examples)", () => {
      expect(runScore(60, true, DURATION_MS - 45_190)).toBe(4940);
      expect(runScore(60, true, DURATION_MS - 90_000)).toBe(4500);
      expect(runScore(60, true, DURATION_MS - 180_000)).toBe(3600);
      expect(runScore(40, false, 100_000)).toBe(2000);
      expect(runScore(59, false, 0)).toBe(2950);
      expect(runScore(0, false, DURATION_MS)).toBe(0);
      // full seconds only
      expect([timeBonus(194_999), timeBonus(195_000), timeBonus(999), timeBonus(0), timeBonus(-5)]).toEqual([1940, 1950, 0, 0, 0]);
      expect(timeBonus(DURATION_MS)).toBe(2400);
      expect(runScore(60, true, DURATION_MS)).toBe(5400);
   });
});

describe("clean-city maps", () => {
   it("pins the obstacle configs (README table: kinds, counts and squares)", () => {
      expect(HALF).toEqual({
         bench: { halfX: 1.2, halfZ: 0.4 },
         tree: { halfX: 0.7, halfZ: 0.7 },
         bin: { halfX: 0.7, halfZ: 0.7 },
         building: { halfX: 1.6, halfZ: 1.6 },
         lamp: { halfX: 0.3, halfZ: 0.3 },
         palm: { halfX: 0.6, halfZ: 0.6 },
         pole: { halfX: 0.25, halfZ: 0.25 },
      });
      const rows = MAPS.map((m) => m.obstacles.map((o) => `${o.kind}@${o.x},${o.z}:${o.halfX}x${o.halfZ}`));
      expect(rows).toEqual([
         ["bench@-6,4:1.2x0.4", "bench@6,4:1.2x0.4", "bench@0,-6:1.2x0.4", "tree@-7,-7:0.7x0.7", "tree@7,-7:0.7x0.7", "bin@9,10:0.7x0.7"],
         [
            "building@-7,-6:1.6x1.6", "building@7,-6:1.6x1.6", "building@-7,4:1.6x1.6", "building@7,4:1.6x1.6",
            "lamp@-3,-1:0.3x0.3", "lamp@3,-1:0.3x0.3", "lamp@-3,8:0.3x0.3", "lamp@3,8:0.3x0.3",
            "bin@0,-10:0.7x0.7", "bin@-11,-1:0.7x0.7",
         ],
         [
            "palm@-8,-8:0.6x0.6", "palm@8,-8:0.6x0.6", "palm@-9,3:0.6x0.6", "palm@9,3:0.6x0.6",
            "pole@-4,-2:0.25x0.25", "pole@4,-2:0.25x0.25", "pole@0,5:0.25x0.25", "bin@0,-11:0.7x0.7",
         ],
      ]);
      expect(MAPS.map((m) => m.ground)).toEqual(["#4d9a4a", "#8b929c", "#e9d29a"]);
   });

   it("obstacles leave corridors of at least 2.2 to each other and to the floor edge; the start pad is free", () => {
      for (let map = 0; map < MAP_COUNT; map++) {
         const boxes = BOXES[map];
         let narrowest = Infinity;
         for (let a = 0; a < boxes.length; a++) {
            for (let b = a + 1; b < boxes.length; b++) narrowest = Math.min(narrowest, boxGap(boxes[a], boxes[b]));
            const b = boxes[a];
            narrowest = Math.min(narrowest, FLOOR_HALF - b.max.x, b.min.x + FLOOR_HALF, FLOOR_HALF - b.max.z, b.min.z + FLOOR_HALF);
         }
         expect(narrowest, MAPS[map].id).toBeGreaterThanOrEqual(MIN_CORRIDOR);
         expect(clearance(START_PAD.x, START_PAD.z, boxes)).toBeGreaterThan(RUNNER.radius + 1);
         expect(acceptsCentre(CACHES[map].obstacles, START_PAD.x, START_PAD.z)).toBe(true);
         expect(CACHES[map].obstacles).toEqual(boxes);
      }
   });

   it("caches: clear spots on the 0.5 grid inside 13.5, the same squares as collision, reachable from the pad", () => {
      expect(CACHES.map((c) => c.spots.length)).toEqual([2767, 2367, 2737]);
      for (let map = 0; map < MAP_COUNT; map++) {
         const cache = CACHES[map];
         const inCache = new Set(cache.spots);
         let clearCount = 0;
         let edgeSpots = 0;
         for (let s = 0; s < SPOT_N * SPOT_N; s++) {
            const x = spotX(s);
            const z = spotZ(s);
            expect(Math.abs(x)).toBeLessThanOrEqual(SPAWN_HALF);
            const clear = clearance(x, z, BOXES[map]) >= PROP_CLEARANCE - 1e-9;
            if (clear) clearCount += 1;
            // corridors are wide, so on these maps every clear spot is reachable: the cache is exactly the clear set
            if (inCache.has(s) !== clear) throw new Error(`map ${map} spot ${x},${z}: cache ${inCache.has(s)} clear ${clear}`);
            if (clear && (Math.abs(x) === SPAWN_HALF || Math.abs(z) === SPAWN_HALF)) edgeSpots += 1;
         }
         expect(clearCount).toBe(cache.spots.length);
         // the floor boundary is not an obstacle: spots on |x| or |z| = 13.5 are allowed
         expect(edgeSpots).toBeGreaterThan(150);
         // the test's own grid search agrees on a sample of cached spots
         for (let k = 0; k < cache.spots.length; k += 97) {
            const s = cache.spots[k];
            expect(reachableByTest(map, spotX(s), spotZ(s))).toBe(true);
         }
      }
   });

   it("the flood fill excludes a walled-in pocket, isValidLayout rejects an unreachable spot, and the clearance check and the flood fill use the obstacle squares", () => {
      // two walls close the corner x 10.2..13.5, z -13.5..-8.6 against the floor edge (the floor is the wall clamp)
      const walls: AABB[] = [
         { min: { x: 9.6, y: -10, z: -14 }, max: { x: 10.2, y: 10, z: -8 } },
         { min: { x: 9.6, y: -10, z: -8.6 }, max: { x: 14, y: 10, z: -8 } },
      ];
      const pocketBoxes = [...BOXES[0], ...walls];
      const pocket = buildMapCache(0, pocketBoxes);
      expect(isReachable(pocket, 13, -12.5)).toBe(false);
      expect(isReachable(CACHES[0], 13, -12.5)).toBe(true);
      expect(isClear(pocket.obstacles, 13, -12.5)).toBe(true);
      expect([...pocket.spots].some((s) => spotX(s) > 9 && spotZ(s) < -9)).toBe(false);
      expect(pocket.spots.length).toBe(2637);
      // the fallback has a piece at (13, -12.5), inside the pocket: valid on the park, unreachable with the walls.
      // The walls keep 1.0 clear of every other fallback piece, so reachability is the only rule the layout breaks
      // (test-side: own clearance and grid search over the pocket); without isValidLayout's reach check it would pass.
      const l = layoutOf(0, FALLBACK_SPOTS[0]);
      expect(l.x[17]).toBe(13);
      expect(l.z[17]).toBe(-12.5);
      expect(isValidLayout(l, CACHES[0])).toBe(true);
      expect(l.x.every((x, i) => isClear(pocket.obstacles, x, l.z[i]))).toBe(true);
      expect(l.x.every((x, i) => i === 17 || isReachable(pocket, x, l.z[i]))).toBe(true);
      const pocketField = distanceField(freeMask(pocketBoxes, 0.05), isStartNode);
      expect(brokenRules(l, pocketBoxes, pocketField)).toEqual(["reach"]);
      expect(isValidLayout(l, pocket)).toBe(false);
      // the tree at (-7, -7) is a square: its corner (-7.7, -7.7) blocks, a circle of r 0.7 would not
      const touch = -7.7 - 0.5 * Math.SQRT1_2;
      expect(acceptsCentre(BOXES[0], touch + 1e-6, touch + 1e-6)).toBe(false);
      expect(acceptsCentre(BOXES[0], touch - 1e-6, touch - 1e-6)).toBe(true);
      expect(dist(touch, touch, -7, -7)).toBeGreaterThan(0.7 + 0.5 + 0.2);
      const clear = -7.7 - 1.0 * Math.SQRT1_2;
      expect(isClear(BOXES[0], clear + 1e-6, clear + 1e-6)).toBe(false);
      expect(isClear(BOXES[0], clear - 1e-6, clear - 1e-6)).toBe(true);
   });
});

describe("clean-city layouts", () => {
   it("1000 seeds x 3 maps: valid, deterministic, never the fallback; the fallback itself is valid", () => {
      let fallback = 0;
      let invalid = 0;
      let maxPasses = 0;
      const problems: string[] = [];
      for (let seed = 0; seed < 1000; seed++) {
         for (let map = 0; map < MAP_COUNT; map++) {
            const l = generateLayout(seed, map, CACHES[map]);
            if (l.fallback) fallback += 1;
            if (!isValidLayout(l, CACHES[map])) invalid += 1;
            maxPasses = Math.max(maxPasses, l.passes);
            // test-side check of the placement rules (own formulas, reachability included)
            const broken = brokenRules(l, BOXES[map], FROM_START[map]);
            if (broken.length > 0) problems.push(`${seed}/${map}: ${broken.join(", ")}`);
         }
      }
      expect(problems.slice(0, 5)).toEqual([]);
      expect([fallback, invalid]).toEqual([0, 0]);
      expect(maxPasses).toBeLessThanOrEqual(8);
      for (let map = 0; map < MAP_COUNT; map++) {
         // README proof step 6: the fallback data keeps the same rules, checked by the test's own formulas too
         expect(brokenRules(layoutOf(map, FALLBACK_SPOTS[map]), BOXES[map], FROM_START[map]), MAPS[map].id).toEqual([]);
         expect(isValidLayout(layoutOf(map, FALLBACK_SPOTS[map]), CACHES[map])).toBe(true);
         expect(generateLayout(42, map, CACHES[map])).toEqual(generateLayout(42, map, CACHES[map]));
         expect(generateLayout(42, map)).toEqual(generateLayout(42, map, CACHES[map]));
      }
      expect(createRun(42).layouts).toEqual([0, 1, 2].map((map) => generateLayout(42, map, CACHES[map])));
      expect(generateLayout(2 ** 32 + 5, 1, CACHES[1])).toEqual({ ...generateLayout(5, 1, CACHES[1]), seed: 5 });
   });

   it("when all 40 passes fail, generateLayout returns that map's FALLBACK_SPOTS with five of each kind", () => {
      for (let map = 0; map < MAP_COUNT; map++) {
         // no spots left: every pass runs out before the first piece
         const l = generateLayout(77, map, { ...CACHES[map], spots: new Int32Array(0) });
         expect([l.fallback, l.passes, l.map, l.seed], MAPS[map].id).toEqual([true, 0, map, 77]);
         expect(l.x).toEqual(FALLBACK_SPOTS[map].map((s) => s[0]));
         expect(l.z).toEqual(FALLBACK_SPOTS[map].map((s) => s[1]));
         expect([0, 1, 2, 3].map((k) => l.kinds.filter((v) => v === k).length)).toEqual([PER_KIND, PER_KIND, PER_KIND, PER_KIND]);
         expect(isValidLayout(l, CACHES[map])).toBe(true);
      }
   });

   it("placement is the README procedure: uniform picks from the list still valid after every piece (independent restatement)", () => {
      for (let map = 0; map < MAP_COUNT; map++) {
         for (let seed = 0; seed < 60; seed++) {
            const rng = { s: layoutSeedFor(seed, map) };
            let xs: number[] = [];
            let zs: number[] = [];
            let passes = 0;
            for (let pass = 1; pass <= MAX_PASSES && xs.length < ITEMS_PER_MAP; pass++) {
               let list = [...CACHES[map].spots].filter((s) => dist(spotX(s), spotZ(s), START_PAD.x, START_PAD.z) >= START_SPACING - 1e-9);
               xs = [];
               zs = [];
               while (xs.length < ITEMS_PER_MAP && list.length > 0) {
                  const s = list[Math.floor(rngNext(rng) * list.length)];
                  xs.push(spotX(s));
                  zs.push(spotZ(s));
                  list = list.filter((o) => dist(spotX(o), spotZ(o), spotX(s), spotZ(s)) >= PAIR_SPACING - 1e-9);
               }
               passes = pass;
            }
            const kinds = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3];
            for (let i = kinds.length - 1; i > 0; i--) {
               const j = Math.floor(rngNext(rng) * (i + 1));
               [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
            }
            const l = generateLayout(seed, map, CACHES[map]);
            expect({ x: l.x, z: l.z, kinds: l.kinds, passes: l.passes }).toEqual({ x: xs, z: zs, kinds, passes });
         }
      }
   });

   it("golden layouts: the first five spots and the kinds of seeds 1 and 3141592653", () => {
      const golden = [1, 3141592653].map((seed) =>
         [0, 1, 2].map((map) => {
            const l = generateLayout(seed, map, CACHES[map]);
            return { spots: l.x.slice(0, 5).map((x, i) => [x, l.z[i]]), kinds: l.kinds.join("") };
         })
      );
      expect(golden).toEqual(GOLDEN_LAYOUTS);
      // the three maps use three streams of one seed
      const a = generateLayout(7, 0, CACHES[0]);
      const b = generateLayout(7, 2, CACHES[2]);
      expect(a.x.slice(0, 5)).not.toEqual(b.x.slice(0, 5));
      expect(layoutSeedFor(7, 1)).toBe((7 ^ 0x85ebca6b) >>> 0);
   });

   it("isValidLayout rejects a close pair, a piece near the pad, outside the box, off the grid, near a square, bad kinds (unreachable: the pocket test)", () => {
      const good = layoutOf(1, FALLBACK_SPOTS[1]);
      expect(isValidLayout(good, CACHES[1])).toBe(true);
      expect(brokenRules(good, BOXES[1], FROM_START[1])).toEqual([]);
      // each fixture moves one piece so that exactly one rule breaks (the test's own formulas say which),
      // so deleting that one check from isValidLayout lets the fixture through
      const move = (k: number, x: number, z: number) => (l: Layout) => ((l.x[k] = x), (l.z[k] = z));
      const oneRule: Array<[string, string, (l: Layout) => void]> = [
         // piece 2 is (-6, -12): 5.0 from the piece just before it (a check that skips the previous piece misses it)
         ["pair 5.0", "pairPrev", move(1, -11, -12)],
         ["3.5 from the pad", "start", move(4, 3.5, 12)],
         ["outside the spawn box", "box", move(0, -14, 12)],
         ["off the grid", "grid", (l) => (l.x[3] += 0.25)],
         // building (-7, -6) spans z -7.6..-4.4
         ["0.9 from a building", "clear", move(5, -7, -3.5)],
         // lamp (3, 8) spans x 2.7..3.3
         ["0.7 from a lamp", "clear", move(8, 2, 8)],
      ];
      for (const [what, rule, breakIt] of oneRule) {
         const l = cloneLayout(good);
         breakIt(l);
         expect(brokenRules(l, BOXES[1], FROM_START[1]), what).toEqual([rule]);
         expect(isValidLayout(l, CACHES[1]), what).toBe(false);
      }
      expect(dist(-11, -12, good.x[2], good.z[2])).toBeCloseTo(5, 12);
      expect(dist(3.5, 12, START_PAD.x, START_PAD.z)).toBeCloseTo(3.5, 12);
      expect(clearance(-7, -3.5, BOXES[1])).toBeCloseTo(0.9, 12);
      expect(clearance(2, 8, BOXES[1])).toBeCloseTo(0.7, 12);
      const bad: Array<[string, (l: Layout) => void]> = [
         ["19 pieces", (l) => (l.x.pop(), l.z.pop())],
         ["six bottles", (l) => (l.kinds[19] = 0)],
         ["kind 4", (l) => (l.kinds[0] = 4)],
         ["NaN", (l) => (l.z[2] = Number.NaN)],
         ["another map's cache", (l) => (l.map = 0)],
      ];
      for (const [what, breakIt] of bad) {
         const l = cloneLayout(good);
         breakIt(l);
         expect(isValidLayout(l, CACHES[1]), what).toBe(false);
      }
      // the edges themselves are allowed: exactly 1.0 from a square, exactly 5.4 apart, exactly 4.0 from the pad
      expect(isClear(BOXES[1], -7 + 1.6 + 1.0, -6)).toBe(true);
      expect(isClear(BOXES[1], -7 + 1.6 + 0.5, -6)).toBe(false);
      // (5.4 apart and 4.0 from the pad: the route test finds both edges in generated, valid layouts)
   });

   it("route lower bound: every layout of 1000 seeds x 3 maps is >= 75.4 per map and >= 226.2 per run", () => {
      let worstMap = Infinity;
      let worstRun = Infinity;
      let worstMst = Infinity;
      let minPair = Infinity;
      let minStart = Infinity;
      for (let seed = 0; seed < 1000; seed++) {
         let run = 0;
         for (let map = 0; map < MAP_COUNT; map++) {
            const l = generateLayout(seed, map, CACHES[map]);
            for (let i = 0; i < ITEMS_PER_MAP; i++) {
               minStart = Math.min(minStart, dist(l.x[i], l.z[i], START_PAD.x, START_PAD.z));
               for (let j = 0; j < i; j++) minPair = Math.min(minPair, dist(l.x[i], l.z[i], l.x[j], l.z[j]));
            }
            const { chain, mst } = routeBounds(l);
            worstMap = Math.min(worstMap, chain);
            worstMst = Math.min(worstMst, mst);
            run += chain;
         }
         worstRun = Math.min(worstRun, run);
      }
      expect(worstMap).toBeGreaterThanOrEqual(MAP_MIN_ROUTE - 1e-9);
      expect(worstMst).toBeGreaterThanOrEqual(MAP_MIN_ROUTE - 1e-9);
      expect(worstRun).toBeGreaterThanOrEqual(GUARANTEED_MIN_ROUTE - 1e-9);
      // on the 0.5 grid no pair is exactly 5.4 apart: the closest allowed is (3, 4.5) = √29.25 = 5.408, and it occurs;
      // a piece exactly 4.0 from the pad is allowed and occurs
      expect(minPair).toBeCloseTo(Math.sqrt(29.25), 9);
      expect(minStart).toBeCloseTo(START_SPACING, 9);
   });
});

describe("clean-city movement", () => {
   const open: AABB[] = [];

   it("top speed is exactly 5; diagonals are not faster; half a stick is half speed", () => {
      const r = createRunner();
      r.x = -12;
      r.z = 10;
      for (let i = 0; i < 40; i++) stepRunner(r, 0, -1, 1 / 60, open);
      expect(Math.hypot(r.vx, r.vz)).toBeCloseTo(5, 9);
      const d = createRunner();
      d.x = -12;
      d.z = 10;
      for (let i = 0; i < 40; i++) stepRunner(d, 1, -1, 1 / 60, open);
      expect(Math.hypot(d.vx, d.vz)).toBeCloseTo(5, 9);
      expect(d.vx).toBeCloseTo(-d.vz, 9);
      const h = createRunner();
      h.x = -12;
      h.z = 10;
      for (let i = 0; i < 40; i++) stepRunner(h, 0.5, 0, 1 / 60, open);
      expect(h.vx).toBeCloseTo(2.5, 9);
   });

   it("accelerates at 24 u/s² and brakes to a stop at 30 u/s²", () => {
      const r = createRunner();
      stepRunner(r, 0, -1, 1 / 60, open);
      expect(Math.hypot(r.vx, r.vz)).toBeCloseTo(24 / 60, 9);
      for (let i = 0; i < 20; i++) stepRunner(r, 0, -1, 1 / 60, open);
      expect(r.vz).toBeCloseTo(-5, 9);
      stepRunner(r, 0, 0, 1 / 60, open);
      expect(r.vz).toBeCloseTo(-5 + 30 / 60, 9);
      for (let i = 0; i < 12; i++) stepRunner(r, 0, 0, 1 / 60, open);
      expect(Math.hypot(r.vx, r.vz)).toBe(0);
      // a small stick (0.3) still accelerates at 24 u/s², not at the brake rate
      const small = createRunner();
      small.x = -12;
      small.z = 10;
      stepRunner(small, 0.3, 0, 1 / 60, open);
      expect(Math.hypot(small.vx, small.vz)).toBeCloseTo(24 / 60, 9);
   });

   it("an input longer than 1 is normalised: a diagonal into a wall slides at speed · √½", () => {
      // pressed into the +x wall, the (1, 1) stick wants (5√½, 5√½); without normalising it would slide at 5
      const r = createRunner();
      r.x = 13.5;
      r.z = -13;
      for (let i = 0; i < 120; i++) stepRunner(r, 1, 1, 1 / 60, open);
      expect(r.x).toBeCloseTo(SPAWN_HALF, 9);
      expect(r.vx).toBeCloseTo(0, 9);
      expect(r.vz).toBeCloseTo(RUNNER.speed * Math.SQRT1_2, 4);
   });

   it("stops at a building and a bench and slides along them", () => {
      const city = BOXES[1];
      // building (7, 4): x 5.4..8.6, z 2.4..5.6; walk +x into its left face
      const r = createRunner();
      r.x = 3;
      r.z = 4;
      for (let i = 0; i < 90; i++) stepRunner(r, 1, 0, 1 / 60, city);
      expect(r.x).toBeCloseTo(5.4 - 0.5, 9);
      expect(r.vx).toBeCloseTo(0, 9);
      const z0 = r.z;
      for (let i = 0; i < 10; i++) stepRunner(r, 1, 1, 1 / 60, city);
      expect(r.z).toBeGreaterThan(z0 + 0.2);
      expect(r.x).toBeCloseTo(4.9, 9);
      // bench (0, -6): z -6.4..-5.6; walk -z onto its top edge
      const b = createRunner();
      b.x = 0;
      b.z = -2;
      for (let i = 0; i < 90; i++) stepRunner(b, 0, -1, 1 / 60, BOXES[0]);
      expect(b.z).toBeCloseTo(-5.6 + 0.5, 9);
      expect(b.vz).toBeCloseTo(0, 9);
   });

   it("a tree, a lamp, a palm and an umbrella pole block as squares (diagonal stop at the corner)", () => {
      for (const [map, ox, oz, half] of [
         [0, -7, -7, 0.7],
         [1, -3, -1, 0.3],
         [2, 9, 3, 0.6],
         [2, -4, -2, 0.25],
      ] as const) {
         const r = createRunner();
         r.x = ox + half + 2;
         r.z = oz + half + 2;
         for (let i = 0; i < 120; i++) stepRunner(r, -1, -1, 1 / 60, BOXES[map]);
         // it rests touching the square's corner: half · √2 + 0.5 from the centre; a circle of r = half would stop it at half + 0.5
         expect(dist(r.x, r.z, ox + half, oz + half)).toBeCloseTo(0.5, 6);
         expect(dist(r.x, r.z, ox, oz)).toBeCloseTo(half * Math.SQRT2 + 0.5, 6);
      }
   });

   it("20,000 random steps never move faster than 5 · dt, never enter a square, never leave the spawn box", () => {
      const rng = createRng(99);
      let worst = 0;
      let closest = Infinity;
      let farthestOut = -Infinity;
      for (let map = 0; map < MAP_COUNT; map++) {
         const r = createRunner();
         let angle = 0;
         let len = 1;
         for (let k = 0; k < 6_700; k++) {
            if (rng() < 0.08) {
               angle = rng() * Math.PI * 2;
               len = rng() * 1.6;
            }
            const dt = rng() < 0.1 ? MAX_STEP_MS / 1000 : (1 + rng() * 49) / 1000;
            const fx = r.x;
            const fz = r.z;
            stepRunner(r, Math.cos(angle) * len, Math.sin(angle) * len, dt, BOXES[map]);
            worst = Math.max(worst, dist(fx, fz, r.x, r.z) / (RUNNER.speed * dt));
            closest = Math.min(closest, clearance(r.x, r.z, BOXES[map]));
            farthestOut = Math.max(farthestOut, Math.abs(r.x) - SPAWN_HALF, Math.abs(r.z) - SPAWN_HALF);
         }
      }
      expect(worst).toBeLessThanOrEqual(1 + 1e-9);
      expect(worst).toBeGreaterThan(0.99);
      expect(closest).toBeGreaterThan(RUNNER.radius - 0.05);
      expect(farthestOut).toBeLessThanOrEqual(1e-9);
   });

   it("dt <= 0 does nothing; step ignores input that is not finite; the runner turns to face its way", () => {
      const r = createRunner();
      for (const dt of [0, -1, Number.NaN]) stepRunner(r, 1, 0, dt, open);
      expect(r).toEqual(createRunner());
      const run = createRun(3);
      const before = JSON.stringify(run);
      for (const dt of [0, -16, Number.NaN]) step(run, dt, { moveX: 1, moveY: 0 });
      expect(JSON.stringify(run)).toBe(before);
      // ... not even a pickup: standing on a piece, a zero, negative or NaN step collects nothing
      for (const dt of [0, -16, Number.NaN]) {
         const onPiece = createRun(3);
         const slot = onPiece.litter[0];
         place(onPiece, slot.x, slot.z);
         const ev = step(onPiece, dt, IDLE);
         expect([ev.collected, slot.active, onPiece.score, onPiece.collected], `${dt}`).toEqual([NONE, true, 0, 0]);
      }
      const still = createRun(3);
      for (let i = 0; i < 10; i++) step(still, 16, { moveX: Number.NaN, moveY: Number.POSITIVE_INFINITY });
      expect([still.runner.x, still.runner.z, still.simMs]).toEqual([0, 12, 160]);
      r.x = -12;
      for (let i = 0; i < 60; i++) stepRunner(r, 1, 0, 1 / 60, open);
      expect(r.heading).toBeCloseTo(Math.PI / 2, 3);
   });
});

describe("clean-city pickups and map changes", () => {
   it("collects at exactly 0.8, not at 0.81, and only active slots", () => {
      const run = createRun(5);
      const slot = run.litter[0];
      for (const [d, collects] of [[0.8, true], [0.81, false]] as const) {
         const r = createRun(5);
         const s = r.litter[0];
         place(r, s.x + d, s.z);
         const ev = step(r, 1, IDLE);
         expect(ev.collected, `${d}`).toBe(collects ? 0 : NONE);
         expect([r.items, r.collected, r.score, s.active]).toEqual(collects ? [1, 1, 50, false] : [0, 0, 0, true]);
      }
      expect(inReach({ x: slot.x + 0.8 * Math.SQRT1_2, y: 0, z: slot.z + 0.8 * Math.SQRT1_2 }, slot)).toBe(true);
      // standing on a collected slot collects nothing again
      place(run, slot.x, slot.z);
      expect(step(run, 1, IDLE).collected).toBe(0);
      for (let i = 0; i < 5; i++) expect(step(run, 16, IDLE).collected).toBe(NONE);
      expect([run.items, run.collected, run.score]).toEqual([1, 1, 50]);
   });

   it("a step moves first, then collects (README order: clock, move, pickup)", () => {
      const run = createRun(5);
      // a piece with open floor 0.85 to its right and no other piece near
      const k = run.litter.findIndex(
         (s) =>
            s.x + 0.85 <= SPAWN_HALF &&
            clearance(s.x + 0.85, s.z, BOXES[0]) > 1.5 &&
            run.litter.every((o) => o === s || dist(o.x, o.z, s.x + 0.85, s.z) > 2)
      );
      expect(k).toBeGreaterThanOrEqual(0);
      const s = run.litter[k];
      // 0.85 away at full speed towards it: out of reach before the move, 0.77 after 16 ms of it
      place(run, s.x + 0.85, s.z);
      run.runner.vx = -RUNNER.speed;
      const ev = step(run, 16, { moveX: -1, moveY: 0 });
      expect(dist(run.runner.x, run.runner.z, s.x, s.z)).toBeCloseTo(0.85 - RUNNER.speed * 0.016, 9);
      expect([ev.collected, s.active, run.collected]).toEqual([k, false, 1]);
   });

   it("only the current map's pieces count: standing on a map-2 spot during map 1 collects nothing", () => {
      const run = createRun(11);
      const l2 = run.layouts[1];
      let k = -1;
      for (let i = 0; i < ITEMS_PER_MAP && k < 0; i++) {
         if (run.litter.every((s) => dist(s.x, s.z, l2.x[i], l2.z[i]) > 1.7)) k = i;
      }
      expect(k).toBeGreaterThanOrEqual(0);
      place(run, l2.x[k], l2.z[k]);
      expect(step(run, 1, IDLE).collected).toBe(NONE);
      expect(run.collected).toBe(0);
   });

   it("the 20th piece writes the next layout into the same slots, parks the runner, and collects nothing else that step", () => {
      const run = createRun(21);
      const slots = [...run.litter];
      // rig: the next map's piece 0 sits on the start pad, so a missing 'nothing else this step' rule would collect it
      // (slot 0 is the last piece, so the pickup loop would still visit slot 5 after the swap)
      run.layouts[1].x[5] = START_PAD.x;
      run.layouts[1].z[5] = START_PAD.z;
      for (let i = 1; i < ITEMS_PER_MAP; i++) run.litter[i].active = false;
      run.items = 19;
      run.collected = 19;
      run.score = 950;
      const last = run.litter[0];
      place(run, last.x, last.z);
      run.runner.vx = 3;
      const ev: StepEvents = { ...step(run, 16, IDLE) };
      expect(ev).toEqual({ collected: 0, mapCleared: true, nextMap: 1, ended: null });
      expect(run.litter.every((s, i) => s === slots[i])).toBe(true);
      expect(run.map).toBe(1);
      expect([run.items, run.collected, run.score]).toEqual([0, 20, 1000]);
      expect(run.litter.map((s) => [s.x, s.z, s.kind, s.active])).toEqual(run.layouts[1].x.map((x, i) => [x, run.layouts[1].z[i], run.layouts[1].kinds[i], true]));
      expect(run.runner).toMatchObject({ x: START_PAD.x, z: START_PAD.z, vx: 0, vz: 0, heading: START_PAD.heading });
      // the rigged piece is collected on the next step, not the swap step
      expect(run.litter[5].active).toBe(true);
      expect(step(run, 16, IDLE).collected).toBe(5);
   });

   it("map 3's 20th piece ends the run with 'win' and the time bonus; later steps change nothing", () => {
      // the README's 90 s win, and one a ms later: that step crosses the 150 s-left line, so the bonus is
      // taken from the time left after the step (149.999 s: 1490), not before it (150.015 s: 1500)
      for (const [wonAt, score] of [[90_000, 4500], [90_001, 4490]] as const) {
         const run = createRun(8);
         run.map = 2;
         for (let i = 0; i < ITEMS_PER_MAP; i++) {
            run.litter[i].x = run.layouts[2].x[i];
            run.litter[i].z = run.layouts[2].z[i];
            run.litter[i].active = i === 19;
         }
         run.items = 19;
         run.collected = 59;
         run.score = 2950;
         run.simMs = wonAt - 16;
         place(run, run.litter[19].x, run.litter[19].z);
         const ev = { ...step(run, 16, IDLE) };
         expect(ev, `${wonAt}`).toEqual({ collected: 19, mapCleared: true, nextMap: NONE, ended: "win" });
         expect([run.ended, run.wonAtMs, run.collected, run.score]).toEqual(["win", wonAt, 60, score]);
         expect(run.score).toBe(runScore(60, true, DURATION_MS - wonAt));
         const { events: _e, ...after } = run;
         expect(step(run, 16, { moveX: 1, moveY: 0 })).toEqual({ collected: NONE, mapCleared: false, nextMap: NONE, ended: null });
         const { events: _e2, ...now } = run;
         expect(JSON.stringify(now)).toBe(JSON.stringify(after));
      }
   });

   it("the step that reaches 240 s ends the run first: the last piece on that step is not collected", () => {
      const run = createRun(8);
      run.map = 2;
      run.items = 19;
      run.collected = 59;
      run.score = 2950;
      for (let i = 0; i < 19; i++) run.litter[i].active = false;
      place(run, run.litter[19].x, run.litter[19].z);
      run.simMs = DURATION_MS - 10;
      const ev = step(run, 16, IDLE);
      expect(ev.ended).toBe("timeup");
      expect([ev.collected, run.collected, run.score, run.simMs, run.stepMs]).toEqual([NONE, 59, 2950, DURATION_MS, 10]);
      expect(withinServerLimits(run.score, DURATION_MS)).toBe(true);
   });

   it("an idle runner times out with 0 at exactly 240000 ms", () => {
      const result = play(createRun(1), idleBot(), fixed(16.7));
      expect(result.run).toMatchObject({ score: 0, simMs: DURATION_MS, ended: "timeup", collected: 0, map: 0 });
      expect(result.problems).toEqual([]);
   });
});

describe("clean-city bots and the scoring bound", () => {
   const best = { ms: Infinity, score: 0 };

   it("a perfect bot wins every seed at every frame pattern; score <= 6000 and <= 1000 + 100 t all the way", () => {
      const problems: string[] = [];
      const finishes: number[] = [];
      for (let seed = 0; seed < 12; seed++) {
         const pattern = PATTERNS[seed % PATTERNS.length];
         const result = play(createRun(seed), pathBot(), pattern.make(seed));
         problems.push(...result.problems);
         const { run } = result;
         expect(run.ended, `seed ${seed} ${pattern.name}`).toBe("win");
         expect(result.maps).toEqual([0, 1, 2]);
         expect(run.collected).toBe(60);
         expect(run.wonAtMs).toBeGreaterThanOrEqual(FASTEST_FINISH_MS);
         expect(withinServerLimits(run.score, run.wonAtMs)).toBe(true);
         expect(capScore(run.score, run.wonAtMs)).toBe(run.score);
         finishes.push(run.wonAtMs);
         if (run.wonAtMs < best.ms) best.ms = run.wonAtMs;
         best.score = Math.max(best.score, run.score);
      }
      expect(problems).toEqual([]);
      // the perfect bot is far above the straight-line bound (obstacles, nearest-first order)
      expect(Math.min(...finishes)).toBeGreaterThan(FASTEST_FINISH_MS + 5_000);
      expect(Math.max(...finishes)).toBeLessThan(120_000);
      expect(best.score).toBeLessThan(BEST_SCORE);
      console.info(`clean-city perfect bot: best win ${best.ms} ms, best score ${best.score}`);
   }, 120_000);

   it("adversarial bots (straight-through, random with NaN, jitter, idle) never break a bound on 160 runs", () => {
      const problems: string[] = [];
      let wins = 0;
      let maxCollected = 0;
      for (let seed = 0; seed < 160; seed++) {
         const pattern = PATTERNS[seed % PATTERNS.length];
         const kind = Math.floor(seed / 4) % 4;
         const bot = kind === 0 ? straightBot() : kind === 1 ? randomBot(seed) : kind === 2 ? jitterBot() : idleBot();
         const result = play(createRun(1000 + seed), bot, pattern.make(seed));
         problems.push(...result.problems);
         const { run } = result;
         if (run.ended === "win") wins += 1;
         else {
            expect(run.ended).toBe("timeup");
            expect(run.simMs).toBe(DURATION_MS);
            expect(run.score).toBe(50 * run.collected);
         }
         expect(withinServerLimits(run.score, run.ended === "win" ? run.wonAtMs : DURATION_MS)).toBe(true);
         maxCollected = Math.max(maxCollected, run.collected);
      }
      expect(problems).toEqual([]);
      // the straight bot collects plenty (it slides around obstacles), so the checks really ran
      expect(maxCollected).toBeGreaterThan(20);
      expect(wins).toBeLessThan(160);
   }, 120_000);
});

describe("clean-city frame-rate independence", () => {
   it("the integer clock never runs ahead of the dts and lags them by less than 1 ms; 240 s ends exactly", () => {
      for (const pattern of PATTERNS) {
         const run = createRun(2);
         const next = pattern.make(5);
         let sum = 0;
         for (let guard = 0; run.ended === null && guard < MAX_LOOP; guard++) {
            const dt = next();
            const before = run.simMs;
            step(run, dt, IDLE);
            sum += Math.min(dt, MAX_STEP_MS);
            if (run.ended) break;
            expect(Number.isInteger(run.simMs)).toBe(true);
            expect(run.simMs).toBeLessThanOrEqual(sum + 1e-6);
            expect(run.simMs).toBeGreaterThan(sum - 1 - 1e-6);
            expect(run.stepMs).toBe(run.simMs - before);
         }
         expect(run.simMs).toBe(DURATION_MS);
      }
      const run = createRun(2);
      expect(advanceClock(run, 300)).toBe(MAX_STEP_MS);
      expect(advanceClock(run, 0.4)).toBe(0);
      expect(advanceClock(run, 0.7)).toBe(1);
      expect(run.carry).toBeCloseTo(0.1, 9);
   });

   it("the runner moves only for whole ms; driving 1 s goes as far at every pattern", () => {
      const run = createRun(8);
      let still = 0;
      for (let i = 0; i < 400; i++) {
         const z0 = run.runner.z;
         step(run, 0.4, { moveX: 0, moveY: -1 });
         if (run.stepMs === 0) {
            still += 1;
            expect(run.runner.z).toBe(z0);
         }
      }
      expect(still).toBeGreaterThan(200);
      expect(run.simMs).toBe(160);
      const ends: number[] = [];
      for (const pattern of PATTERNS) {
         const r = createRun(31);
         place(r, -13, 13);
         const next = pattern.make(3);
         for (let guard = 0; r.simMs < 1000 && guard < MAX_LOOP; guard++) step(r, Math.min(next(), 1000 - r.simMs), { moveX: 1, moveY: 0 });
         expect(r.simMs).toBe(1000);
         ends.push(r.runner.x);
      }
      // 1 s from rest, exact: 0.521 in the 0.208 s of accelerating, then 3.958 at top speed = 4.479.
      // Semi-implicit Euler gains at most accel · dt · t_acc / 2 = 0.125 at 50 ms, only while accelerating.
      const exact = RUNNER.speed - (RUNNER.speed * RUNNER.speed) / (2 * RUNNER.accel);
      expect(exact).toBeCloseTo(4.479, 3);
      for (const x of ends) {
         expect(x + 13).toBeGreaterThanOrEqual(exact);
         expect(x + 13).toBeLessThanOrEqual(exact + (RUNNER.accel * 0.05 * (RUNNER.speed / RUNNER.accel)) / 2 + 1e-9);
      }
      expect(ends[0] + 13).toBeCloseTo(4.499816, 6);
      expect(ends[2] + 13).toBeCloseTo(4.6, 6);
   });

   it("the perfect bot finishes within 5 % of its 16.7 ms time at 8.3 / 50 / random ms", () => {
      for (const seed of [100, 101]) {
         const base = play(createRun(seed), pathBot(), P_16.make(seed)).run.wonAtMs;
         for (const pattern of [P_8, P_50, P_RANDOM]) {
            const t = play(createRun(seed), pathBot(), pattern.make(seed)).run.wonAtMs;
            // the bot re-plans per frame, so part of the spread is the bot, not the rules (see the 1 s drive above)
            expect(Math.abs(t - base) / base, `${seed} ${pattern.name}`).toBeLessThan(0.05);
         }
      }
   }, 120_000);

   it("no allocation proxies: step reuses the events object and never replaces the run's pools", () => {
      const run = createRun(9);
      const refs = [run.events, run.litter, run.runner, run.layouts, run.caches, ...run.litter, ...run.caches.map((c) => c.obstacles)];
      const result = play(run, pathBot(), fixed(16.7));
      expect(result.run.ended).toBe("win");
      const after = [run.events, run.litter, run.runner, run.layouts, run.caches, ...run.litter, ...run.caches.map((c) => c.obstacles)];
      refs.forEach((ref, k) => expect(after[k]).toBe(ref));
      expect(run.litter.length).toBe(ITEMS_PER_MAP);
   }, 60_000);
});

describe("clean-city real store parity", () => {
   it("the real store, driven like ShellStage: no untimed step, the clock never runs ahead, the Scene's publishing matches", () => {
      expect(FRAME_PRIORITY.clock).toBeLessThan(FRAME_PRIORITY.simulation);
      const store = createArcadeStore();
      store.getState().configure({ durationMs: DURATION_MS });
      store.getState().markReady();
      const rng = createRng(2026);
      let pausedFrames = 0;
      for (const [i, ending] of (["win", "timeup", "win"] as const).entries()) {
         if (store.getState().phase === "ready") store.getState().start();
         else store.getState().restart();
         const run = createRun(7000 + i);
         // the time-up run collects 25 pieces (5 on map 2) and then stands still, so its score is not 0 = 0
         const timeupPieces = 25;
         const bot = ending === "win" ? pathBot() : untilCollected(pathBot(), timeupPieces);
         store.getState().setStat("map", 1);
         store.getState().setStat("items", 0);
         let untimed = 0;
         let worstAhead = -Infinity;
         let worstBehind = -Infinity;
         let final = NONE;
         while (store.getState().phase !== "over") {
            const roll = rng();
            if (roll < 0.005) store.getState().pause();
            else if (roll < 0.02) store.getState().resume();
            const before = store.getState().elapsedMs;
            advanceRunClock(store, rng() < 0.1 ? 0.05 + rng() * 0.2 : 0.004 + rng() * 0.03);
            const dt = playedFrameDt(store.getState());
            if (store.getState().phase === "paused") pausedFrames += 1;
            if (dt === 0) continue;
            if (dt * 1000 > store.getState().elapsedMs - before + 1e-9) untimed += 1;
            // Scene: useRunFrame -> input -> step -> store
            const ev = step(run, dt * 1000, bot.next(run, dt * 1000));
            const s = store.getState();
            if (ev.collected !== NONE) {
               s.addScore(LITTER_POINTS);
               s.setStat("items", run.items);
            }
            if (ev.nextMap !== NONE) s.setStat("map", ev.nextMap + 1);
            if (ev.ended === "win") {
               final = runScore(run.collected, true, s.timeLeftMs ?? 0);
               s.setScore(final);
               s.end("win");
            }
            const e = store.getState().elapsedMs;
            worstAhead = Math.max(worstAhead, run.simMs - e);
            worstBehind = Math.max(worstBehind, e - run.simMs);
         }
         const s = store.getState();
         expect(untimed).toBe(0);
         expect(worstAhead).toBeLessThanOrEqual(1e-6);
         expect(worstBehind).toBeLessThan(1);
         expect(s.stats.map).toBe(run.ended === "win" ? 3 : run.map + 1);
         if (ending === "win") {
            expect(s.endReason).toBe("win");
            expect(run.ended).toBe("win");
            // the store's time left is at most the rules' (simMs lags elapsedMs), so the Scene's score is never higher
            expect(final).toBeLessThanOrEqual(run.score);
            expect(run.score - final).toBeLessThanOrEqual(BONUS_PER_SECOND);
            expect(s.score).toBe(final);
            expect(withinServerLimits(s.score, s.elapsedMs)).toBe(true);
            expect(capScore(s.score, s.elapsedMs)).toBe(s.score);
            expect(s.elapsedMs).toBeGreaterThanOrEqual(FASTEST_FINISH_MS);
         } else {
            // the store's clock ends the run: the time-up frame is never handed to the rules
            expect(s.endReason).toBe("timeup");
            expect(s.elapsedMs).toBe(DURATION_MS);
            expect(run.ended).toBe(null);
            expect(run.simMs).toBeGreaterThan(DURATION_MS - MAX_FRAME_DT * 1000 - 1);
            expect([run.collected, run.map, run.items]).toEqual([timeupPieces, 1, timeupPieces - ITEMS_PER_MAP]);
            expect(run.score).toBe(LITTER_POINTS * timeupPieces);
            expect(s.score).toBe(run.score);
            expect(s.stats.items).toBe(run.items);
            expect(withinServerLimits(s.score, s.elapsedMs)).toBe(true);
         }
      }
      expect(pausedFrames).toBeGreaterThan(0);
   }, 120_000);
});

// ---------- golden values (from the first run of these rules; a change here is a design change) ----------

const GOLDEN_LAYOUTS: unknown = [
   [
      { spots: [[-9, -13], [-4, -10.5], [9, 4], [1, -2], [8.5, -4]], kinds: "13220132130300121320" },
      { spots: [[4.5, -11], [12.5, -8], [-13, -5.5], [13.5, 1.5], [-6.5, 10]], kinds: "02133201203312020311" },
      { spots: [[-13.5, 12.5], [6, 0], [-11, 6.5], [-10, -7.5], [8.5, 9]], kinds: "13322100123003132012" },
   ],
   [
      { spots: [[-0.5, 2], [-12.5, -12], [-11.5, 7.5], [-5.5, -9], [11.5, 4]], kinds: "21030112322120313300" },
      { spots: [[12, 9.5], [11.5, -13.5], [-7.5, -9], [7.5, -9.5], [-9.5, 6.5]], kinds: "23321102303120012130" },
      { spots: [[-3, -9.5], [7, -11], [10.5, -3.5], [-12.5, -10], [13, 5]], kinds: "31222211031003021033" },
   ],
];
