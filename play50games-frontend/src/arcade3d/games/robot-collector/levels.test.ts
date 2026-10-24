// The five levels (docs/arcade-levels.md §6.3 step 6): declarations, level 1 = today's game,
// monotone difficulty, valid worlds and layouts per level, the limit proof per level and the
// hazards' rules. The bot proofs are in rules.levels.test.ts.
import { describe, expect, it, vi } from "vitest";
import { distanceToBoxXZ } from "@/arcade3d/core/collision";
import { createGrid, findPath, freeGrid, nearestFree } from "@/arcade3d/core/testing/botHarness";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { BELTS, BELT_HALF_WIDTH, LEVELS, SLOW_FACTOR, SLOW_ZONES } from "./levels";
import { robotCollectorMeta as meta } from "./meta";
import {
   ARENA,
   BATTERY_COUNT,
   BATTERY_POINTS,
   BOUNDS,
   DURATION_MS,
   FAIRNESS_MIN_ROUTE,
   OBSTACLES,
   PICKUP_REACH,
   PROPOSED_LEVEL_LIMITS,
   PROPS,
   ROBOT,
   TIME_BONUS_PER_SECOND,
   batteryCount,
   beltUnder,
   createRun,
   fairnessMinRoute,
   generateLayout,
   idealRoute,
   isValidLayout,
   levelLayout,
   runScore,
   shortestRoute,
   spawnPoints,
   stepRun,
   withinServerLimits,
   worldOf,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));

const prev = (id: LevelId) => LEVELS[(id - 1) as LevelId];
const earliestWinS = (id: LevelId) => fairnessMinRoute(LEVELS[id]) / ROBOT.maxSpeed;

describe("robot-collector levels: declarations", () => {
   it("declares five levels in meta and definition with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.levels!.every((level) => level.clearScore === undefined)).toBe(true);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("level 1 is today's live game: same limits, layouts, warehouse, clock, HUD and start card", () => {
      expect(meta.scoring).toEqual({ kind: "points", maxScore: 1470, minDurationMs: 12500, maxDurationMs: 62000, base: 600, maxPointsPerSec: 120, unitLabel: "pts", display: "int" });
      const l1 = LEVELS[1];
      expect([batteryCount(l1), l1.durationMs, l1.extraProps, l1.slowZones, l1.belts]).toEqual([BATTERY_COUNT, DURATION_MS, 0, 0, 0]);
      expect(worldOf(l1).props).toBe(PROPS);
      expect(worldOf(l1).obstacles).toBe(OBSTACLES);
      expect(idealRoute(l1)).toEqual({ min: 80, max: 95 });
      expect(fairnessMinRoute(l1)).toBe(FAIRNESS_MIN_ROUTE);
      for (const seed of [0, 1, 13, 4242, 2 ** 32 - 1]) {
         const run = createRun(seed, l1);
         expect(run.layout).toEqual(generateLayout(seed));
         expect(beltUnder(l1, run.robot.x, run.robot.z)).toBeNull();
      }
      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: DURATION_MS, lives: undefined, resultDelayMs: undefined });
      expect(levelEnvironment(definition, 1)).toEqual({ background: "#0b1220", lighting: "indoor" });
      expect(levelHudStats(definition, 1)).toEqual([{ key: "batteries", label: "Batteries", max: 10 }]);
      expect(levelInstructions(definition, 1)).toEqual([
         "Collect all 10 batteries before the clock runs out.",
         "They light up two at a time: grab both and the next pair appears.",
         "+100 per battery. Finish early for +10 per second left.",
      ]);
   });

   it("each level's clock, HUD max and lighting come from its config", () => {
      for (const id of LEVEL_IDS) {
         expect(levelRunConfig(definition, id).durationMs).toBe(LEVELS[id].durationMs);
         expect(levelHudStats(definition, id)![0].max).toBe(batteryCount(LEVELS[id]));
         expect(levelInstructions(definition, id)[0]).toBe(`Collect all ${batteryCount(LEVELS[id])} batteries before the clock runs out.`);
      }
      expect(LEVEL_IDS.map((id) => levelEnvironment(definition, id)!.lighting)).toEqual(["indoor", "day", "sunset", "night", "sunset"]);
      // the robot's lamp only on the night level (looks only; level 1 has none)
      expect(LEVEL_IDS.map((id) => LEVELS[id].lamp ?? 0)).toEqual([0, 0, 0, 5, 0]);
   });
});

