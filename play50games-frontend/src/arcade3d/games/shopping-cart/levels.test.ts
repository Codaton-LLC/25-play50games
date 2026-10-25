// The five levels (docs/arcade-levels.md §6.3 step 6): declarations, level 1 = today's game,
// monotone difficulty, limit proofs per level, bot clear rate and mutation probes.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
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
   spanningTreeLength,
   stepRun,
   withinProposedLimits,
   withinServerLimits,
   type ListItem,
   type RunState,
   type StepInput,
} from "./rules";
import * as rules from "./rules";

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

   it("createRun(seed, LEVELS[1]) equals createRun(seed) over 25 seeds", () => {
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


describe("shopping-cart level settings reach the simulation", () => {
   const still = (): StepInput => ({ moveX: 0, moveY: 0, ride: false });
   /** Parks the cart 0.5 m off an item's shelf face, inside its 1 m reach. */
   const park = (run: RunState, item: ListItem) => {
      const centre = [-9, -4, 1, 6].reduce((a, c) => Math.abs(c - item.x) < Math.abs(a - item.x) ? c : a);
      run.cart.x = item.x + (item.x < centre ? -0.5 : 0.5); run.cart.z = item.z;
      run.cart.vx = 0; run.cart.vz = 0; run.cart.speed = 0; run.cart.targetSpeed = 0;
   };

   it("index.tsx hands each level its own config", () => {
      for (const id of LEVEL_IDS) expect(definition.levels![id - 1].config).toBe(LEVELS[id]);
   });

   it("shopper D starts active only at rush hour and wakes at the level's time", () => {
      for (const id of LEVEL_IDS) {
         const lvl = LEVELS[id], run = createRun(5, lvl);
         const d = () => run.shoppers.find((x) => x.id === "shopperD")!;
         expect(d().active).toBe(lvl.shopperDActiveS <= 0);
         if (lvl.shopperDActiveS <= 0) continue;
         stepRun(run, still(), 1 / 60, lvl.shopperDActiveS - 0.01);
         expect(d().active).toBe(false);
         stepRun(run, still(), 1 / 60, lvl.shopperDActiveS);
         expect(d().active).toBe(true);
      }
   });

   it("shopper speed and waypoint wait come from the level", () => {
      const walk = (lvl: ShoppingCartLevel) => {
         const run = createRun(5, lvl);
         for (let i = 1; i <= 600; i++) stepRun(run, still(), 1 / 60, i / 60);
         return run.shoppers.map((x) => `${x.agent.x.toFixed(6)},${x.agent.z.toFixed(6)}`).join(" ");
      };
      const base = walk(LEVELS[1]);
      expect(walk({ ...LEVELS[1], shopperSpeed: 2.2 })).not.toBe(base);
      expect(walk({ ...LEVELS[1], shopperWait: 0.2 })).not.toBe(base);
      // the patrol moves at the level's speed: over 0.25 s mid-walk shopper A covers speed x 0.25
      for (const id of [1, 5] as const) {
         const run = createRun(5, LEVELS[id]);
         for (let i = 1; i <= 120; i++) stepRun(run, still(), 1 / 60, i / 60);
         const a = run.shoppers[0].agent, x = a.x, z = a.z;
         for (let i = 121; i <= 135; i++) stepRun(run, still(), 1 / 60, i / 60);
         expect(Math.hypot(a.x - x, a.z - z)).toBeCloseTo(LEVELS[id].shopperSpeed * 0.25, 1);
      }
   });

   it("the clock is the level's: time-up at durationMs, not before", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(3, LEVELS[id]), end = LEVELS[id].durationMs / 1000;
         stepRun(run, still(), 1 / 60, end - 0.01);
         expect(run.timedOut).toBe(false);
         stepRun(run, still(), 1 / 60, end);
         expect(run.timedOut).toBe(true);
      }
   });

   it("the list completes on the level's last item, and the win bonus counts the level's clock", () => {
      for (const id of LEVEL_IDS) {
         const lvl = LEVELS[id], run = createRun(9, lvl);
         const last = run.list[run.list.length - 1];
         for (const item of run.list.slice(0, -1)) { park(run, item); stepRun(run, still(), 1 / 60, 1); }
         expect(run.collectedCount).toBe(lvl.listCount - 1);
         expect(run.listComplete).toBe(false);
         park(run, last); stepRun(run, still(), 1 / 60, 1);
         expect(run.listComplete).toBe(true);
         run.cart.x = 0; run.cart.z = 11;
         const before = run.score;
         stepRun(run, still(), 1 / 60, 10);
         expect(run.won).toBe(true);
         expect(run.score - before).toBe(POINTS.perSecond * Math.floor((lvl.durationMs - 10000) / 1000));
      }
   });

   it("the steering assist stays on until the level's last item", () => {
      for (const id of LEVEL_IDS) {
         const lvl = LEVELS[id], run = createRun(9, lvl);
         for (const item of run.list.slice(0, -1)) { park(run, item); stepRun(run, still(), 1 / 60, 1); }
         const last = run.list[run.list.length - 1];
         // 3 m south of the item, pushing 10 degrees off it: the assist bends the heading toward it
         run.cart.x = last.x + (last.x < 0 ? 0.6 : -0.6); run.cart.z = last.z + 3;
         const toItem = Math.atan2(last.x - run.cart.x, -(last.z - run.cart.z)), push = toItem + 0.17;
         run.cart.heading = push; run.cart.stunTimer = 0;
         stepRun(run, { moveX: Math.sin(push), moveY: Math.cos(push), ride: false }, 0.1, 2);
         expect(run.cart.heading).toBeLessThan(push - 1e-6);
      }
   });

   it("long lists still pass the 52 m tour gate (the spanning-tree shortcut never admits a short list)", () => {
      for (const id of [3, 4, 5] as const) {
         for (let seed = 0; seed < 8; seed++) {
            const list = generateList(seed, LEVELS[id].listCount, LEVELS[id].minTourDistance);
            expect(shortestPickTour(list)).toBeGreaterThanOrEqual(MIN_TOUR_DISTANCE);
         }
      }
      // the shortcut is sound: a spanning tree never exceeds the start -> items -> checkout path
      for (let seed = 0; seed < 30; seed++) {
         const list = generateList(seed, 9, 0);
         expect(spanningTreeLength(list)).toBeLessThanOrEqual(shortestPickTour(list) + 1e-9);
      }
   });
});

