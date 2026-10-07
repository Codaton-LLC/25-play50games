import { describe, expect, it } from "vitest";
import { distanceToBoxXZ as distanceToBox } from "@/arcade3d/core/collision";
import { FRAME_PRIORITY, MAX_FRAME_DT, advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createRng } from "@/arcade3d/core/math";
import { COUNTDOWN_MS, createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { robotCollectorMeta } from "./meta";
import {
   ARENA,
   BATTERY_COUNT,
   BOUNDS,
   CRATE_SIZE,
   DURATION_MS,
   FAIRNESS_MIN_ROUTE,
   FALLBACK_SPOTS,
   GUARANTEED_MIN_ROUTE,
   IDEAL_ROUTE,
   OBSTACLES,
   PICKUP_REACH,
   PROPS,
   ROBOT,
   ROBOT_START,
   SPACING,
   SPAWN_CLEARANCE,
   WAVE_COUNT,
   WAVE_SIZE,
   capScore,
   collectTouched,
   createProgress,
   createRobot,
   fastestFinishMs,
   generateLayout,
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

/** The spacing rules of isValidLayout, restated, so a test can show which rule rejects a layout. */
function keepsSpacing(layout: Layout): boolean {
   return layout.batteries.every(
      (b, i) =>
         (b.wave > 0 || Math.hypot(b.x - ROBOT_START.x, b.z - ROBOT_START.z) >= SPACING.fromStart) &&
         layout.batteries.slice(0, i).every((o) => {
            const d = Math.hypot(b.x - o.x, b.z - o.z);
            return (o.wave !== b.wave || d >= SPACING.inWave) && (o.wave !== b.wave - 1 || d >= SPACING.betweenWaves);
         })
   );
}

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
   /** fastest step seen, units/s */
   topSpeed: number;
   /** seconds the robot was driven (sum of the dt it was given) */
   driven: number;
}

/**
 * Plays one run like the game does, frame by frame (`frameS` per frame, default 60 fps): the real
 * store with the core clock (advanceRunClock, as RunClock does), the 3-2-1 countdown, then each
 * frame the robot moves by the dt useRunFrame would hand it (playedFrameDt).
 */
function simulateRun(
   layout: Layout,
   steer: (robot: RobotState, target: Battery | null) => [number, number],
   frameS = DT
): SimResult {
   const store = createArcadeStore();
   store.getState().configure({ durationMs: DURATION_MS });
   store.getState().markReady();
   store.getState().start();
   const robot = createRobot();
   const progress = createProgress();
   let topSpeed = 0;
   let driven = 0;
   while (store.getState().phase !== "over") {
      advanceRunClock(store, frameS);
      const dt = playedFrameDt(store.getState());
      if (dt === 0) continue;
      const active = layout.batteries.filter((b) => isActive(progress, b));
      const target = active.sort((a, b) => Math.hypot(a.x - robot.x, a.z - robot.z) - Math.hypot(b.x - robot.x, b.z - robot.z))[0] ?? null;
      const [dx, dz] = steer(robot, target);
      const fromX = robot.x;
      const fromZ = robot.z;
      stepRobot(robot, dx, dz, dt);
      driven += dt;
      topSpeed = Math.max(topSpeed, Math.hypot(robot.x - fromX, robot.z - fromZ) / dt);
      collectTouched(progress, layout, robot);
      if (isComplete(progress)) store.getState().end("win");
   }
   const { endReason, elapsedMs } = store.getState();
   return { won: endReason === "win", elapsedMs, collected: progress.collected, topSpeed, driven };
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
      // first battery too close to the start
      expect(isValidLayout(layoutOf([[1, 1], ...good.slice(1)]))).toBe(false);
      // the two batteries of wave 0 too close together
      expect(isValidLayout(layoutOf([good[0], [good[0][0] + 2, good[0][1] + 2], ...good.slice(2)]))).toBe(false);
      // a wave-1 battery too close to wave 0
      expect(isValidLayout(layoutOf([good[0], good[1], [good[1][0], good[1][1] + 3], ...good.slice(3)]))).toBe(false);
   });

   it("isValidLayout rejects a battery inside a prop, even when every other rule holds", () => {
      const good = FALLBACK_SPOTS.slice(0, 9);
      const crate = PROPS.find((p) => p.kind === "crate" && p.x === 4.2 && p.z === -5.6)!;
      // the last battery (wave 4) in the middle of a crate, or just far enough in front of it
      const inside = layoutOf([...good, [crate.x, crate.z]]);
      const outside = layoutOf([...good, [crate.x, crate.z + CRATE_SIZE / 2 + SPAWN_CLEARANCE + 0.5]]);
      for (const layout of [inside, outside]) {
         expect(keepsSpacing(layout)).toBe(true);
         expect(shortestRoute(layout, 0)).toBeGreaterThanOrEqual(IDEAL_ROUTE.min);
         expect(shortestRoute(layout, 0)).toBeLessThanOrEqual(IDEAL_ROUTE.max);
      }
      // so only the spawn check can tell them apart
      expect(isSpawnPoint(crate.x, crate.z)).toBe(false);
      expect(isValidLayout(inside)).toBe(false);
      expect(isValidLayout(outside)).toBe(true);
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

   it("ignores dt <= 0 and turns to face where it goes", () => {
      const robot = createRobot();
      stepRobot(robot, 1, 0, 0);
      stepRobot(robot, 1, 0, -1);
      expect([robot.x, robot.z, robot.vx]).toEqual([ROBOT_START.x, ROBOT_START.z, 0]);
      // heading starts at PI (facing -z); driving +x for a while turns it to PI/2 (atan2(vx, vz))
      robot.z = -3.5;
      for (let i = 0; i < 60; i++) stepRobot(robot, 1, 0, DT);
      expect(robot.heading).toBeCloseTo(Math.PI / 2, 3);
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
         maxScore: 1470,
         base: 600,
         maxPointsPerSec: 120,
         minDurationMs: 12500,
         maxDurationMs: 62000,
      });
      expect(withinServerLimits(1470, 12_500)).toBe(true);
      expect(withinServerLimits(1470, 12_499)).toBe(false);
      expect(withinServerLimits(1471, 30_000)).toBe(false);
      expect(withinServerLimits(900, 62_000)).toBe(true);
      expect(withinServerLimits(900, 62_001)).toBe(false);
      expect(capScore(5000, 30_000)).toBe(1470);
      // GameShell submits Math.round(elapsedMs), so the cap and the check use the rounded duration:
      // 12499.5 ms is sent as 12500, the minimum
      expect(withinServerLimits(100, 12_499.5)).toBe(true);
      expect(withinServerLimits(100, 12_499.49)).toBe(false);
      // the rate line binds only under 7250 ms (600 + 0.12 * 7250 = 1470): 6608.49 ms is sent as
      // 6608, where 600 + 0.12 * 6608 = 1392.96, and 6608.5 ms as 6609 (1393.08)
      expect(capScore(1600, 6_608.49)).toBe(1392);
      expect(capScore(1600, 6_608.5)).toBe(1393);
      expect(capScore(1600, 7_250)).toBe(1470);
   });
});

