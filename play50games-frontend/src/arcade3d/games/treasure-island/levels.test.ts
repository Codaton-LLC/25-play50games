// The five levels (docs/arcade-levels.md §6.3 step 6): declarations, level 1 = today's game,
// monotone difficulty, the analytic limit proof per level, and an honest bot through the real store.
// rules.test.ts is unchanged and still owns today's proof.
import { describe, expect, it, vi } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { createGrid, fixedFrames, followPath, freeGrid, simulateRun, steer, type PathFollower } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVELS } from "./levels";
import { treasureIslandMeta as meta } from "./meta";
import definition from "./index";
import {
   DIG,
   DURATION_MS,
   EARLIEST_WIN_MS,
   EXPLORER,
   FALLBACK_ISLAND,
   ISLAND,
   MIN_ROUTE,
   PROPOSED_LEVEL_LIMITS,
   START,
   TIDE,
   capScore,
   clearance,
   createRun,
   earliestWinMs,
   generateIsland,
   isValidIsland,
   isWon,
   layoutFrom,
   minRouteMetres,
   reachRho,
   rho,
   runScore,
   shoreAt,
   shortestRoute,
   stepRun,
   timeBonus,
   withinServerLimits,
   type Island,
   type RunState,
   type StepInput,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));

const PREV: Record<Exclude<LevelId, 1>, LevelId> = { 2: 1, 3: 2, 4: 3, 5: 4 };

/** Hardcoded ceilings. A change to a route floor or the formula fails these, not a check against itself. */
const CEILING: Record<LevelId, { routeM: number; earliestMs: number; maxScore: number; minDurationMs: number; base: number }> = {
   1: { routeM: 29.9, earliestMs: 8980, maxScore: 2060, minDurationMs: 8500, base: 1250 },
   2: { routeM: 29.9, earliestMs: 8980, maxScore: 2060, minDurationMs: 8500, base: 1250 },
   3: { routeM: 30.1, earliestMs: 9620, maxScore: 2300, minDurationMs: 9100, base: 1500 },
   4: { routeM: 30.1, earliestMs: 9620, maxScore: 2300, minDurationMs: 9100, base: 1500 },
   5: { routeM: 27.1, earliestMs: 9020, maxScore: 2300, minDurationMs: 8500, base: 1500 },
};

describe("treasure-island levels: declarations", () => {
   it("declares five levels in meta and the definition with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      expect(meta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(meta.scoring).toEqual({ kind: "points", maxScore: 2060, minDurationMs: 8500, maxDurationMs: 92000, base: 1250, maxPointsPerSec: 100, unitLabel: "pts", display: "int" });
      expect(meta.levels!.map((level) => level.title)).toEqual(["Starter Beach", "Palm Grove", "Rocky Cove", "Jungle Interior", "Pirate Peak"]);
      expect(meta.levels!.map((level) => level.clearScore)).toEqual([1250, 1250, 1500, 1500, 1500]);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      for (const id of LEVEL_IDS) expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
   });

   it("level 1 is today's game: same clock, tide, ellipse, instructions and sunset", () => {
      const l1 = LEVELS[1];
      expect(l1).toEqual({ treasures: 5, durationMs: 90_000, tideStartS: 70, tideEndS: 90, finalShore: 0.75, spacing: 6, rx: 14, rz: 11, routeMin: 38, routeMax: 56 });
      expect(l1.durationMs).toBe(DURATION_MS);
      expect(levelEnvironment(definition, 1)).toBe(definition.environment);
      expect(definition.environment).toEqual({ background: "#fdba74", fog: ["#fdba74", 40, 95], lighting: "sunset" });
      expect(levelInstructions(definition, 1)).toBe(definition.instructions);
      expect(levelHudStats(definition, 1)).toEqual([{ key: "treasures", label: "Treasures", max: 5 }]);
      expect(levelRunConfig(definition, 1).durationMs).toBe(DURATION_MS);
      for (const id of LEVEL_IDS) {
         expect(levelEnvironment(definition, id)).toBe(definition.environment);
         expect(levelRunConfig(definition, id).durationMs).toBe(DURATION_MS);
      }
   });

   it("replays today's createRun, and level 2 only moves the tide clock", () => {
      for (const seed of [0, 1, 7, 42, 94]) {
         const today = generateIsland(seed);
         expect(generateIsland(seed, LEVELS[1])).toEqual(today);
         expect(generateIsland(seed, LEVELS[2]).treasures).toEqual(today.treasures);
         const a = createRun(today);
         const b = createRun(today, LEVELS[1]);
         expect(b.tide).toBe(TIDE);
         expect(b.shape).toBe(ISLAND);
         expect(b.goal).toBe(5);
         const step: StepInput = { dirX: 0.6, dirZ: -0.3, digHeld: false, digPressed: false };
         let time = 0;
         for (let f = 0; f < 40; f++) {
            time += 1 / 30;
            stepRun(a, today, step, 1 / 30, time);
            stepRun(b, today, step, 1 / 30, time);
         }
         expect(b.explorer).toEqual(a.explorer);
         expect(b.found).toBe(a.found);
         expect(b.dug).toEqual(a.dug);
      }
      expect(shoreAt(65)).toBe(1);
      const later = createRun(generateIsland(3), LEVELS[2]);
      expect(later.shape).toBe(ISLAND);
      expect(shoreAt(65, later.tide)).toBeLessThan(1);
      expect(shoreAt(65, later.tide)).toBeGreaterThan(later.tide.finalShore);
   });
});