const L1_TODAY = [
   "win:1570:6:925:a701f95a0ce6b86f",
   "win:1600:6:909:0a508ffbdcc31052",
   "win:1540:6:1111:3eec67253262342f",
   "win:1580:6:912:6e6fbebd66f3512d",
   "win:1550:6:1158:da08f7c1a6b2ab79",
   "win:1620:6:1006:db9f53a8f19200c1",
   "win:1570:6:1041:8129547d83ea0bed",
   "win:1570:6:951:b61d91357c02ef30",
   "win:1580:6:1000:4a88fe2c81f520d4",
   "win:1490:6:1458:69ff03d3605e6ec7",
   "win:1620:6:901:9cc5d074a999f5bc",
   "win:1620:6:877:8ebac647d871b1ea",
   "win:1090:6:3282:ceaddabd87e07d96",
   "win:1170:6:2979:412c554f48a2f71a",
   "timeup:0:0:3652:bc957f1e497ab947",
];

describe("shopping-cart level 1 is today's game", () => {
   it("replays bit-exact against today's createRun (15 seeds: wins, shopper D at 40 s, a time-up)", () => {
      for (let seed = 0; seed < L1_TODAY.length; seed++) {
         expect(l1Trace(rules as any, seed), `seed ${seed}`).toBe(L1_TODAY[seed]);
         expect(l1Trace(rules as any, seed, (s) => createRun(s, LEVELS[1])), `seed ${seed} L1`).toBe(L1_TODAY[seed]);
      }
   }, 120000);
});

