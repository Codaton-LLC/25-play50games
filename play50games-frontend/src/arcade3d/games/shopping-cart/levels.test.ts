// The five levels (docs/arcade-levels.md §6.3 step 6): declarations, level 1 = today's game,
// monotone difficulty, limit proofs per level, bot clear rate and mutation probes.
import { describe, expect, it, vi } from "vitest";
import { definitionLevelProblems, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import {
   createGrid,
   fixedFrames,
   followPath,
   freeGrid,
   simulateRun,
   steer,
} from "@/arcade3d/core/testing/botHarness";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import definition from "./index";
import { LEVELS, type ShoppingCartLevel } from "./levels";
import { PROPOSED_LEVEL_LIMITS, PROPOSED_LIMITS, shoppingCartMeta as meta } from "./meta";
import {
   CART,
   DURATION_MS,
   LIST_COUNT,
   MIN_TOUR_DISTANCE,
   MIN_WIN_ROUTE_M,
   POINTS,
   SHELF_SLOTS,
   SOLID_OBSTACLES,
   START_POS,
   createRun,
   generateList,
   runScore,
   shortestPickTour,
   stepRun,
   withinProposedLimits,
   withinServerLimits,
   type ListItem,
   type RunState,
   type StepInput,
} from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));

const input = (moveX = 0, moveY = 0, ride = false): StepInput => ({ moveX, moveY, ride });

describe("shopping-cart levels: declarations", () => {
   it("declares five levels in meta and definition with the proposed limits", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      for (const id of LEVEL_IDS) {
         expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
      }
      expect(meta.scoring).toEqual(PROPOSED_LIMITS);
      // Levels 1..4 have clearScore; Level 5 has no clearScore (nothing to unlock)
      expect(meta.levels!.slice(0, 4).every((l) => l.clearScore !== undefined)).toBe(true);
      expect(meta.levels![4].clearScore).toBeUndefined();
      // Decision 3 guard: Level 5 maxScore <= ~3x Level 1 maxScore
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
      // Points monotonic: harder levels offer at least as many points as level 1
      for (const id of LEVEL_IDS.slice(1)) {
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThan(PROPOSED_LEVEL_LIMITS[(id - 1) as LevelId].maxScore);
      }
   });

   it("level 1 is today's game: same items, clock, shoppers, HUD and start card", () => {
      const l1 = LEVELS[1];
      expect([l1.listCount, l1.durationMs, l1.shopperDActiveS, l1.shopperSpeed, l1.shopperWait, l1.minTourDistance]).toEqual([
         LIST_COUNT,
         DURATION_MS,
         40.0,
         1.8,
         0.6,
         MIN_TOUR_DISTANCE,
      ]);
      expect(levelRunConfig(definition, 1)).toEqual({ durationMs: DURATION_MS, lives: undefined, resultDelayMs: 1200 });
      expect(levelEnvironment(definition, 1)).toEqual({ background: "#0b1220", fog: ["#0b1220", 18, 38], lighting: "indoor" });
      expect(levelHudStats(definition, 1)).toEqual([{ key: "items", label: "Items", max: 6 }]);
      expect(levelInstructions(definition, 1)).toEqual([
         "Steer the runaway cart through aisles to grab all 6 items on your list.",
         "Hold Ride (Space or Ride button) to drift faster; dodge shoppers, spills & pyramids.",
         "Collect all 6 items and dash to checkout before 75 s runs out!",
      ]);
   });

   it("replay test: createRun(seed, LEVELS[1]) is byte-for-byte identical to createRun(seed) over 25 seeds", () => {
      for (let s = 0; s < 25; s++) {
         const runExplicit = createRun(s, LEVELS[1]);
         const runDefault = createRun(s);
         expect(runExplicit).toEqual(runDefault);
         expect(runExplicit.list).toHaveLength(6);
         expect(runExplicit.level).toEqual(LEVELS[1]);

         // Step both runs and verify step events and kinematics match
         const ev1 = stepRun(runExplicit, input(1, 0, true), 1 / 60, 0.5);
         const ev2 = stepRun(runDefault, input(1, 0, true), 1 / 60, 0.5);
         expect(ev1).toEqual(ev2);
         expect(runExplicit.cart).toEqual(runDefault.cart);
      }
   });

   it("each level's clock, HUD max and descriptions come from its config", () => {
      for (const id of LEVEL_IDS) {
         expect(levelRunConfig(definition, id).durationMs).toBe(LEVELS[id].durationMs);
         expect(levelHudStats(definition, id)![0].max).toBe(LEVELS[id].listCount);
         expect(levelInstructions(definition, id)[0]).toBe(
            `Steer the runaway cart through aisles to grab all ${LEVELS[id].listCount} items on your list.`
         );
      }
      // Indoor lighting is preserved on all 5 levels
      for (const id of LEVEL_IDS) {
         expect(levelEnvironment(definition, id)!.lighting).toBe("indoor");
      }
   });
});