describe("robot-collector scoring limit proof (README.md)", () => {
   it("the core clock counts every moment the robot drives: driving time never exceeds elapsedMs", () => {
      // inside one frame RunClock runs first, then useRunFrame (the priorities ShellStage and
      // useRunFrame register; R3F runs lower priorities first)
      expect(FRAME_PRIORITY.clock).toBeLessThan(FRAME_PRIORITY.simulation);
      // the real store, driven like ShellStage: each frame advanceRunClock (RunClock), then the dt
      // useRunFrame hands the game (playedFrameDt); 0 = the game does not run this frame
      const store = createArcadeStore();
      store.getState().configure({ durationMs: DURATION_MS });
      store.getState().markReady();
      const rng = createRng(11);
      let driven = 0;
      let firstDt = 0;
      let untimedFrames = 0;
      let carried = 0;
      const frame = (delta: number) => {
         const before = store.getState().elapsedMs;
         advanceRunClock(store, delta);
         const dt = playedFrameDt(store.getState());
         if (dt === 0) return;
         if (driven === 0) firstDt = dt;
         driven += dt;
         // every second the robot is driven in this frame was counted by the clock in this frame
         if (dt * 1000 > store.getState().elapsedMs - before + 1e-9) untimedFrames += 1;
         expect(dt).toBeLessThanOrEqual(MAX_FRAME_DT);
      };

      // runs that time out, are won, or are restarted midway; with pauses during the countdown
      // and the play, and frames from 4 ms to 300 ms (tab switches, GC pauses), so the countdown
      // ends in the middle of a frame
      for (const ending of ["timeup", "win", "restart", "win", "timeup", "restart", "win", "timeup"] as const) {
         const { phase } = store.getState();
         if (phase === "ready" || phase === "over") store.getState().start();
         driven = 0;
         untimedFrames = 0;
         const stopAtMs = 5_000 + rng() * 40_000;
         while (store.getState().phase !== "over") {
            const roll = rng();
            if (roll < 0.01) store.getState().pause();
            else if (roll < 0.03) store.getState().resume();
            frame(rng() < 0.1 ? 0.05 + rng() * 0.25 : 0.004 + rng() * 0.03);
            if (ending !== "timeup" && store.getState().elapsedMs >= stopAtMs) break;
         }
         if (ending === "win") store.getState().end("win");

         const { elapsedMs } = store.getState();
         if (ending === "timeup") expect(elapsedMs).toBe(DURATION_MS);
         expect(untimedFrames).toBe(0);
         // driven <= elapsed: equal for a win or a restart; a time-up frame is counted, not driven
         expect(driven).toBeLessThanOrEqual(elapsedMs / 1000 + 1e-9);
         if (ending !== "timeup") expect(driven).toBeCloseTo(elapsedMs / 1000, 9);
         else expect(elapsedMs / 1000 - driven).toBeLessThanOrEqual(MAX_FRAME_DT + 1e-9);
         // the first frame drove only the part of its frame after "go"
         if (firstDt < MAX_FRAME_DT - 1e-9) carried += 1;
         if (ending === "restart") store.getState().restart();
      }
      // the random frames really ended countdowns mid-frame (the case the old clock did not time)
      expect(carried).toBeGreaterThan(0);
   });

   it("the countdown's last frame drives only the time after go, and the clock counts it", () => {
      const store = createArcadeStore();
      store.getState().configure({ durationMs: DURATION_MS });
      store.getState().markReady();
      store.getState().start();
      // 3000 ms countdown in 40 ms frames: 75 frames exactly, then 30 ms frames from 2990 ms
      for (let i = 0; i < 74; i++) advanceRunClock(store, 0.04);
      expect(store.getState().countdownMs).toBeCloseTo(40, 6);
      advanceRunClock(store, 0.03);
      expect(playedFrameDt(store.getState())).toBe(0);
      advanceRunClock(store, 0.03); // 10 ms of countdown, 20 ms of play
      expect(store.getState().phase).toBe("playing");
      expect(playedFrameDt(store.getState())).toBeCloseTo(0.02, 9);
      expect(store.getState().elapsedMs).toBeCloseTo(20, 6);
      expect(COUNTDOWN_MS).toBe(3000);
   });

   it("without the level design, a win before 12.5 s would be rejected", () => {
      // 1470 at 12.4 s fails the minimum duration, 1480 (a win by 12.0 s) fails maxScore
      expect(winScoreAt(12_400)).toBe(1470);
      expect(withinServerLimits(winScoreAt(12_400), 12_400)).toBe(false);
      expect(winScoreAt(11_900)).toBe(1480);
      expect(withinServerLimits(winScoreAt(11_900), 30_000)).toBe(false);
      expect(winScoreAt(12_500)).toBe(1470);
      expect(withinServerLimits(winScoreAt(12_500), 12_500)).toBe(true);
   });

   it("the spacing rules alone force a route of at least 45.8 units (a win no earlier than 9.16 s)", () => {
      expect(GUARANTEED_MIN_ROUTE).toBeCloseTo(
         SPACING.fromStart - PICKUP_REACH + 5 * (SPACING.inWave - 2 * PICKUP_REACH) + 4 * (SPACING.betweenWaves - 2 * PICKUP_REACH),
         9
      );
      expect(GUARANTEED_MIN_ROUTE).toBeCloseTo(45.8, 9);
      expect(fastestFinishMs(GUARANTEED_MIN_ROUTE)).toBeCloseTo(9_160, 6);
   });

   it("the fairness band forces a route of at least 64.8 units, i.e. a win no earlier than 12.96 s", () => {
      // no leg is clipped at 0 by the reach, so the reach shortens every route by exactly 15.2
      expect(SPACING.fromStart).toBeGreaterThan(PICKUP_REACH);
      expect(SPACING.inWave).toBeGreaterThan(2 * PICKUP_REACH);
      expect(SPACING.betweenWaves).toBeGreaterThan(2 * PICKUP_REACH);
      expect(FAIRNESS_MIN_ROUTE).toBeCloseTo(IDEAL_ROUTE.min - PICKUP_REACH - (BATTERY_COUNT - 1) * 2 * PICKUP_REACH, 9);
      expect(FAIRNESS_MIN_ROUTE).toBeCloseTo(64.8, 9);
      // 64.8 / 5 * 1000 is 12959.999999999998 in floats: the exact value is 12960
      expect(Math.round(fastestFinishMs(FAIRNESS_MIN_ROUTE))).toBe(12_960);
      expect(fastestFinishMs(FAIRNESS_MIN_ROUTE)).toBeCloseTo(12_960, 6);
   });

   it("on every seed the reach route is exactly the ideal route minus 15.2, so at least 64.8", () => {
      for (const layout of [...[...SEEDS, ...BIG_SEEDS].map(generateLayout), fallback()]) {
         const ideal = shortestRoute(layout, 0);
         const reach = shortestRoute(layout, PICKUP_REACH);
         expect(ideal).toBeGreaterThanOrEqual(IDEAL_ROUTE.min);
         expect(reach).toBeCloseTo(ideal - 15.2, 9);
         expect(reach).toBeGreaterThanOrEqual(FAIRNESS_MIN_ROUTE - 1e-9);
      }
   });

   it("every win at or after the guaranteed earliest finish is within the limits", () => {
      const earliest = Math.round(fastestFinishMs(FAIRNESS_MIN_ROUTE));
      for (let t = earliest; t <= DURATION_MS; t += 10) {
         const score = winScoreAt(t);
         expect(withinServerLimits(score, t)).toBe(true);
         expect(capScore(score, t)).toBe(score);
      }
      // best case overall: 1470 at 12.96 s, exactly maxScore 1470 and under the 2155-point line
      expect(winScoreAt(earliest)).toBe(1470);
      expect(winScoreAt(earliest)).toBe(robotCollectorMeta.scoring.maxScore);
      expect(capScore(5000, earliest)).toBe(1470);
      expect(Math.floor(600 + 0.12 * earliest)).toBe(2155);
      // margins: the minimum duration is 460 ms (3.5%) under the earliest win, the maximum 3.3%
      // over the exact 60 s of a time-up
      const { minDurationMs, maxDurationMs } = robotCollectorMeta.scoring;
      expect(earliest - minDurationMs).toBe(460);
      expect(earliest - minDurationMs).toBeGreaterThanOrEqual(0.03 * earliest);
      expect(maxDurationMs).toBeGreaterThanOrEqual(DURATION_MS * 1.03);
      // 1480 would need a win at 12.0 s or sooner, 7.4% faster than the proof allows
      expect(winScoreAt(12_001)).toBe(1470);
      expect(winScoreAt(12_000)).toBe(1480);
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
         expect(route).toBeGreaterThanOrEqual(FAIRNESS_MIN_ROUTE - 1e-9);
         // the ideal route is the fairness band; the lower bound can only be shorter
         expect(shortestRoute(layout, 0)).toBeLessThanOrEqual(IDEAL_ROUTE.max + 1e-9);
         const minMs = minCompletionMs(layout);
         fastest = Math.min(fastest, minMs);
         expect(withinServerLimits(winScoreAt(Math.floor(minMs)), Math.floor(minMs))).toBe(true);
      }
      // no seeded layout beats the 12.96 s bound (the bound is reached almost exactly: 64.8023
      // units on seed 2118636122)
      expect(fastest).toBeGreaterThanOrEqual(fastestFinishMs(FAIRNESS_MIN_ROUTE) - 1e-6);
      expect(fastest).toBeGreaterThan(fastestFinishMs(GUARANTEED_MIN_ROUTE));
   });

   it("simulated runs with a path-finding driver win, but never faster than the bound", () => {
      const seeds = [...SEEDS.slice(0, 12), ...BIG_SEEDS.slice(0, 2)];
      seeds.forEach((seed, i) => {
         const layout = generateLayout(seed);
         // 60 fps, plus uneven frame rates whose frames do not divide the countdown
         const run = simulateRun(layout, pathDriver(), i % 3 === 0 ? 0.0137 : DT);
         expect(run.won).toBe(true);
         expect(run.collected).toBe(BATTERY_COUNT);
         expect(run.topSpeed).toBeLessThanOrEqual(ROBOT.maxSpeed + 1e-9);
         expect(run.driven).toBeCloseTo(run.elapsedMs / 1000, 9);
         expect(run.elapsedMs).toBeGreaterThanOrEqual(minCompletionMs(layout));
         expect(run.elapsedMs).toBeGreaterThanOrEqual(robotCollectorMeta.scoring.minDurationMs);
         expect(run.elapsedMs).toBeLessThan(DURATION_MS / 2);
         const score = runScore(BATTERY_COUNT, true, DURATION_MS - run.elapsedMs);
         expect(withinServerLimits(score, run.elapsedMs)).toBe(true);
         expect(capScore(score, run.elapsedMs)).toBe(score);
      });
   });

   it("a robot that does not move scores 0 and times out", () => {
      const run = simulateRun(generateLayout(1), () => [0, 0]);
      expect(run).toMatchObject({ won: false, collected: 0, elapsedMs: DURATION_MS });
      expect(withinServerLimits(runScore(0, false, 0), DURATION_MS)).toBe(true);
   });
});