/** Level 1 replay: a path-following bot with seeded input noise drives a run on ragged frames
 * and every frame's full serialized run (the new `level` field excluded) and step events are
 * hashed. Shape-agnostic, so the same code ran on today's rules.ts (origin/main before levels)
 * to record L1_TODAY. */
interface CartRules { createRun(seed: number): any; stepRun(run: any, input: StepInput, dt: number, time: number): any }
function l1Trace(m: CartRules, seed: number, make: (seed: number) => any = m.createRun): string {
   const grid = createGrid({ cell: 0.5, halfX: 16, halfZ: 12 });
   const free = freeGrid(grid, (x, z) => !(x < -15.2 || x > 15.2 || z < -11.2 || z > 11.2) && !SOLID_OBSTACLES.some((o) => x >= o.min.x - 0.45 && x <= o.max.x + 0.45 && z >= o.min.z - 0.45 && z <= o.max.z + 0.45));
   const run = make(seed);
   const hash = createHash("sha256");
   const target = (): { x: number; z: number } => {
      if (run.collectedCount >= run.list.length) return run.cart.x < -1.5 ? { x: -2.0, z: 10.8 } : { x: 0.9, z: 10.8 };
      let best = run.list.find((it: ListItem) => !it.collected)!;
      for (const it of run.list) if (!it.collected && Math.hypot(it.x - run.cart.x, it.z - run.cart.z) < Math.hypot(best.x - run.cart.x, best.z - run.cart.z)) best = it;
      const centre = [-9, -4, 1, 6].reduce((a, c) => Math.abs(c - best.x) < Math.abs(a - best.x) ? c : a);
      return { x: best.x < centre ? best.x - 0.45 : best.x + 0.45, z: best.z };
   };
   let goal = target(), follower = followPath(grid, free, run.cart.x, run.cart.z, goal.x, goal.z);
   const dir = { dirX: 0, dirZ: 0 };
   let time = 0, frames = 0, rnd = seed * 2654435761 + 11;
   while (!run.won && !run.timedOut && frames++ < 12000) {
      rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0;
      const dt = [1 / 60, 1 / 30, 1 / 144, 0.05 * rnd / 4294967296][frames % 4];
      const next = target();
      if (Math.hypot(next.x - follower.goalX, next.z - follower.goalZ) > 0.05) { goal = next; follower = followPath(grid, free, run.cart.x, run.cart.z, goal.x, goal.z); }
      const d = (k: number) => Math.hypot(grid.x(follower.path[k]) - run.cart.x, grid.z(follower.path[k]) - run.cart.z);
      while (follower.k < follower.path.length - 1 && (d(follower.k) < 1.0 || d(follower.k + 1) < d(follower.k))) follower.k++;
      steer(grid, follower, run.cart.x, run.cart.z, dir, 0.7);
      const noise = frames % 97 < 6;
      const heading = Math.atan2(dir.dirX, -dir.dirZ);
      const turn = Math.abs(Math.atan2(Math.sin(heading - run.cart.heading), Math.cos(heading - run.cart.heading)));
      // seeds 12-13 idle through shopper D's 40 s activation first, seed 14 idles to the time-up
      const idle = time < (seed === 14 ? Infinity : seed >= 12 ? 42 : 0);
      const ev = m.stepRun(run, idle ? { moveX: 0, moveY: 0, ride: false } : noise ? { moveX: (rnd & 3) - 1.5, moveY: ((rnd >> 2) & 3) - 1.5, ride: (rnd & 16) > 0 } : { moveX: dir.dirX, moveY: -dir.dirZ, ride: turn < 0.8 }, dt, time);
      time += dt;
      hash.update(JSON.stringify(run, (key, value) => key === "level" ? undefined : value));
      hash.update(JSON.stringify(ev));
   }
   return `${run.won ? "win" : run.timedOut ? "timeup" : "open"}:${run.score}:${run.collectedCount}:${frames}:${hash.digest("hex").slice(0, 16)}`;
}
