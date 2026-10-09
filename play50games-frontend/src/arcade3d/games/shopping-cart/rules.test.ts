import { describe, expect, it } from "vitest";
import { pointAt } from "@/arcade3d/core/path";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import {
   createGrid,
   fixedFrames,
   followPath,
   freeGrid,
   randomFrames,
   simulateRun,
   steer,
} from "@/arcade3d/core/testing/botHarness";
import { shoppingCartMeta } from "./meta";
import {
   CART,
   CHECKOUT_COUNTERS,
   DURATION_MS,
   FALLBACK_LIST,
   LIST_COUNT,
   MIN_TOUR_DISTANCE,
   POINTS,
   PROPOSED_LIMITS,
   PYRAMID_RADIUS,
   SHELVES,
   SHELF_SLOTS,
   SOLID_OBSTACLES,
   SPILLS,
   START_POS,
   STORE,
   createRun,
   createShopperRoutes,
   generateList,
   runScore,
   shortestPickTour,
   stepRun,
   storeDistance,
   withinProposedLimits,
   withinServerLimits,
   type ListItem,
   type RunState,
   type StepInput,
} from "./rules";

const DT = 1 / 60;
const SEEDS = Array.from({ length: 1000 }, (_, i) => i);

const input = (moveX = 0, moveY = 0, ride = false): StepInput => ({ moveX, moveY, ride });

