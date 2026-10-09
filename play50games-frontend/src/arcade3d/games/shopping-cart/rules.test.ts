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
   CRASH_NORMAL_SPEED,
   DURATION_MS,
   FALLBACK_LIST,
   LIST_COUNT,
   MIN_TOUR_DISTANCE,
   MIN_WIN_ROUTE_M,
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
   shelvesBetween,
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

      it("the design's 52 m tour gate holds on 1,000 seeds", () => {
         expect(MIN_TOUR_DISTANCE).toBe(52);
         for (let i = 0; i < SEEDS.length; i++) {
            const list = generateList(SEEDS[i]);
            const tour = shortestPickTour(list);
            expect(tour, `seed ${SEEDS[i]}`).toBeGreaterThanOrEqual(52);
         }
      });

      it("fallback list is valid and its storeDistance tour is 73.9 m (>= 52 m)", () => {
         expect(FALLBACK_LIST).toHaveLength(6);
         expect(new Set(FALLBACK_LIST.map((it) => it.kind)).size).toBe(6);
         for (const it of FALLBACK_LIST) {
            const slot = SHELF_SLOTS[it.slotIndex];
            expect([it.x, it.z]).toEqual([slot.x, slot.z]);
         }
         const tour = shortestPickTour(FALLBACK_LIST);
         expect(tour).toBeCloseTo(73.9, 6);
         expect(tour).toBeGreaterThanOrEqual(52);
      });
   });

   describe("aisle routing (storeDistance, shelvesBetween)", () => {
      it("shelvesBetween is true only when a whole shelf lies between the two x values", () => {
         expect(shelvesBetween(-8.1, -4.9)).toBe(false); // one aisle, facing faces
         expect(shelvesBetween(-9.9, -8.1)).toBe(true); // opposite faces of shelf 1
         expect(shelvesBetween(-12, -9.9)).toBe(false); // west wall aisle
         expect(shelvesBetween(-9.9, 6.9)).toBe(true); // across islands
      });

      it("facing slots across one aisle are the Manhattan distance apart", () => {
         expect(storeDistance({ x: -8.1, z: -1.5 }, { x: -4.9, z: -1.5 })).toBeCloseTo(3.2, 9);
         expect(storeDistance({ x: -3.1, z: -5.0 }, { x: 0.1, z: 2.0 })).toBeCloseTo(3.2 + 7.0, 9);
      });

      it("opposite faces of one shelf route round its nearer end", () => {
         // -1.5 is 6.3 m from both walkways: 6.3 + 6.3 + 1.8
         expect(storeDistance({ x: -9.9, z: -1.5 }, { x: -8.1, z: -1.5 })).toBeCloseTo(14.4, 9);
         // -5.0 is nearer the north walkway (-7.8): 2.8 + 2.8 + 1.8
         expect(storeDistance({ x: -9.9, z: -5.0 }, { x: -8.1, z: -5.0 })).toBeCloseTo(7.4, 9);
         // 2.0 is nearer the south walkway (4.8): 2.8 + 2.8 + 1.8
         expect(storeDistance({ x: 0.1, z: 2.0 }, { x: 1.9, z: 2.0 })).toBeCloseTo(7.4, 9);
      });

      it("across several islands goes round the shelves; walkway points stay Manhattan", () => {
         expect(storeDistance({ x: -9.9, z: -5.0 }, { x: 6.9, z: -5.0 })).toBeCloseTo(2.8 + 2.8 + 16.8, 9);
         expect(storeDistance({ x: -9.9, z: -5.0 }, { x: 6.9, z: 2.0 })).toBeCloseTo(2.8 + 9.8 + 16.8, 9);
         // both south of the shelves (start -> checkout) and both north of them
         expect(storeDistance({ x: START_POS.x, z: START_POS.z }, { x: 0, z: 10.5 })).toBeCloseTo(12 + 4.5, 9);
         expect(storeDistance({ x: -12, z: -9 }, { x: 10, z: -8 })).toBeCloseTo(22 + 1, 9);
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
         const shopperCartDist = Math.hypot(run.shoppers[0].agent.x - run.cart.x, run.shoppers[0].agent.z - run.cart.z);
         expect(shopperCartDist).toBeGreaterThanOrEqual(CART.radius + 0.45 - 1e-3);
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

      it("scrape along shelf maintains combo streak; direct impact (> 1.5 m/s) resets combo", () => {
         // 1. Soft scrape: cart moving fast along Z, gently touching shelf in X (normal speed <= 1.5)
         const runScrape = createRun(1);
         runScrape.combo = 3;
         // Shelf 0 is at x: [-9.5, -8.5], z: [-8.0, 4.0]. Half-width 0.55.
         // West face is at x = -9.5. Cart at x = -10.055 touches west face with dx = 0.555.
         // Moving north with slight drift east into the face:
         runScrape.cart.x = -10.055;
         runScrape.cart.z = 0;
         runScrape.cart.heading = 0;
         runScrape.cart.targetSpeed = 4.0;
         runScrape.cart.speed = 4.0;
         runScrape.cart.vx = 0.4; // normal velocity <= 1.5 m/s into west face
         runScrape.cart.vz = -4.0; // sliding fast along aisle
         stepRun(runScrape, input(0, 1, false), DT, 1.0);
         expect(runScrape.combo, "soft scrape preserves combo").toBe(3);

         // 2. Direct impact: cart driving head-on into shelf with normal speed > 1.5 m/s
         const runCrash = createRun(1);
         runCrash.combo = 3;
         runCrash.cart.x = -10.42;
         runCrash.cart.z = 0;
         runCrash.cart.heading = Math.PI / 2;
         runCrash.cart.targetSpeed = 4.0;
         runCrash.cart.speed = 4.0;
         runCrash.cart.vx = 4.0; // head-on > 1.5 m/s into west face
         runCrash.cart.vz = 0;
         stepRun(runCrash, input(1, 0, false), DT, 1.0);
         expect(runCrash.combo, "head-on impact resets combo").toBe(0);
      });

      // A cart already moving at `speed` along `heading` with no input: targetSpeed is set so that
      // after this frame's drag it equals `speed`, so grip leaves the velocity unchanged and the
      // contact's normal speed is exactly `speed`.
      function hitAt(x: number, z: number, heading: number, speed: number): RunState {
         const run = createRun(1);
         run.combo = 3;
         run.cart.x = x;
         run.cart.z = z;
         run.cart.heading = heading;
         run.cart.targetSpeed = speed + CART.dragDecel * DT;
         run.cart.vx = Math.sin(heading) * speed;
         run.cart.vz = -Math.cos(heading) * speed;
         run.cart.speed = speed;
         stepRun(run, input(0, 0, false), DT, 1.0);
         return run;
      }

      it("only a real crash breaks the combo: 2.9 m/s into a shelf keeps it, 3.1 m/s breaks it", () => {
         expect(CRASH_NORMAL_SPEED).toBe(3.0);
         // heading east: proxy half x 0.8; shelf 1 west face at x -9.6
         const soft = hitAt(-10.42, 0, Math.PI / 2, 2.9);
         expect(soft.cart.vx, "the shelf stopped the cart").toBeCloseTo(0, 6);
         expect(soft.combo, "2.9 m/s contact keeps the combo").toBe(3);
         const hard = hitAt(-10.42, 0, Math.PI / 2, 3.1);
         expect(hard.cart.vx).toBeCloseTo(0, 6);
         expect(hard.combo, "3.1 m/s crash breaks the combo").toBe(0);
      });

      it("only a real crash into a wall breaks the combo: 2.9 m/s keeps it, 3.1 m/s breaks it", () => {
         // heading west into the west wall (inner x -15.4), clear of every solid
         const soft = hitAt(-14.62, 0, -Math.PI / 2, 2.9);
         expect(soft.cart.vx, "bounced").toBeGreaterThan(0);
         expect(soft.combo).toBe(3);
         const hard = hitAt(-14.62, 0, -Math.PI / 2, 3.1);
         expect(hard.cart.vx).toBeGreaterThan(0);
         expect(hard.combo).toBe(0);
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
            expect(tour, `seed ${s}`).toBeGreaterThanOrEqual(MIN_TOUR_DISTANCE);
            // Time to walk tour at 6.0 m/s:
            const walkTime = tour / CART.maxWalkingSpeed;
            // Turn and acceleration allowance:
            const totalEstimatedTime = walkTime + 8.0; // 8s for turns and speed changes
            expect(totalEstimatedTime, `seed ${s}`).toBeLessThan(75.0);
         }
      });

      it("kinematic part of the 3500 ms proof: no cart covers the 30.91 m win route in 3.5 s", () => {
         expect(MIN_WIN_ROUTE_M).toBe(30.91);
         const T = PROPOSED_LIMITS.minDurationMs / 1000;
         const maxDt = 0.05; // the run clock's frame cap
         // In a frame starting at t, targetSpeed <= 12 (t + dt) and |v| <= targetSpeed (grip is a convex
         // step towards it; slides, rebounds and stuns only shrink it): |v| <= min(9, 12 t + 0.6).
         const vMax = (t: number) => Math.min(CART.maxRidingSpeed, CART.throttleAccel * (t + maxDt));
         const tCap = (CART.maxRidingSpeed - CART.throttleAccel * maxDt) / CART.throttleAccel; // 0.7 s
         const envelope =
            CART.throttleAccel * (tCap * tCap / 2 + maxDt * tCap) + CART.maxRidingSpeed * (T - tCap);
         expect(envelope).toBeCloseTo(28.56, 9);
         // the same bound with 20 fps frames (right-endpoint sum): 28.35 m
         let frames = 0;
         for (let k = 1; k <= Math.round(T / maxDt); k++) {
            frames += Math.min(CART.maxRidingSpeed, CART.throttleAccel * k * maxDt) * maxDt;
         }
         expect(frames).toBeCloseTo(28.35, 9);
         expect(frames).toBeLessThanOrEqual(envelope);
         expect(envelope).toBeLessThan(MIN_WIN_ROUTE_M);
         expect(vMax(0)).toBeCloseTo(0.6, 9);

         // the real stepRun from rest, riding flat out in open floor, never beats the envelope
         for (const dt of [1 / 60, 1 / 30, maxDt]) {
            const run = createRun(1);
            run.cart.x = -14.5;
            run.cart.z = 10.5; // west end of the checkout row, heading east: 29 m of clear floor
            run.cart.heading = Math.PI / 2;
            let path = 0;
            let t = 0;
            while (t < T - 1e-9) {
               const px = run.cart.x;
               const pz = run.cart.z;
               stepRun(run, input(1, 0, true), dt, t);
               t += dt;
               path += Math.hypot(run.cart.x - px, run.cart.z - pz);
               expect(run.cart.speed, `dt ${dt} t ${t}`).toBeLessThanOrEqual(vMax(t - dt) + 1e-9);
            }
            expect(path, `dt ${dt}`).toBeLessThanOrEqual(envelope);
         }
      });

      it("max score arithmetic: 2030 at the 3.5 s floor, inside 1700 + 100/s at every duration", () => {
         const comboMax = POINTS.comboStep * (1 + 2 + 3 + 4 + 5 + 6); // 420
         const timeUpMax = LIST_COUNT * POINTS.item + comboMax + POINTS.listComplete; // 1320
         expect(timeUpMax).toBe(1320);
         const best = (ms: number) => runScore(LIST_COUNT, comboMax, true, true, DURATION_MS - ms);
         expect(best(PROPOSED_LIMITS.minDurationMs)).toBe(2030);
         expect(PROPOSED_LIMITS.maxScore).toBe(2030);
         for (let ms = PROPOSED_LIMITS.minDurationMs; ms <= DURATION_MS; ms += 50) {
            const s = best(ms);
            expect(s).toBeLessThanOrEqual(PROPOSED_LIMITS.maxScore);
            expect(s).toBeLessThanOrEqual(PROPOSED_LIMITS.base + (PROPOSED_LIMITS.maxPointsPerSec * ms) / 1000);
            expect(withinServerLimits(s, ms), `${ms} ms`).toBe(true);
         }
         expect(withinServerLimits(timeUpMax, DURATION_MS + 2000)).toBe(true);
         expect(withinServerLimits(2030, 3499)).toBe(false);
         expect(withinServerLimits(2031, 3500)).toBe(false);
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
         "path-following bots win through simulateRun across 200 seeds at 60 fps, 20 fps and random frames, never before 3.5 s",
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
               expect(finalState.elapsedMs).toBeGreaterThanOrEqual(3500);
               if (finalState.elapsedMs < earliestWinMs) {
                  earliestWinMs = finalState.elapsedMs;
               }
               expect(finalState.score).toBeLessThanOrEqual(PROPOSED_LIMITS.maxScore);
               expect(withinProposedLimits(finalState.score, finalState.elapsedMs)).toBe(true);
               expect(withinServerLimits(finalState.score, finalState.elapsedMs)).toBe(true);
            }
            expect(earliestWinMs).toBeGreaterThanOrEqual(3500);
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
      describe("M1: every perimeter wall rebounds at exactly restitution x the impact speed", () => {
         // No input and targetSpeed 0: grip eases the velocity by exp(-gripNormal * DT) before the
         // wall clamp, so the rebound speed is 4 * exp(-6 * DT) * 0.3 (1.086 m/s); without
         // restitution it would be 3.62 m/s, with none at all 0.
         const impact = 4 * Math.exp(-CART.gripNormal * DT);
         const rebound = impact * CART.restitution;
         function wallHit(x: number, z: number, vx: number, vz: number): RunState {
            const run = createRun(1);
            run.cart.x = x;
            run.cart.z = z;
            run.cart.heading = 0; // proxy half extents 0.45 (x) and 0.8 (z)
            run.cart.targetSpeed = 0;
            run.cart.vx = vx;
            run.cart.vz = vz;
            run.cart.speed = Math.hypot(vx, vz);
            stepRun(run, input(0, 0, false), DT, 1.0);
            return run;
         }

         it("west wall (inner x -15.4)", () => {
            const run = wallHit(-15.0, 0, -4, 0);
            expect(run.cart.x).toBeCloseTo(STORE.innerMinX + CART.proxyHalfX, 9);
            expect(run.cart.vx).toBeCloseTo(rebound, 6);
         });

         it("east wall (inner x 15.4)", () => {
            const run = wallHit(15.0, 8, 4, 0);
            expect(run.cart.x).toBeCloseTo(STORE.innerMaxX - CART.proxyHalfX, 9);
            expect(run.cart.vx).toBeCloseTo(-rebound, 6);
         });

         it("north wall (inner z -11.4), west of the freezer row", () => {
            const run = wallHit(-14.0, -11.0, 0, -4);
            expect(run.cart.z).toBeCloseTo(STORE.innerMinZ + CART.proxyHalfZ, 9);
            expect(run.cart.vz).toBeCloseTo(rebound, 6);
         });

         it("south wall (inner z 11.4)", () => {
            const run = wallHit(-12.0, 11.0, 0, 4);
            expect(run.cart.z).toBeCloseTo(STORE.innerMaxZ - CART.proxyHalfZ, 9);
            expect(run.cart.vz).toBeCloseTo(-rebound, 6);
         });
      });

      it("M6: win with 45.5 s left earns floor(45.5) * 10 = 450 pts (strictly rejecting Math.ceil mutant of 460 pts)", () => {
         const run = createRun(1);
         for (let i = 0; i < 6; i++) {
            run.list[i].collected = true;
         }
         run.collectedCount = 6;
         run.listComplete = true;
         run.score = 1000;

         // Finish zone at t = 29.5 s -> timeLeftMs = 75000 - 29500 = 45500 ms (45.5 s)
         run.cart.x = 0;
         run.cart.z = 11.0;
         stepRun(run, input(0, 0, false), DT, 29.5);

         expect(run.won).toBe(true);
         // Expect score = 1000 + 45 * 10 = 1450, rejecting 1000 + 46 * 10 = 1460
         expect(run.score).toBe(1450);
         expect(run.score).not.toBe(1460);
      });

      it("M8: spill grip 1.5 preserves higher slide velocity after turn compared to normal grip 6.0", () => {
         const runSpill = createRun(1);
         runSpill.cart.x = SPILLS[0].x;
         runSpill.cart.z = SPILLS[0].z;
         runSpill.cart.heading = 0;
         runSpill.cart.targetSpeed = 0;
         runSpill.cart.speed = 3.0;
         runSpill.cart.vx = 3.0;
         runSpill.cart.vz = 0;

         const runDry = createRun(1);
         runDry.cart.x = 0;
         runDry.cart.z = 9.0;
         runDry.cart.heading = 0;
         runDry.cart.targetSpeed = 0;
         runDry.cart.speed = 3.0;
         runDry.cart.vx = 3.0;
         runDry.cart.vz = 0;

         // Step both for 4 frames at t = 30.0 s (when spill is active)
         for (let f = 0; f < 4; f++) {
            stepRun(runSpill, input(0, 0, false), DT, 30.0 + f * DT);
            stepRun(runDry, input(0, 0, false), DT, 30.0 + f * DT);
         }

         // In the spill (grip = 1.5), lateral slide velocity vx is preserved much more than on dry floor (grip = 6.0)
         expect(runSpill.cart.vx).toBeGreaterThan(runDry.cart.vx + 0.5);
      });

      it("M9: shopperD is inactive before 40 s and active at 40 s (strictly rejecting active from 0s mutant)", () => {
         const run = createRun(1);
         const shopperD = run.shoppers.find((s) => s.id === "shopperD")!;
         expect(shopperD).toBeDefined();
         expect(shopperD.active).toBe(false);

         // Step at t = 39.9 s
         stepRun(run, input(0, 0, false), DT, 39.9);
         expect(shopperD.active).toBe(false);

         // Step at t = 40.0 s
         stepRun(run, input(0, 0, false), DT, 40.0);
         expect(shopperD.active).toBe(true);
      });

      it("M10: input during stun timer does not change cart heading or target speed (strictly rejecting unlocked input mutant)", () => {
         const run = createRun(1);
         run.cart.stunTimer = 0.8;
         run.cart.heading = 0;
         run.cart.targetSpeed = 0;
         run.cart.speed = 0;

         // Full steering input while stunned
         stepRun(run, input(1, 0, false), DT, 1.0);
         expect(run.cart.heading, "heading must not change while stunned").toBe(0);
         expect(run.cart.targetSpeed, "target speed must remain 0 while stunned").toBe(0);
         expect(run.cart.speed).toBe(0);
      });

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
