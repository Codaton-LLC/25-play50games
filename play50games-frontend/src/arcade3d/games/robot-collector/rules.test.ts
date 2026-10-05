import { describe, expect, it } from "vitest";
import { MAX_FRAME_DT } from "@/arcade3d/core/useRunFrame";
import { robotCollectorMeta } from "./meta";
import {
   ARENA,
   BATTERY_COUNT,
   BOUNDS,
   DURATION_MS,
   FALLBACK_SPOTS,
   GUARANTEED_MIN_ROUTE,
   IDEAL_ROUTE,
   OBSTACLES,
   PICKUP_REACH,
   ROBOT,
   ROBOT_START,
   SPACING,
   UNTIMED_MOVE_S,
   WAVE_COUNT,
   WAVE_SIZE,
   capScore,
   collectTouched,
   createProgress,
   createRng,
   createRobot,
   distanceToBox,
   fastestFinishMs,
   generateLayout,
   inputToWorld,
   isActive,
   isComplete,
   isSpawnPoint,
   isValidLayout,
   minCompletionMs,
   runScore,
   shortestRoute,
   spawnPoints,
   stepRobot,
   timeBonus,
   turnTowards,
   withinServerLimits,
   type Battery,
   type Layout,
   type RobotState,
} from "./rules";

const DT = 1 / 60;
const SEEDS = Array.from({ length: 1000 }, (_v, i) => i);
/** a few seeds like the Scene draws them (random 32-bit integers) */
const BIG_SEEDS = [2 ** 32 - 1, 123456789, 987654321, 3141592653, 2718281828];

const battery = (index: number, x: number, z: number): Battery => ({ index, wave: Math.floor(index / WAVE_SIZE), x, y: 0, z });
const layoutOf = (spots: ReadonlyArray<readonly [number, number]>): Layout => ({
   seed: 0,
   batteries: spots.map(([x, z], i) => battery(i, x, z)),
});
const fallback = () => layoutOf(FALLBACK_SPOTS);

/** The best possible win score if the run is won after `elapsedMs`. */
const winScoreAt = (elapsedMs: number) => runScore(BATTERY_COUNT, true, DURATION_MS - elapsedMs);

// ---------- a grid path finder for the simulated runs (test helper, not game code) ----------