describe("robot-collector levels: difficulty and worlds", () => {
   it("is monotone: more batteries, props, oil and belts, faster belts, less time per wave", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = prev(id), b = LEVELS[id];
         expect(b.waves).toBeGreaterThan(a.waves);
         expect(b.extraProps).toBeGreaterThanOrEqual(a.extraProps);
         expect(b.slowZones).toBeGreaterThanOrEqual(a.slowZones);
         expect(b.belts).toBeGreaterThanOrEqual(a.belts);
         expect(b.beltSpeed).toBeGreaterThanOrEqual(a.beltSpeed);
         expect(b.durationMs / b.waves).toBeLessThan(a.durationMs / a.waves);
         expect(b.extraProps + b.slowZones + b.belts).toBeGreaterThan(a.extraProps + a.slowZones + a.belts);
      }
   });

   it("every level's warehouse is open: props stay off the start and the belts; every spawn point is reachable", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id], world = worldOf(level);
         for (const box of world.obstacles) expect(distanceToBoxXZ(0, 0, box)).toBeGreaterThan(ROBOT.radius * 2);
         expect(beltUnder(level, 0, 0)).toBeNull();
         for (const belt of BELTS.slice(0, level.belts)) {
            expect(belt.ax === belt.bx || belt.az === belt.bz).toBe(true);
            for (let k = 0; k <= 20; k++) {
               const x = belt.ax + ((belt.bx - belt.ax) * k) / 20, z = belt.az + ((belt.bz - belt.az) * k) / 20;
               // a belt never pushes the robot into a prop or wall it cannot drive away from
               for (const box of world.obstacles) expect(distanceToBoxXZ(x, z, box)).toBeGreaterThanOrEqual(BELT_HALF_WIDTH);
               expect(ARENA.halfX - Math.abs(x)).toBeGreaterThanOrEqual(BELT_HALF_WIDTH + ROBOT.radius);
               expect(ARENA.halfZ - Math.abs(z)).toBeGreaterThanOrEqual(BELT_HALF_WIDTH + ROBOT.radius);
            }
         }
         const grid = createGrid({ cell: 0.25, halfX: ARENA.halfX, halfZ: ARENA.halfZ });
         const free = freeGrid(grid, (x, z) => Math.abs(x) <= ARENA.halfX - ROBOT.radius && Math.abs(z) <= ARENA.halfZ - ROBOT.radius && world.obstacles.every((box) => distanceToBoxXZ(x, z, box) >= ROBOT.radius + 0.05));
         const start = nearestFree(grid, free, 0, 0);
         for (let i = 0; i < world.spawn.length; i += 7) {
            const p = world.spawn[i];
            expect(findPath(grid, free, start, nearestFree(grid, free, p.x, p.z)).length).toBeGreaterThan(0);
         }
      }
   });

   it("layouts are valid on every level for 300 seeds and the fallbacks", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         expect(spawnPoints(level).length).toBeGreaterThan(300);
         let fallbacks = 0;
         for (let seed = 0; seed < 300; seed++) {
            const layout = levelLayout(seed, level);
            if (level.fallback && layout.batteries.every((b, i) => b.x === level.fallback![i][0] && b.z === level.fallback![i][1])) fallbacks++;
            expect(layout.batteries.length).toBe(batteryCount(level));
            expect(isValidLayout(layout, level)).toBe(true);
            // no leg is clipped by the reach: the reach route is the ideal route minus 0.8 + (N - 1) x 1.6
            expect(shortestRoute(layout, PICKUP_REACH)).toBeCloseTo(shortestRoute(layout, 0) - PICKUP_REACH - (batteryCount(level) - 1) * 2 * PICKUP_REACH, 9);
         }
         // random layouts, not the fallback (seed 1 is where each fallback was copied from)
         expect(fallbacks).toBeLessThanOrEqual(1);
         if (level.fallback) {
            const fallback = { seed: 0, batteries: level.fallback.map(([x, z], i) => ({ index: i, wave: Math.floor(i / 2), x, y: 0, z })) };
            expect(isValidLayout(fallback, level)).toBe(true);
         }
      }
   });
});