describe("treasure-island levels: difficulty", () => {
   it("is monotone: more treasures, then an earlier tide, then a wider island", () => {
      expect(LEVEL_IDS.map((id) => LEVELS[id].treasures)).toEqual([5, 5, 6, 6, 6]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].tideStartS)).toEqual([70, 60, 55, 50, 45]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].tideEndS)).toEqual([90, 80, 75, 70, 65]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].spacing)).toEqual([6, 6, 6, 6, 5]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].rx)).toEqual([14, 14, 14, 14, 17]);
      for (const id of LEVEL_IDS) {
         expect(LEVELS[id].durationMs).toBe(90_000);
         expect(LEVELS[id].finalShore).toBe(0.75);
         expect(LEVELS[id].rz).toBe(11);
         expect(LEVELS[id].tideEndS - LEVELS[id].tideStartS).toBe(20);
      }
      for (const id of [2, 3, 4, 5] as const) {
         const prev = LEVELS[PREV[id]];
         const next = LEVELS[id];
         expect(next.treasures).toBeGreaterThanOrEqual(prev.treasures);
         expect(next.tideStartS).toBeLessThan(prev.tideStartS);
         expect(next.spacing).toBeLessThanOrEqual(prev.spacing);
         expect(next.rx).toBeGreaterThanOrEqual(prev.rx);
      }
   });

   it("places a full island on every level (the 5-treasure fallback is never returned)", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < 40; seed++) {
            const island = generateIsland(seed * 17 + 3, LEVELS[id]);
            expect(island.treasures).not.toBe(FALLBACK_ISLAND.treasures);
            expect(island.treasures.length).toBe(LEVELS[id].treasures);
            expect(isValidIsland(island, layoutFrom(LEVELS[id]))).toBe(true);
            const ideal = shortestRoute(island.treasures);
            expect(ideal).toBeGreaterThanOrEqual(LEVELS[id].routeMin);
            expect(ideal).toBeLessThanOrEqual(LEVELS[id].routeMax);
         }
      }
   });
});