describe("shopping-cart levels: difficulty & progression", () => {
   it("is monotone: items and shopper speed never decrease, shopper wait and shopperD activation time never increase", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const prev = LEVELS[(id - 1) as LevelId];
         const curr = LEVELS[id];
         expect(curr.listCount).toBeGreaterThan(prev.listCount);
         expect(curr.shopperSpeed).toBeGreaterThanOrEqual(prev.shopperSpeed);
         expect(curr.shopperWait).toBeLessThanOrEqual(prev.shopperWait);
         expect(curr.shopperDActiveS).toBeLessThanOrEqual(prev.shopperDActiveS);
      }
      expect(LEVEL_IDS.map((id) => LEVELS[id].listCount)).toEqual([6, 7, 9, 12, 15]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].shopperDActiveS)).toEqual([40.0, 30.0, 20.0, 15.0, 0.0]);
      expect(LEVEL_IDS.map((id) => LEVELS[id].shopperSpeed)).toEqual([1.8, 1.9, 2.0, 2.1, 2.2]);
   });

   it("every level generates valid lists with no undefined products", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         for (let s = 0; s < 20; s++) {
            const list = generateList(s, level.listCount, level.minTourDistance);
            expect(list).toHaveLength(level.listCount);
            expect(list.every((it) => it.kind !== undefined && it.x !== undefined && it.z !== undefined)).toBe(true);
            const slots = new Set(list.map((it) => it.slotIndex));
            expect(slots.size).toBe(level.listCount);
         }
      }
   });
});