const CELL = 0.25;
const NX = Math.round((2 * ARENA.halfX) / CELL) + 1;
const NZ = Math.round((2 * ARENA.halfZ) / CELL) + 1;
const nodeX = (i: number) => -ARENA.halfX + i * CELL;
const nodeZ = (j: number) => -ARENA.halfZ + j * CELL;
const free = new Uint8Array(NX * NZ);
for (let i = 0; i < NX; i++) {
   for (let j = 0; j < NZ; j++) {
      const x = nodeX(i);
      const z = nodeZ(j);
      const inside = Math.abs(x) <= ARENA.halfX - ROBOT.radius && Math.abs(z) <= ARENA.halfZ - ROBOT.radius;
      free[i * NZ + j] = inside && OBSTACLES.every((box) => distanceToBox(x, z, box) >= ROBOT.radius + 0.1) ? 1 : 0;
   }
}
const nodeOf = (x: number, z: number) => Math.round((x + ARENA.halfX) / CELL) * NZ + Math.round((z + ARENA.halfZ) / CELL);
const STEPS = [
   [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
   [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/** Dijkstra over free grid nodes. Returns the node path from `from` to `to` (empty = unreachable). */
function findPath(from: number, to: number): number[] {
   const cost = new Float64Array(NX * NZ).fill(Infinity);
   const prev = new Int32Array(NX * NZ).fill(-1);
   const heap: Array<[number, number]> = [[0, from]];
   cost[from] = 0;
   while (heap.length) {
      heap.sort((a, b) => b[0] - a[0]);
      const [c, n] = heap.pop()!;
      if (n === to) break;
      if (c > cost[n]) continue;
      const i = Math.floor(n / NZ);
      const j = n % NZ;
      for (const [di, dj, w] of STEPS) {
         const ni = i + di;
         const nj = j + dj;
         if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
         const m = ni * NZ + nj;
         // diagonal moves must not cut a blocked corner
         if (!free[m] || !free[ni * NZ + j] || !free[i * NZ + nj]) continue;
         if (c + w < cost[m]) {
            cost[m] = c + w;
            prev[m] = n;
            heap.push([cost[m], m]);
         }
      }
   }
   if (cost[to] === Infinity) return [];
   const path = [to];
   while (path[0] !== from) path.unshift(prev[path[0]]);
   return path;
}

/** Nearest free node to a point (the robot is never exactly on a node). */
function nearestFreeNode(x: number, z: number): number {
   let best = nodeOf(x, z);
   let bestD = Infinity;
   const ci = Math.round((x + ARENA.halfX) / CELL);
   const cj = Math.round((z + ARENA.halfZ) / CELL);
   for (let i = ci - 3; i <= ci + 3; i++) {
      for (let j = cj - 3; j <= cj + 3; j++) {
         if (i < 0 || j < 0 || i >= NX || j >= NZ || !free[i * NZ + j]) continue;
         const d = Math.hypot(nodeX(i) - x, nodeZ(j) - z);
         if (d < bestD) {
            bestD = d;
            best = i * NZ + j;
         }
      }
   }
   return best;
}

interface SimResult {
   won: boolean;
   elapsedMs: number;
   collected: number;
   maxStep: number;
}

/**
 * Plays one run like the game does, at 60 fps: the first frame (countdown -> playing) moves the
 * robot without advancing the clock, every later frame advances the clock first, then moves.
 */
function simulateRun(layout: Layout, steer: (robot: RobotState, target: Battery | null) => [number, number]): SimResult {
   const robot = createRobot();
   const progress = createProgress();
   let elapsed = 0;
   let maxStep = 0;
   for (let frame = 0; elapsed < DURATION_MS / 1000; frame++) {
      if (frame > 0) elapsed = Math.min(DURATION_MS / 1000, elapsed + DT);
      if (elapsed >= DURATION_MS / 1000) break;
      const active = layout.batteries.filter((b) => isActive(progress, b));
      const target = active.sort((a, b) => Math.hypot(a.x - robot.x, a.z - robot.z) - Math.hypot(b.x - robot.x, b.z - robot.z))[0] ?? null;
      const [dx, dz] = steer(robot, target);
      const fromX = robot.x;
      const fromZ = robot.z;
      stepRobot(robot, dx, dz, DT);
      maxStep = Math.max(maxStep, Math.hypot(robot.x - fromX, robot.z - fromZ));
      collectTouched(progress, layout, robot);
      if (isComplete(progress)) return { won: true, elapsedMs: elapsed * 1000, collected: progress.collected, maxStep };
   }
   return { won: false, elapsedMs: DURATION_MS, collected: progress.collected, maxStep };
}

/** A good driver: shortest grid path to the nearest active battery, steering at a point ahead. */
function pathDriver() {
   let path: number[] = [];
   let goal: Battery | null = null;
   let k = 0;
   return (robot: RobotState, target: Battery | null): [number, number] => {
      if (!target) return [0, 0];
      if (target !== goal) {
         goal = target;
         path = findPath(nearestFreeNode(robot.x, robot.z), nodeOf(target.x, target.z));
         k = 0;
      }
      while (k < path.length - 1 && Math.hypot(nodeX(Math.floor(path[k] / NZ)) - robot.x, nodeZ(path[k] % NZ) - robot.z) < 0.6) k++;
      const n = path[k] ?? nodeOf(target.x, target.z);
      const dx = nodeX(Math.floor(n / NZ)) - robot.x;
      const dz = nodeZ(n % NZ) - robot.z;
      const len = Math.hypot(dx, dz) || 1;
      return [dx / len, dz / len];
   };
}

// ---------- tests ----------

describe("robot-collector layouts", () => {
   it("are deterministic per seed and differ between seeds", () => {
      expect(generateLayout(42)).toEqual(generateLayout(42));
      expect(generateLayout(42).batteries).not.toEqual(generateLayout(43).batteries);
      const a = createRng(7);
      const b = createRng(7);
      for (let i = 0; i < 20; i++) expect(a()).toBe(b());
   });

   it("are always valid: 10 batteries, 5 waves of 2, spacing kept, inside the fairness band", () => {
      for (const seed of [...SEEDS, ...BIG_SEEDS]) {
         const layout = generateLayout(seed);
         expect(layout.seed).toBe(seed);
         expect(layout.batteries).toHaveLength(BATTERY_COUNT);
         expect(isValidLayout(layout)).toBe(true);
      }
      expect(isValidLayout(fallback())).toBe(true);
   });

   it("use random layouts, not the fallback", () => {
      const fallbacks = SEEDS.filter((seed) => {
         const spots = generateLayout(seed).batteries.map((b) => [b.x, b.z]);
         return JSON.stringify(spots) === JSON.stringify(FALLBACK_SPOTS);
      });
      // seed 13 happens to be where the fallback was copied from
      expect(fallbacks.length).toBeLessThanOrEqual(1);
   });

   it("isValidLayout rejects broken layouts", () => {
      const good = fallback().batteries.map((b) => [b.x, b.z] as [number, number]);
      expect(isValidLayout(layoutOf(good.slice(0, 9)))).toBe(false);
      // battery on top of the first crate
      expect(isValidLayout(layoutOf([[-9.6, -5.4], ...good.slice(1)]))).toBe(false);
      // first battery too close to the start
      expect(isValidLayout(layoutOf([[1, 1], ...good.slice(1)]))).toBe(false);
      // the two batteries of wave 0 too close together
      expect(isValidLayout(layoutOf([good[0], [good[0][0] + 2, good[0][1] + 2], ...good.slice(2)]))).toBe(false);
      // a wave-1 battery too close to wave 0
      expect(isValidLayout(layoutOf([good[0], good[1], [good[1][0], good[1][1] + 3], ...good.slice(3)]))).toBe(false);
   });

   it("every spawn point is reachable from the start (the warehouse has no closed pockets)", () => {
      const seen = new Uint8Array(NX * NZ);
      const queue = [nodeOf(ROBOT_START.x, ROBOT_START.z)];
      seen[queue[0]] = 1;
      while (queue.length) {
         const n = queue.pop()!;
         const i = Math.floor(n / NZ);
         const j = n % NZ;
         for (const [di, dj] of STEPS.slice(0, 4)) {
            const m = (i + di) * NZ + (j + dj);
            if (i + di < 0 || j + dj < 0 || i + di >= NX || j + dj >= NZ || seen[m] || !free[m]) continue;
            seen[m] = 1;
            queue.push(m);
         }
      }
      expect(spawnPoints().length).toBeGreaterThan(500);
      for (const p of spawnPoints()) {
         expect(isSpawnPoint(p.x, p.z)).toBe(true);
         expect(seen[nodeOf(p.x, p.z)]).toBe(1);
      }
   });

   it("shortestRoute equals a brute force over every collection order", () => {
      for (const seed of SEEDS.slice(0, 30)) {
         const layout = generateLayout(seed);
         for (const reach of [0, PICKUP_REACH]) {
            let best = Infinity;
            for (let mask = 0; mask < 2 ** WAVE_COUNT; mask++) {
               // bit w set = wave w collects its second battery first
               const order = layout.batteries.map((_b, i) => {
                  const w = Math.floor(i / WAVE_SIZE);
                  return (mask >> w) & 1 ? (i % 2 === 0 ? i + 1 : i - 1) : i;
               });
               let length = Math.max(0, Math.hypot(layout.batteries[order[0]].x - ROBOT_START.x, layout.batteries[order[0]].z - ROBOT_START.z) - reach);
               for (let k = 1; k < order.length; k++) {
                  const a = layout.batteries[order[k - 1]];
                  const b = layout.batteries[order[k]];
                  length += Math.max(0, Math.hypot(a.x - b.x, a.z - b.z) - 2 * reach);
               }
               best = Math.min(best, length);
            }
            expect(shortestRoute(layout, reach)).toBeCloseTo(best, 9);
         }
      }
   });
});

describe("robot-collector movement", () => {
   it("accelerates to top speed, never beyond, and diagonals are not faster", () => {
      // open floor: (-1, -3.5) heading right or down-right touches nothing for 30 frames
      const robot = createRobot();
      robot.z = -3.5;
      for (let i = 0; i < 30; i++) stepRobot(robot, 1, 0, DT);
      expect(Math.hypot(robot.vx, robot.vz)).toBeCloseTo(ROBOT.maxSpeed, 6);

      const diag = createRobot();
      diag.z = -3.5;
      for (let i = 0; i < 30; i++) stepRobot(diag, 1, 1, DT);
      expect(Math.hypot(diag.vx, diag.vz)).toBeCloseTo(ROBOT.maxSpeed, 6);
   });

   it("starts from rest and brakes to a stop", () => {
      const robot = createRobot();
      stepRobot(robot, 0, -1, DT);
      expect(Math.hypot(robot.vx, robot.vz)).toBeCloseTo(ROBOT.accel * DT, 6);
      for (let i = 0; i < 20; i++) stepRobot(robot, 0, -1, DT);
      for (let i = 0; i < 20; i++) stepRobot(robot, 0, 0, DT);
      expect(Math.hypot(robot.vx, robot.vz)).toBe(0);
   });

   it("is stopped by crates and walls, and slides along them", () => {
      // drive left into the middle crate column (x = -4.2, z = -1.8..0.6)
      const robot = createRobot();
      robot.x = -1;
      robot.z = -0.6;
      for (let i = 0; i < 120; i++) stepRobot(robot, -1, 0, DT);
      expect(robot.x).toBeCloseTo(-4.2 + 0.6 + ROBOT.radius, 6);
      expect(robot.vx).toBeCloseTo(0, 6);
      // pushing diagonally into it slides along its face
      const z0 = robot.z;
      for (let i = 0; i < 10; i++) stepRobot(robot, -1, -1, DT);
      expect(robot.z).toBeLessThan(z0 - 0.2);
      // the wall
      for (let i = 0; i < 400; i++) stepRobot(robot, 0, 1, DT);
      expect(robot.z).toBeCloseTo(ARENA.halfZ - ROBOT.radius, 6);
   });

   it("never moves faster than maxSpeed, never enters a prop, never leaves the floor (random input)", () => {
      const rng = createRng(99);
      const robot = createRobot();
      let worstSpeed = 0;
      let closestProp = Infinity;
      let farthestOut = -Infinity;
      // the input changes direction every 1-30 frames, so the robot also rubs along props and walls
      let angle = 0;
      for (let i = 0; i < 20000; i++) {
         if (rng() < 0.08) angle = rng() * Math.PI * 2;
         const dt = rng() < 0.1 ? MAX_FRAME_DT : DT * (0.25 + rng());
         const fromX = robot.x;
         const fromZ = robot.z;
         stepRobot(robot, Math.cos(angle) * 1.5, Math.sin(angle) * 1.5, dt);
         worstSpeed = Math.max(worstSpeed, Math.hypot(robot.x - fromX, robot.z - fromZ) / dt);
         for (const box of OBSTACLES) closestProp = Math.min(closestProp, distanceToBox(robot.x, robot.z, box));
         farthestOut = Math.max(farthestOut, Math.abs(robot.x) - BOUNDS.max.x, Math.abs(robot.z) - BOUNDS.max.z);
      }
      expect(worstSpeed).toBeLessThanOrEqual(ROBOT.maxSpeed + 1e-9);
      expect(closestProp).toBeGreaterThan(ROBOT.radius - 0.05);
      expect(farthestOut).toBeLessThanOrEqual(-ROBOT.radius + 1e-9);
   });

   it("ignores dt <= 0 and turns the short way round", () => {
      const robot = createRobot();
      stepRobot(robot, 1, 0, 0);
      stepRobot(robot, 1, 0, -1);
      expect([robot.x, robot.z, robot.vx]).toEqual([ROBOT_START.x, ROBOT_START.z, 0]);
      expect(turnTowards(3, -3, 1)).toBeCloseTo(-3 + 2 * Math.PI, 9);
      expect(turnTowards(0.1, -0.1, 0.5)).toBeCloseTo(0, 9);
   });

   it("maps screen input to the world for both camera yaws", () => {
      const out = { x: 0, z: 0 };
      // landscape camera (yaw 0): up = -z, right = +x
      inputToWorld(0, -1, 0, out);
      expect(out.x).toBeCloseTo(0, 9);
      expect(out.z).toBeCloseTo(-1, 9);
      inputToWorld(1, 0, 0, out);
      expect(out.x).toBeCloseTo(1, 9);
      expect(out.z).toBeCloseTo(0, 9);
      // portrait camera (yaw 90°, looking along -x): up = -x, right = -z
      inputToWorld(0, -1, Math.PI / 2, out);
      expect(out.x).toBeCloseTo(-1, 9);
      expect(out.z).toBeCloseTo(0, 9);
      inputToWorld(1, 0, Math.PI / 2, out);
      expect(out.x).toBeCloseTo(0, 9);
      expect(out.z).toBeCloseTo(-1, 9);
   });
});

describe("robot-collector pickups", () => {
   it("only the current wave can be collected; the next pair lights up after both", () => {
      const layout = generateLayout(5);
      const progress = createProgress();
      const [a, b, c] = layout.batteries;
      expect(isActive(progress, a) && isActive(progress, b)).toBe(true);
      expect(isActive(progress, c)).toBe(false);

      // standing on a wave-1 battery does nothing yet
      expect(collectTouched(progress, layout, { x: c.x, y: 0, z: c.z })).toBe(0);
      expect(collectTouched(progress, layout, { x: a.x + PICKUP_REACH - 0.01, y: 0, z: a.z })).toBe(1);
      expect(collectTouched(progress, layout, { x: a.x, y: 0, z: a.z })).toBe(0);
      expect(progress.wave).toBe(0);
      expect(collectTouched(progress, layout, { x: b.x, y: 0, z: b.z + PICKUP_REACH + 0.01 })).toBe(0);
      expect(collectTouched(progress, layout, { x: b.x, y: 0, z: b.z })).toBe(1);
      expect(progress.wave).toBe(1);
      expect(isActive(progress, c)).toBe(true);
      expect(progress.collected).toBe(2);
   });

   it("finishes after 10 and collects nothing more", () => {
      const layout = generateLayout(8);
      const progress = createProgress();
      for (const b of layout.batteries) collectTouched(progress, layout, b);
      expect(isComplete(progress)).toBe(true);
      expect(progress.wave).toBe(WAVE_COUNT);
      expect(collectTouched(progress, layout, layout.batteries[9])).toBe(0);
      expect(progress.collected).toBe(BATTERY_COUNT);
   });
});

describe("robot-collector scoring", () => {
   it("100 per battery, +10 per full second left on a win", () => {
      expect(timeBonus(42_999)).toBe(420);
      expect(timeBonus(999)).toBe(0);
      expect(timeBonus(-5)).toBe(0);
      expect(runScore(7, false, 30_000)).toBe(700);
      expect(runScore(10, true, 42_500)).toBe(1420);
      // time up: no bonus, whatever is on the clock
      expect(runScore(9, false, 0)).toBe(900);
   });

   it("matches the server limits in meta.ts", () => {
      expect(robotCollectorMeta.scoring).toMatchObject({
         kind: "points",
         maxScore: 1600,
         base: 600,
         maxPointsPerSec: 120,
         minDurationMs: 5000,
         maxDurationMs: 75000,
      });
      expect(withinServerLimits(1520, 7_700)).toBe(true);
      expect(withinServerLimits(1520, 7_600)).toBe(false);
      expect(withinServerLimits(1601, 70_000)).toBe(false);
      expect(withinServerLimits(100, 4_999)).toBe(false);
      expect(capScore(1520, 7_600)).toBe(1512);
      expect(capScore(5000, 70_000)).toBe(1600);
   });
});

describe("robot-collector scoring limit proof (README.md)", () => {
   it("the core does not count at most one frame of movement", () => {
      expect(UNTIMED_MOVE_S).toBe(MAX_FRAME_DT);
   });

   it("without the level design, a fast win would break the limit (break-even is about 7.67 s)", () => {
      expect(withinServerLimits(winScoreAt(7_600), 7_600)).toBe(false);
      expect(withinServerLimits(winScoreAt(7_700), 7_700)).toBe(true);
   });

   it("the spacing rules force a route of at least 45.8 units, i.e. a win no earlier than 9.11 s", () => {
      expect(GUARANTEED_MIN_ROUTE).toBeCloseTo(
         SPACING.fromStart - PICKUP_REACH + 5 * (SPACING.inWave - 2 * PICKUP_REACH) + 4 * (SPACING.betweenWaves - 2 * PICKUP_REACH),
         9
      );
      expect(GUARANTEED_MIN_ROUTE).toBeCloseTo(45.8, 9);
      expect(fastestFinishMs(GUARANTEED_MIN_ROUTE)).toBeCloseTo(9_110, 6);
   });

   it("every win at or after the guaranteed earliest finish is within the limits", () => {
      const earliest = Math.floor(fastestFinishMs(GUARANTEED_MIN_ROUTE));
      for (let t = earliest; t <= DURATION_MS; t += 10) {
         const score = winScoreAt(t);
         expect(withinServerLimits(score, t)).toBe(true);
         expect(capScore(score, t)).toBe(score);
      }
      // best case overall: 1500 at 9.11 s, under maxScore 1600 and the 1693-point cap
      expect(winScoreAt(earliest)).toBe(1500);
   });

   it("a time-up run is within the limits", () => {
      for (let collected = 0; collected < BATTERY_COUNT; collected++) {
         expect(withinServerLimits(runScore(collected, false, 0), DURATION_MS)).toBe(true);
      }
   });

   it("for every seeded layout, the fastest possible win is within the limits", () => {
      let fastest = Infinity;
      for (const seed of [...SEEDS, ...BIG_SEEDS]) {
         const layout = generateLayout(seed);
         const route = shortestRoute(layout, PICKUP_REACH);
         expect(route).toBeGreaterThanOrEqual(GUARANTEED_MIN_ROUTE - 1e-9);
         // the ideal route is the fairness band; the lower bound can only be shorter
         expect(shortestRoute(layout, 0)).toBeLessThanOrEqual(IDEAL_ROUTE.max + 1e-9);
         const minMs = minCompletionMs(layout);
         fastest = Math.min(fastest, minMs);
         expect(withinServerLimits(winScoreAt(Math.floor(minMs)), Math.floor(minMs))).toBe(true);
      }
      // real layouts are far above the break-even point (about 12 s in practice)
      expect(fastest).toBeGreaterThan(fastestFinishMs(GUARANTEED_MIN_ROUTE));
   });

   it("simulated runs with a path-finding driver win, but never faster than the bound", () => {
      for (const seed of [...SEEDS.slice(0, 12), ...BIG_SEEDS.slice(0, 2)]) {
         const layout = generateLayout(seed);
         const run = simulateRun(layout, pathDriver());
         expect(run.won).toBe(true);
         expect(run.collected).toBe(BATTERY_COUNT);
         expect(run.maxStep).toBeLessThanOrEqual(ROBOT.maxSpeed * DT + 1e-9);
         expect(run.elapsedMs).toBeGreaterThanOrEqual(minCompletionMs(layout));
         expect(run.elapsedMs).toBeLessThan(DURATION_MS / 2);
         const score = runScore(BATTERY_COUNT, true, DURATION_MS - run.elapsedMs);
         expect(withinServerLimits(score, Math.round(run.elapsedMs))).toBe(true);
      }
   });

   it("a robot that does not move scores 0 and times out", () => {
      const run = simulateRun(generateLayout(1), () => [0, 0]);
      expect(run).toMatchObject({ won: false, collected: 0, elapsedMs: DURATION_MS });
      expect(withinServerLimits(runScore(0, false, 0), DURATION_MS)).toBe(true);
   });
});