describe("treasure-island levels: limit proof per level (README)", () => {
   for (const id of LEVEL_IDS) it(`L${id}: the route floor, the earliest win and the server line`, () => {
      const level = LEVELS[id];
      const limits = PROPOSED_LEVEL_LIMITS[id];
      const pinned = CEILING[id];
      expect(minRouteMetres(level)).toBeCloseTo(pinned.routeM, 6);
      expect(earliestWinMs(level)).toBeCloseTo(pinned.earliestMs, 6);
      if (id === 1) {
         expect(minRouteMetres(level)).toBe(MIN_ROUTE);
         expect(earliestWinMs(level)).toBe(EARLIEST_WIN_MS);
      }
      const finds = level.treasures * 250;
      expect(limits).toEqual({
         kind: "points",
         maxScore: pinned.maxScore,
         minDurationMs: pinned.minDurationMs,
         maxDurationMs: 92_000,
         base: pinned.base,
         maxPointsPerSec: 100,
         unitLabel: "pts",
         display: "int",
      });
      expect(limits.base).toBe(finds);
      expect(limits.maxScore).toBe(finds + timeBonus(level.durationMs - pinned.earliestMs));
      // from the earliest win on, the score only falls while base + 100 t only rises
      for (let ms = pinned.earliestMs; ms <= level.durationMs; ms += 500) {
         const score = finds + timeBonus(level.durationMs - ms);
         expect(score).toBeLessThanOrEqual(limits.maxScore);
         expect(score).toBeLessThanOrEqual(limits.base! + limits.maxPointsPerSec! * (ms / 1000) + 1e-9);
      }
      expect(limits.minDurationMs).toBe(Math.floor((pinned.earliestMs * 0.95) / 100) * 100);
      expect(pinned.earliestMs).toBeGreaterThanOrEqual((10 * level.durationMs) / (limits.maxPointsPerSec! + 10));
   });

   it("dig time is one number for touch and keyboard, on every level", () => {
      expect(DIG.holdS).toBe(0.6);
      for (const id of [1, 5] as const) {
         const island = generateIsland(11, LEVELS[id]);
         const spot = island.treasures[0];
         const fine = createRun(island, LEVELS[id]);
         const touch = createRun(island, LEVELS[id]);
         fine.explorer.x = touch.explorer.x = spot.x;
         fine.explorer.z = touch.explorer.z = spot.z;
         const a: StepInput = { dirX: 0, dirZ: 0, digHeld: true, digPressed: true };
         const b: StepInput = { dirX: 0, dirZ: 0, digHeld: true, digPressed: true };
         let time = 0;
         const frames = Math.round((DIG.holdS - 1 / 60) / (1 / 60));
         for (let f = 0; f < frames; f++) {
            time += 1 / 60;
            stepRun(fine, island, f === 0 ? a : { ...a, digPressed: false }, 1 / 60, time);
            stepRun(touch, island, f === 0 ? b : { ...b, digPressed: false }, 1 / 60, time);
         }
         expect(fine.found).toBe(0);
         expect(touch.found).toBe(fine.found);
         time += 1 / 60;
         stepRun(fine, island, { dirX: 0, dirZ: 0, digHeld: true, digPressed: false }, 1 / 60, time);
         stepRun(touch, island, { dirX: 0, dirZ: 0, digHeld: true, digPressed: false }, 1 / 60, time);
         expect(fine.found).toBe(1);
         expect(touch.explorer).toEqual(fine.explorer);
         expect(touch.found).toBe(fine.found);
         expect(touch.cleanFinds).toBe(fine.cleanFinds);
      }
   });
});

// ---------- honest path bot and an idle explorer, through the real store ----------

const BOT_GRID = createGrid({ cell: 0.25, halfX: 20, halfZ: 14 });
const BOT_SEEDS = 64;
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

function bestOrder(island: Island): number[] {
   const ids = island.treasures.map((_t, i) => i);
   const perms = (xs: number[]): number[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms(xs.filter((_v, j) => j !== i)).map((r) => [x, ...r])));
   const length = (o: number[]) => o.reduce((sum, i, k) => sum + dist(k ? island.treasures[o[k - 1]] : START, island.treasures[i]), 0);
   return perms(ids).reduce((a, b) => (length(b) < length(a) ? b : a));
}

type Driver = (run: RunState, step: StepInput) => void;