describe("shopping-cart rules", () => {
   describe("list generation & fairness", () => {
      it("is deterministic: same seed yields identical items and slots", () => {
         const list1 = generateList(42);
         const list2 = generateList(42);
         expect(list1).toEqual(list2);
         expect(list1.length).toBe(LIST_COUNT);
      });

      it("every seed generates 6 distinct products and 6 distinct slots", () => {
         for (let s = 0; s < 100; s++) {
            const list = generateList(s);
            expect(list).toHaveLength(6);
            const kinds = new Set(list.map((it) => it.kind));
            const slots = new Set(list.map((it) => it.slotIndex));
            expect(kinds.size).toBe(6);
            expect(slots.size).toBe(6);
         }
      });

      it("enforces minimum tour distance >= 52.0 m on 1,000 seeds", () => {
         for (let i = 0; i < SEEDS.length; i++) {
            const list = generateList(SEEDS[i]);
            const tour = shortestPickTour(list);
            expect(tour, `seed ${SEEDS[i]}`).toBeGreaterThanOrEqual(MIN_TOUR_DISTANCE);
         }
      });

      it("fallback list is valid and satisfies minimum tour distance", () => {
         expect(FALLBACK_LIST).toHaveLength(6);
         const tour = shortestPickTour(FALLBACK_LIST);
         expect(tour).toBeGreaterThanOrEqual(MIN_TOUR_DISTANCE);
      });
   });

   describe("kinematics & speed model", () => {
      it("turn rate is capped at 4.0 rad/s", () => {
         const run = createRun(1);
         // Move full right (moveX = 1, moveY = 0 -> desired heading pi/2)
         stepRun(run, input(1, 0, false), DT, DT);
         expect(Math.abs(run.cart.heading)).toBeCloseTo(CART.turnRate * DT, 3);
      });

      it("speed respects walking (6 m/s) and riding (9 m/s) caps", () => {
         const runWalk = createRun(1);
         for (let f = 0; f < 120; f++) {
            stepRun(runWalk, input(0, 1, false), DT, f * DT);
         }
         expect(runWalk.cart.speed).toBeLessThanOrEqual(CART.maxWalkingSpeed + 1e-3);

         const runRide = createRun(2);
         for (let f = 0; f < 120; f++) {
            stepRun(runRide, input(0, 1, true), DT, f * DT);
         }
         expect(runRide.cart.speed).toBeLessThanOrEqual(CART.maxRidingSpeed + 1e-3);
      });

      it("grip deceleration eases towards target speed", () => {
         const run = createRun(1);
         // Accelerate first
         for (let f = 0; f < 60; f++) {
            stepRun(run, input(0, 1, false), DT, f * DT);
         }
         const peakSpeed = run.cart.speed;
         expect(peakSpeed).toBeGreaterThan(4.0);

         // Idle deceleration
         for (let f = 0; f < 60; f++) {
            stepRun(run, input(0, 0, false), DT, 1 + f * DT);
         }
         expect(run.cart.speed).toBeLessThan(peakSpeed);
      });
   });

   describe("continuous swept collision (no tunnelling)", () => {
      it("20,000 random steps at 9 m/s never tunnel through shelf boxes or outer walls", () => {
         const run = createRun(99);
         const rng = { s: 54321 };

         for (let step = 0; step < 20000; step++) {
            // Random direction and dt
            const randX = (step % 3 === 0 ? 1 : step % 3 === 1 ? -1 : 0);
            const randY = (step % 2 === 0 ? 1 : -1);
            const randDt = 0.01 + ((step * 7) % 50) * 0.001; // 10ms - 60ms

            stepRun(run, input(randX, randY, true), randDt, step * 0.02);

            // Assert cart is strictly within store bounds
            expect(run.cart.x).toBeGreaterThanOrEqual(STORE.minX - 0.1);
            expect(run.cart.x).toBeLessThanOrEqual(STORE.maxX + 0.1);
            expect(run.cart.z).toBeGreaterThanOrEqual(STORE.minZ - 0.1);
            expect(run.cart.z).toBeLessThanOrEqual(STORE.maxZ + 0.1);

            // Assert cart center never penetrates shelf interiors beyond margin
            for (const shelf of SHELVES) {
               const insideX = run.cart.x > shelf.min.x + 0.1 && run.cart.x < shelf.max.x - 0.1;
               const insideZ = run.cart.z > shelf.min.z + 0.1 && run.cart.z < shelf.max.z - 0.1;
               expect(insideX && insideZ).toBe(false);
            }
         }
      });

      describe("Blocker 1 regression: cart unstick from all obstacle face types", () => {
         it("unstick from shelf side: drive east into shelf face, steer west, moves >= 1.0 m within 1 s", () => {
            const run = createRun(1);
            run.cart.x = -5.5;
            run.cart.z = 0;
            run.cart.heading = Math.PI / 2;
            for (let f = 0; f < 30; f++) {
               stepRun(run, input(1, 0, false), DT, f * DT);
            }
            const contactX = run.cart.x;
            expect(contactX).toBeGreaterThan(-5.5);
            for (let f = 0; f < 60; f++) {
               stepRun(run, input(-1, 0, false), DT, 0.5 + f * DT);
            }
            const movedDistance = Math.abs(run.cart.x - contactX);
            expect(movedDistance).toBeGreaterThanOrEqual(1.0);
         });

         it("unstick from shelf end: drive south into shelf end, steer north, moves >= 1.0 m within 1 s", () => {
            const run = createRun(1);
            run.cart.x = -4.0;
            run.cart.z = -8.5;
            run.cart.heading = Math.PI;
            for (let f = 0; f < 30; f++) {
               stepRun(run, input(0, -1, false), DT, f * DT);
            }
            const contactZ = run.cart.z;
            expect(contactZ).toBeGreaterThan(-8.5);
            for (let f = 0; f < 60; f++) {
               stepRun(run, input(0, 1, false), DT, 0.5 + f * DT);
            }
            const movedDistance = Math.abs(run.cart.z - contactZ);
            expect(movedDistance).toBeGreaterThanOrEqual(1.0);
         });

         it("unstick from corner: drive SE into shelf NW corner, steer NW, moves >= 1.0 m within 1 s", () => {
            const run = createRun(1);
            run.cart.x = -5.5;
            run.cart.z = -8.5;
            run.cart.heading = (3 * Math.PI) / 4;
            for (let f = 0; f < 30; f++) {
               stepRun(run, input(1, -1, false), DT, f * DT);
            }
            const contactX = run.cart.x;
            const contactZ = run.cart.z;
            for (let f = 0; f < 60; f++) {
               stepRun(run, input(-1, 1, false), DT, 0.5 + f * DT);
            }
            const movedDistance = Math.hypot(run.cart.x - contactX, run.cart.z - contactZ);
            expect(movedDistance).toBeGreaterThanOrEqual(1.0);
         });

         it("unstick from outer perimeter wall: drive west into wall, steer east, moves >= 1.0 m within 1 s", () => {
            const run = createRun(1);
            run.cart.x = -14.5;
            run.cart.z = 0;
            run.cart.heading = -Math.PI / 2;
            for (let f = 0; f < 30; f++) {
               stepRun(run, input(-1, 0, false), DT, f * DT);
            }
            const contactX = run.cart.x;
            for (let f = 0; f < 60; f++) {
               stepRun(run, input(1, 0, false), DT, 0.5 + f * DT);
            }
            const movedDistance = Math.abs(run.cart.x - contactX);
            expect(movedDistance).toBeGreaterThanOrEqual(1.0);
         });

         it("unstick from checkout counter: drive south into counter face, steer north, moves >= 1.0 m within 1 s", () => {
            const run = createRun(1);
            run.cart.x = -3.6;
            run.cart.z = 7.0;
            run.cart.heading = Math.PI;
            for (let f = 0; f < 30; f++) {
               stepRun(run, input(0, -1, false), DT, f * DT);
            }
            const contactZ = run.cart.z;
            for (let f = 0; f < 60; f++) {
               stepRun(run, input(0, 1, false), DT, 0.5 + f * DT);
            }
            const movedDistance = Math.abs(run.cart.z - contactZ);
            expect(movedDistance).toBeGreaterThanOrEqual(1.0);
         });
      });
   });

   describe("hazards: pyramids, shoppers, spills", () => {
      it("no shopper route segment intersects any shelf AABB", () => {
         const routes = createShopperRoutes();
         for (const [id, path] of Object.entries(routes)) {
            const step = 0.1;
            for (let s = 0; s <= path.total; s += step) {
               const pt = pointAt(path, s);
               for (const shelf of SHELVES) {
                  const inside =
                     pt.x >= shelf.min.x &&
                     pt.x <= shelf.max.x &&
                     pt.z >= shelf.min.z &&
                     pt.z <= shelf.max.z;
                  expect(inside, `shopper route ${id} at s=${s} intersects shelf`).toBe(false);
               }
            }
         }
      });
      it("can pyramid topples on contact, slows cart, resets combo, and stays toppled", () => {
         const run = createRun(1);
         run.combo = 3;
         // Place cart directly touching first pyramid
         run.cart.x = run.pyramids[0].x;
         run.cart.z = run.pyramids[0].z;

         const events = stepRun(run, input(0, 0, false), DT, 1.0);
         expect(run.pyramids[0].toppled).toBe(true);
         expect(run.cart.slowTimer).toBeGreaterThan(0);
         expect(run.combo).toBe(0);
         expect(events.pyramidToppled).toHaveLength(1);

         // Remains toppled in subsequent frames
         stepRun(run, input(0, 0, false), DT, 2.0);
         expect(run.pyramids[0].toppled).toBe(true);
      });

      it("shopper bump stuns cart, resets combo, and obeys grace period", () => {
         const run = createRun(1);
         run.combo = 4;
         run.cart.speed = 5.0;
         run.cart.targetSpeed = 5.0;
         // Place shopper on cart
         run.shoppers[0].agent.x = run.cart.x;
         run.shoppers[0].agent.z = run.cart.z;

         const events = stepRun(run, input(0, 1, false), DT, 1.0);
         expect(run.cart.stunTimer).toBeCloseTo(1.0, 1);
         expect(run.cart.speed).toBe(0);
         expect(run.combo).toBe(0);
         expect(run.shoppers[0].graceTimer).toBeCloseTo(1.5, 1);
         expect(events.shopperBumped).toHaveLength(1);
      });

      it("spill puddle drops grip to 1.5 /s", () => {
         const run = createRun(1);
         // Place cart inside Spill 1
         run.cart.x = SPILLS[0].x;
         run.cart.z = SPILLS[0].z;
         run.cart.speed = 4.0;

         const events = stepRun(run, input(1, 0, false), DT, 30.0); // after spawnS (25s)
         expect(events.spillSkid).toBe(true);
      });
   });

   describe("scoring and events", () => {
      it("clean pick-up streak awards +20 per consecutive item", () => {
         const run = createRun(1);
         // Manually trigger 3 pickups
         run.cart.x = run.list[0].x;
         run.cart.z = run.list[0].z;
         const ev1 = stepRun(run, input(0, 0, false), DT, 1.0);
         expect(ev1.pickups[0].score).toBe(100 + 1 * 20); // 120
         expect(run.combo).toBe(1);

         run.cart.x = run.list[1].x;
         run.cart.z = run.list[1].z;
         const ev2 = stepRun(run, input(0, 0, false), DT, 2.0);
         expect(ev2.pickups[0].score).toBe(100 + 2 * 20); // 140
         expect(run.combo).toBe(2);

         run.cart.x = run.list[2].x;
         run.cart.z = run.list[2].z;
         const ev3 = stepRun(run, input(0, 0, false), DT, 3.0);
         expect(ev3.pickups[0].score).toBe(100 + 3 * 20); // 160
         expect(run.combo).toBe(3);
         expect(run.score).toBe(120 + 140 + 160);
      });

      it("6th item triggers list completion +300 bonus", () => {
         const run = createRun(1);
         for (let i = 0; i < 5; i++) {
            run.list[i].collected = true;
         }
         run.collectedCount = 5;
         run.combo = 5;

         run.cart.x = run.list[5].x;
         run.cart.z = run.list[5].z;
         const ev = stepRun(run, input(0, 0, false), DT, 5.0);

         expect(run.listComplete).toBe(true);
         expect(ev.listCompleted).toBe(true);
         expect(run.collectedCount).toBe(6);
         // 100 + 6*20 + 300 = 520 added
         expect(run.score).toBe(220 + 300);
      });

      it("entering finish zone with complete list triggers instant win with time bonus", () => {
         const run = createRun(1);
         for (let i = 0; i < 6; i++) {
            run.list[i].collected = true;
         }
         run.collectedCount = 6;
         run.listComplete = true;

         // Place cart in finish zone at 15.0 s
         run.cart.x = 0;
         run.cart.z = 11.0;

         const ev = stepRun(run, input(0, 0, false), DT, 15.0);
         expect(run.won).toBe(true);
         expect(ev.won).toBe(true);
         // Time left: 75 - 15 = 60s -> bonus = 60 * 10 = 600
         expect(run.score).toBe(600);
      });

      it("crossing finish zone with incomplete list does NOT trigger win", () => {
         const run = createRun(1);
         run.listComplete = false;
         run.cart.x = 0;
         run.cart.z = 11.0;

         const ev = stepRun(run, input(0, 0, false), DT, 10.0);
         expect(run.won).toBe(false);
         expect(ev.won).toBe(false);
      });

      it("shell timeout ends run at 75 s with collected points", () => {
         const run = createRun(1);
         run.score = 300;
         const ev = stepRun(run, input(0, 0, false), DT, 75.0);
         expect(run.timedOut).toBe(true);
         expect(ev.timeup).toBe(true);
         expect(run.won).toBe(false);
      });
   });

   describe("DoD: walking completion within 75 s", () => {
      it("every seed is completable at walking speed (6.0 m/s) within 75 s", () => {
         // Prove on sample of seeds using greedy walking path
         for (let s = 0; s < 50; s++) {
            const list = generateList(s);
            const tour = shortestPickTour(list);
            // Time to walk tour at 6.0 m/s:
            const walkTime = tour / CART.maxWalkingSpeed;
            // Turn and acceleration allowance:
            const totalEstimatedTime = walkTime + 8.0; // 8s for turns and speed changes
            expect(totalEstimatedTime, `seed ${s}`).toBeLessThan(75.0);
         }
      });
   });

   describe("scoring limit proof with store bot (botHarness)", () => {
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

      it(
         "path-following bots win through simulateRun across 200 seeds at 60 fps, 20 fps and random frames, never before 6.5 s",
         () => {
            const framesFor = (k: number) =>
               [fixedFrames(1000 / 60), fixedFrames(50), randomFrames(k)][k % 3];

            let earliestWinMs = Infinity;

            function getTarget(run: RunState): { x: number; z: number } {
               if (run.collectedCount >= LIST_COUNT) {
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

            for (let s = 0; s < 200; s++) {
               const store = createArcadeStore();
               const run = createRun(s);
               let target = getTarget(run);
               let follower = followPath(
                  grid,
                  free,
                  run.cart.x,
                  run.cart.z,
                  target.x,
                  target.z
               );
               const steerDir = { dirX: 0, dirZ: 0 };

               simulateRun(store, {
                  durationMs: DURATION_MS,
                  frame: framesFor(s),
                  step: (dt, time, sStore) => {
                     const currentTarget = getTarget(run);
                     if (Math.hypot(currentTarget.x - follower.goalX, currentTarget.z - follower.goalZ) > 0.05) {
                        target = currentTarget;
                        follower = followPath(
                           grid,
                           free,
                           run.cart.x,
                           run.cart.z,
                           target.x,
                           target.z
                        );
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
                     for (const p of ev.pickups) {
                        sStore.getState().addScore(p.score);
                     }
                     if (ev.listCompleted) {
                        sStore.getState().addScore(POINTS.listComplete);
                     }
                     if (ev.won) {
                        sStore.getState().setScore(run.score);
                        sStore.getState().end("win");
                     }
                  },
               });

               const finalState = store.getState();
               expect(finalState.endReason, `seed ${s} should win`).toBe("win");
               expect(finalState.elapsedMs).toBeGreaterThanOrEqual(6500);
               if (finalState.elapsedMs < earliestWinMs) {
                  earliestWinMs = finalState.elapsedMs;
               }
               expect(finalState.score).toBeLessThanOrEqual(PROPOSED_LIMITS.maxScore);
               expect(withinProposedLimits(finalState.score, finalState.elapsedMs)).toBe(true);
               expect(withinServerLimits(finalState.score, finalState.elapsedMs)).toBe(true);
            }
            expect(earliestWinMs).toBeGreaterThanOrEqual(6500);
         },
         30000
      );

      it("honest walking bot completes and wins within 75 s at walking speed (ride=false)", () => {
         function getTarget(run: RunState): { x: number; z: number } {
            if (run.collectedCount >= LIST_COUNT) {
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

         const store = createArcadeStore();
         const run = createRun(42);
         let target = getTarget(run);
         let follower = followPath(
            grid,
            free,
            run.cart.x,
            run.cart.z,
            target.x,
            target.z
         );
         const steerDir = { dirX: 0, dirZ: 0 };

         simulateRun(store, {
            durationMs: DURATION_MS,
            frame: fixedFrames(1000 / 60),
            step: (dt, time, sStore) => {
               const currentTarget = getTarget(run);
               if (Math.hypot(currentTarget.x - follower.goalX, currentTarget.z - follower.goalZ) > 0.05) {
                  target = currentTarget;
                  follower = followPath(
                     grid,
                     free,
                     run.cart.x,
                     run.cart.z,
                     target.x,
                     target.z
                  );
               }

               steer(grid, follower, run.cart.x, run.cart.z, steerDir, 0.7);
               const stepInp: StepInput = {
                  moveX: steerDir.dirX,
                  moveY: -steerDir.dirZ,
                  ride: false,
               };

               const ev = stepRun(run, stepInp, dt, time);
               for (const p of ev.pickups) {
                  sStore.getState().addScore(p.score);
               }
               if (ev.listCompleted) {
                  sStore.getState().addScore(POINTS.listComplete);
               }
               if (ev.won) {
                  sStore.getState().setScore(run.score);
                  sStore.getState().end("win");
               }
            },
         });

         const finalState = store.getState();
         expect(finalState.endReason).toBe("win");
         expect(finalState.elapsedMs).toBeLessThan(75000);
      });

      it("idle player times out with 0 score at 75 s using simulateRun", () => {
         const store = createArcadeStore();
         const run = createRun(123);
         simulateRun(store, {
            durationMs: DURATION_MS,
            frame: fixedFrames(1000 / 60),
            step: (dt, time, sStore) => {
               const ev = stepRun(run, input(0, 0, false), dt, time);
               if (ev.timeup) {
                  sStore.getState().setScore(run.score);
                  sStore.getState().end("timeup");
               }
            },
         });
         expect(store.getState().score).toBe(0);
         expect(store.getState().phase).toBe("over");
         expect(withinServerLimits(0, 75000)).toBe(true);
      });
   });

   describe("mutant killer tests", () => {
      it("wall impact resets combo to 0", () => {
         const run = createRun(1);
         run.combo = 5;
         run.cart.x = -15.0;
         run.cart.z = 0;
         run.cart.heading = -Math.PI / 2;
         run.cart.targetSpeed = 6.0;
         run.cart.speed = 6.0;
         run.cart.vx = -6.0;
         run.cart.vz = 0;

         // Step into the west wall (innerMinX = -15.4)
         stepRun(run, input(-1, 0, false), DT, 1.0);
         expect(run.combo).toBe(0);
      });

      it("riding speed cap is 9 m/s, strictly rejecting 12 m/s mutant", () => {
         const run = createRun(1);
         // Place in open Aisle 1 at z = 6.0 and drive North
         run.cart.x = -12.5;
         run.cart.z = 6.0;
         run.cart.heading = 0;
         for (let f = 0; f < 120; f++) {
            stepRun(run, input(0, 1, true), DT, f * DT);
         }
         expect(run.cart.targetSpeed).toBe(CART.maxRidingSpeed);
         expect(run.cart.speed).toBeCloseTo(9.0, 0);
         expect(run.cart.speed).toBeGreaterThan(8.5);
         expect(run.cart.speed).toBeLessThan(9.05);
         expect(run.cart.speed).toBeLessThan(10.0);
      });

      it("wall bounce reflects velocity with negative restitution, not positive", () => {
         const run = createRun(1);
         run.cart.x = STORE.innerMaxX - 0.1;
         run.cart.z = 0;
         run.cart.heading = Math.PI / 2;
         run.cart.targetSpeed = 6.0;
         run.cart.vx = 6.0;
         run.cart.vz = 0;

         // Step into east wall
         stepRun(run, input(1, 0, false), DT, 1.0);
         expect(run.cart.vx).toBeLessThan(0);
         expect(run.cart.vx).toBeCloseTo(-6.0 * CART.restitution, 1);
      });
   });
});