describe("robot-collector levels: limit proof per level (README)", () => {
   for (const id of LEVEL_IDS) it(`L${id}: no win before the fairness bound; every reachable score fits base + pps t`, () => {
      const level = LEVELS[id], limits = PROPOSED_LEVEL_LIMITS[id], n = batteryCount(level), clock = level.durationMs / 1000;
      const earliest = earliestWinS(id);
      // the ceiling is a win at the earliest possible finish
      expect(limits.maxScore).toBe(n * BATTERY_POINTS + TIME_BONUS_PER_SECOND * Math.floor(clock - earliest + 1e-9));
      expect(limits.minDurationMs).toBeLessThanOrEqual(earliest * 1000);
      expect(limits.minDurationMs).toBeGreaterThan(earliest * 1000 * 0.95);
      expect(limits.maxDurationMs).toBeGreaterThanOrEqual(level.durationMs + 2000);
      // a win at any legal time t >= earliest, and a time-up at the clock
      for (let t = earliest; t <= clock; t += 0.01) {
         const score = runScore(n, true, (clock - t) * 1000);
         expect(score).toBeLessThanOrEqual(limits.maxScore);
         expect(withinServerLimits(score, Math.max(t * 1000, limits.minDurationMs), limits)).toBe(true);
      }
      expect(withinServerLimits(runScore(n - 1, false, 0), level.durationMs, limits)).toBe(true);
      // before the win: k batteries need at least 3.2 + 3.4 (k - 1) units of driving
      for (let k = 1; k < n; k++) expect(k * BATTERY_POINTS).toBeLessThanOrEqual(limits.base! + limits.maxPointsPerSec! * (3.2 + 3.4 * (k - 1)) / ROBOT.maxSpeed);
   });
});

describe("robot-collector levels: hazards", () => {
   it("oil caps the speed at SLOW_FACTOR; nothing ever makes the robot faster than maxSpeed", () => {
      const run = createRun(3, LEVELS[5]), zone = SLOW_ZONES[0];
      run.robot.x = zone.x; run.robot.z = zone.z; run.robot.vx = run.robot.vz = 0;
      let top = 0;
      for (let i = 0; i < 40; i++) {
         const x = run.robot.x, z = run.robot.z;
         stepRun(run, 1, 0, 1 / 60);
         if (run.slowed && !run.belted) top = Math.max(top, Math.hypot(run.robot.x - x, run.robot.z - z) * 60);
      }
      expect(top).toBeGreaterThan(0);
      expect(top).toBeLessThanOrEqual(ROBOT.maxSpeed * SLOW_FACTOR + 1e-9);
      const free = createRun(9, LEVELS[5]);
      for (let i = 0; i < 20000; i++) {
         const x = free.robot.x, z = free.robot.z, dt = 0.004 + ((i * 7919) % 46) / 1000;
         stepRun(free, Math.sin(i * 0.37), Math.cos(i * 0.21), dt);
         expect(Math.hypot(free.robot.x - x, free.robot.z - z)).toBeLessThanOrEqual(ROBOT.maxSpeed * dt + 1e-9);
         expect(Math.abs(free.robot.x)).toBeLessThanOrEqual(BOUNDS.max.x);
         expect(Math.abs(free.robot.z)).toBeLessThanOrEqual(BOUNDS.max.z);
      }
   });

   it("a belt carries an idle robot along it at beltSpeed, never faster, and the robot can drive off it", () => {
      for (const id of [3, 4, 5] as const) {
         const level = LEVELS[id], belt = BELTS[0], run = createRun(1, level);
         // at most half the robot's speed: it can always drive upstream and off a belt
         expect(level.beltSpeed).toBeLessThanOrEqual(ROBOT.maxSpeed / 2);
         run.robot.x = belt.ax + 0.5 * Math.sign(belt.bx - belt.ax); run.robot.z = belt.az; run.robot.vx = run.robot.vz = 0;
         const x0 = run.robot.x;
         for (let i = 0; i < 30; i++) stepRun(run, 0, 0, 1 / 60);
         expect(run.belted).toBe(true);
         expect(Math.abs(run.robot.x - x0)).toBeCloseTo(level.beltSpeed * 0.5, 6);
         expect(Math.hypot(run.robot.vx, run.robot.vz)).toBeLessThan(1e-9);
         // full stick across the belt: off it within the time a crossing at reduced speed takes
         let t = 0;
         while (beltUnder(level, run.robot.x, run.robot.z) && t < 2) { stepRun(run, 0, 1, 1 / 60); t += 1 / 60; }
         expect(t).toBeLessThan(1);
      }
   });
});