describe("shopping-cart levels: score limits proof per level (README)", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: arithmetic, linear envelope B(t) <= base + pps * t, and server limit bounds hold`, () => {
         const lvl = LEVELS[id];
         const limits = PROPOSED_LEVEL_LIMITS[id];
         const K = lvl.listCount;
         const comboMax = POINTS.comboStep * ((K * (K + 1)) / 2);
         const listBonus = POINTS.listComplete;
         const itemsPts = K * POINTS.item;
         const baseWinScore = itemsPts + comboMax + listBonus;

         // Earliest win is at 3500 ms (kinematic route bound >= 30.91 m > 28.56 m)
         const earliestMs = limits.minDurationMs;
         const earliestTimeLeftMs = lvl.durationMs - earliestMs;
         const maxTimeBonus = POINTS.perSecond * Math.floor(earliestTimeLeftMs / 1000);
         const theoreticalMax = baseWinScore + maxTimeBonus;

         expect(limits.maxScore).toBe(theoreticalMax);
         expect(limits.minDurationMs).toBe(3500);
         expect(limits.maxDurationMs).toBe(lvl.durationMs + 2000);

         // Linear envelope check for all t in [3.5s, durationMs]
         for (let ms = earliestMs; ms <= lvl.durationMs; ms += 100) {
            const timeLeft = Math.max(0, lvl.durationMs - ms);
            const score = baseWinScore + POINTS.perSecond * Math.floor(timeLeft / 1000);
            expect(score).toBeLessThanOrEqual(limits.maxScore);
            expect(score).toBeLessThanOrEqual(limits.base + (limits.maxPointsPerSec * ms) / 1000);
            expect(withinServerLimits(score, ms, id), `L${id} at ${ms} ms`).toBe(true);
         }

         // Time-up score (0 time bonus) fits limits
         const timeUpScore = baseWinScore;
         expect(withinServerLimits(timeUpScore, lvl.durationMs + 1000, id)).toBe(true);

         // Boundary checks: limits are tight
         expect(withinServerLimits(limits.maxScore, limits.minDurationMs, id)).toBe(true);
         expect(withinServerLimits(limits.maxScore + 1, limits.minDurationMs, id)).toBe(false);
         expect(withinServerLimits(limits.maxScore, limits.minDurationMs - 1, id)).toBe(false);
         expect(withinServerLimits(limits.maxScore, limits.maxDurationMs + 1, id)).toBe(false);
      });
   }
});

describe("shopping-cart levels: bot clear rates and gameplay", () => {
   const grid = createGrid({ cell: 0.5, halfX: 16, halfZ: 12 });
   const free = freeGrid(grid, (x, z) => {
      if (x < -15.2 || x > 15.2 || z < -11.2 || z > 11.2) return false;
      for (const obs of SOLID_OBSTACLES) {
         if (
            x >= obs.min.x - 0.45 &&
            x <= obs.max.x + 0.45 &&
            z >= obs.min.z - 0.45 &&
            z <= obs.max.z + 0.45
         ) {
            return false;
         }
      }
      return true;
   });

   function getTarget(run: RunState, listCount: number): { x: number; z: number } {
      if (run.collectedCount >= listCount) {
         return run.cart.x < -1.5 ? { x: -2.0, z: 10.8 } : { x: 0.9, z: 10.8 };
      }
      let bestDist = Infinity;
      let bestItem = run.list[0];
      for (let i = 0; i < run.list.length; i++) {
         const it = run.list[i];
         if (!it.collected) {
            const d = Math.hypot(it.x - run.cart.x, it.z - run.cart.z);
            if (d < bestDist) {
               bestDist = d;
               bestItem = it;
            }
         }
      }
      const shelfCenters = [-9.0, -4.0, 1.0, 6.0];
      let nearestCenter = shelfCenters[0];
      let minCenterDist = Infinity;
      for (const c of shelfCenters) {
         const dist = Math.abs(c - bestItem.x);
         if (dist < minCenterDist) {
            minCenterDist = dist;
            nearestCenter = c;
         }
      }
      const standoffX = bestItem.x < nearestCenter ? bestItem.x - 0.45 : bestItem.x + 0.45;
      return { x: standoffX, z: bestItem.z };
   }

   for (const id of LEVEL_IDS) {
      it(`L${id}: honest path-following bot clears level on >= 99% of seeds`, () => {
         const lvl = LEVELS[id];
         const metaLvl = meta.levels![id - 1];
         let clears = 0;
         const sampleSeeds = 40;

         for (let s = 0; s < sampleSeeds; s++) {
            const store = createArcadeStore();
            const run = createRun(s, lvl);
            let target = getTarget(run, lvl.listCount);
            let follower = followPath(grid, free, run.cart.x, run.cart.z, target.x, target.z);
            const steerDir = { dirX: 0, dirZ: 0 };

            simulateRun(store, {
               durationMs: lvl.durationMs,
               frame: fixedFrames(1000 / 60),
               step: (dt, time, sStore) => {
                  const currentTarget = getTarget(run, lvl.listCount);
                  if (Math.hypot(currentTarget.x - follower.goalX, currentTarget.z - follower.goalZ) > 0.05) {
                     target = currentTarget;
                     follower = followPath(grid, free, run.cart.x, run.cart.z, target.x, target.z);
                  }

                  while (
                     follower.k < follower.path.length - 1 &&
                     (Math.hypot(grid.x(follower.path[follower.k]) - run.cart.x, grid.z(follower.path[follower.k]) - run.cart.z) < 1.0 ||
                      Math.hypot(grid.x(follower.path[follower.k + 1]) - run.cart.x, grid.z(follower.path[follower.k + 1]) - run.cart.z) <
                      Math.hypot(grid.x(follower.path[follower.k]) - run.cart.x, grid.z(follower.path[follower.k]) - run.cart.z))
                  ) {
                     follower.k++;
                  }

                  steer(grid, follower, run.cart.x, run.cart.z, steerDir, 0.7);
                  const targetHeading = Math.atan2(steerDir.dirX, -steerDir.dirZ);
                  const angleDiff = Math.abs(Math.atan2(Math.sin(targetHeading - run.cart.heading), Math.cos(targetHeading - run.cart.heading)));

                  const stepInp: StepInput = {
                     moveX: steerDir.dirX,
                     moveY: -steerDir.dirZ,
                     ride: angleDiff < 0.8,
                  };

                  const ev = stepRun(run, stepInp, dt, time);
                  for (const p of ev.pickups) sStore.getState().addScore(p.score);
                  if (ev.listCompleted) sStore.getState().addScore(POINTS.listComplete);
                  if (ev.won) {
                     sStore.getState().setScore(run.score);
                     sStore.getState().end("win");
                  }
               },
            });

            const st = store.getState();
            const cleared = st.endReason === "win" || (metaLvl.clearScore !== undefined && st.score >= metaLvl.clearScore);
            if (cleared) clears++;

            expect(st.score).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxScore);
            expect(withinServerLimits(st.score, st.elapsedMs, id)).toBe(true);
         }

         const clearRate = clears / sampleSeeds;
         expect(clearRate).toBeGreaterThanOrEqual(0.99);
      }, 30000);
   }

   it("idle bot never clears any level (scores 0 pts at timeout)", () => {
      for (const id of LEVEL_IDS) {
         const lvl = LEVELS[id];
         const metaLvl = meta.levels![id - 1];
         const store = createArcadeStore();
         const run = createRun(77, lvl);

         simulateRun(store, {
            durationMs: lvl.durationMs,
            frame: fixedFrames(1000 / 60),
            step: (dt, time, sStore) => {
               const ev = stepRun(run, input(0, 0, false), dt, time);
               if (ev.timeup) sStore.getState().end("timeup");
            },
         });

         const st = store.getState();
         expect(st.score).toBe(0);
         expect(st.endReason).toBe("timeup");
         if (metaLvl.clearScore !== undefined) {
            expect(st.score).toBeLessThan(metaLvl.clearScore);
         }
      }
   });
});

describe("shopping-cart levels: mutation probes", () => {
   it("mutant probe 1: shopperD active time is distinct per level", () => {
      const activeTimes = LEVEL_IDS.map((id) => LEVELS[id].shopperDActiveS);
      expect(new Set(activeTimes).size).toBe(5);
   });

   it("mutant probe 2: listCount is strictly monotonic", () => {
      for (let i = 1; i < LEVEL_IDS.length; i++) {
         expect(LEVELS[LEVEL_IDS[i]].listCount).toBeGreaterThan(LEVELS[LEVEL_IDS[i - 1]].listCount);
      }
   });

   it("mutant probe 3: clearScore is always strictly between 0 and maxScore for levels 1..4", () => {
      for (const id of [1, 2, 3, 4] as LevelId[]) {
         const clearScore = meta.levels![id - 1].clearScore!;
         expect(clearScore).toBeGreaterThan(0);
         expect(clearScore).toBeLessThan(PROPOSED_LEVEL_LIMITS[id].maxScore);
      }
   });

   it("mutant probe 4: maxScore on level 5 is at least level 1 and at most 3x level 1", () => {
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeGreaterThanOrEqual(PROPOSED_LEVEL_LIMITS[1].maxScore);
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * PROPOSED_LEVEL_LIMITS[1].maxScore);
   });
});