function pathBot(island: Island, level: (typeof LEVELS)[LevelId]): Driver {
   const free = freeGrid(BOT_GRID, (x, z) => rho(x, z, level) <= reachRho(1) - 0.06 && clearance(island, x, z) >= EXPLORER.radius + 0.12);
   let goal = -1;
   let follower: PathFollower | null = null;
   const order = bestOrder(island);
   return (run, step) => {
      step.digPressed = false;
      const target = order.find((i) => !run.dug[i]);
      if (target === undefined) return;
      if (run.dig.active) {
         step.digHeld = true;
         step.dirX = step.dirZ = 0;
         return;
      }
      step.digHeld = false;
      const e = run.explorer;
      const t = island.treasures[target];
      if (dist(e, t) <= DIG.reach - 0.02) {
         step.digPressed = step.digHeld = true;
         return;
      }
      if (goal !== target || !follower) {
         goal = target;
         follower = followPath(BOT_GRID, free, e.x, e.z, t.x, t.z);
      }
      steer(BOT_GRID, follower, e.x, e.z, step);
   };
}

const idleBot: Driver = (_run, step) => {
   step.dirX = 0;
   step.dirZ = 0;
   step.digHeld = false;
   step.digPressed = false;
};

function simulate(island: Island, id: LevelId, drive: Driver) {
   const level = LEVELS[id];
   const limits = PROPOSED_LEVEL_LIMITS[id];
   const run = createRun(island, level);
   const step: StepInput = { dirX: 0, dirZ: 0, digHeld: false, digPressed: false };
   let rawScore = 0;
   let capped = false;
   const end = simulateRun(createArcadeStore(), {
      durationMs: level.durationMs,
      frame: fixedFrames(50),
      step: (dt, time, store) => {
         drive(run, step);
         stepRun(run, island, step, dt, time);
         if (run.events.found < 0) return;
         const s = store.getState();
         s.addScore(200 + (run.events.foundClean ? 50 : 0));
         s.setStat("treasures", run.found);
         if (isWon(run)) {
            rawScore = runScore(run.found, run.cleanFinds, true, s.timeLeftMs ?? 0);
            const stored = capScore(rawScore, s.elapsedMs, limits);
            capped = stored !== rawScore;
            s.setScore(stored);
            s.end("win");
         }
      },
   });
   return { won: end.endReason === "win", elapsedMs: end.elapsedMs, score: rawScore, capped, found: run.found };
}

describe("treasure-island levels: bots", () => {
   for (const id of LEVEL_IDS) it(`L${id}: the honest bot clears and an idle explorer does not`, () => {
      const limits = PROPOSED_LEVEL_LIMITS[id];
      const clearAt = meta.levels![id - 1].clearScore!;
      let wins = 0;
      let rich = 0;
      let capped = 0;
      let rejected = 0;
      for (let seed = 0; seed < BOT_SEEDS; seed++) {
         const island = generateIsland(seed, LEVELS[id]);
         const run = simulate(island, id, pathBot(island, LEVELS[id]));
         if (run.won && run.score >= clearAt) wins++;
         if (run.won && run.score >= 0.9 * limits.maxScore) rich++;
         if (run.capped) capped++;
         if (run.won && !withinServerLimits(run.score, run.elapsedMs, limits)) rejected++;
      }
      const idle = simulate(generateIsland(0, LEVELS[id]), id, idleBot);
      console.log(JSON.stringify({ id, seeds: BOT_SEEDS, clear: wins / BOT_SEEDS, ofMax: rich / BOT_SEEDS, idle: idle.score, capped, rejected }));
      expect(wins / BOT_SEEDS).toBeGreaterThanOrEqual(0.99);
      expect(rich / BOT_SEEDS).toBeGreaterThanOrEqual(0.9);
      expect(capped).toBe(0);
      expect(rejected).toBe(0);
      expect(idle.won).toBe(false);
      expect(idle.score).toBe(0);
      expect(idle.score).toBeLessThan(clearAt);
   }, 120_000);
});
