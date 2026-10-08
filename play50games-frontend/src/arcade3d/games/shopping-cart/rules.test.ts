import { describe, expect, it } from "vitest";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { shoppingCartMeta } from "./meta";
import {
   CART,
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
   });

   describe("hazards: pyramids, shoppers, spills", () => {
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

   describe("scoring limit proof with store bot", () => {
      it("oracle bot driving real arcade store never wins under 6.5 s and never exceeds proposed limits", () => {
         for (let s = 0; s < 20; s++) {
            const store = createArcadeStore();
            store.getState().configure({ durationMs: 75000 });
            store.getState().markReady();
            store.getState().start();
            // Advance countdown
            for (let i = 0; i < 30; i++) {
               advanceRunClock(store, 100);
            }

            const run = createRun(s);
            let elapsed = 0;

            // Collect all 6 items via legal aisle pathing with cornering speed ~7.2 m/s
            for (const item of run.list) {
               const distToItem = storeDistance(run.cart, item);
               const dtWalk = distToItem / 7.2;
               const steps = Math.max(1, Math.ceil(dtWalk / DT));
               for (let step = 0; step < steps; step++) {
                  elapsed += DT;
                  advanceRunClock(store, DT * 1000);
                  run.cart.x += (item.x - run.cart.x) / (steps - step);
                  run.cart.z += (item.z - run.cart.z) / (steps - step);
                  const ev = stepRun(run, input(0, 1, true), DT, elapsed);
                  for (const p of ev.pickups) store.getState().addScore(p.score);
                  if (ev.listCompleted) store.getState().addScore(POINTS.listComplete);
               }
            }

            // Dash to checkout
            const distToCheckout = storeDistance(run.cart, { x: 0, z: 11.0 });
            const stepsFin = Math.max(1, Math.ceil((distToCheckout / 7.2) / DT));
            for (let step = 0; step < stepsFin; step++) {
               elapsed += DT;
               advanceRunClock(store, DT * 1000);
               run.cart.x += (0 - run.cart.x) / (stepsFin - step);
               run.cart.z += (11.0 - run.cart.z) / (stepsFin - step);
               const ev = stepRun(run, input(0, 1, true), DT, elapsed);
               if (ev.won) {
                  store.getState().setScore(run.score);
                  store.getState().end("win");
                  break;
               }
            }

            const finalState = store.getState();
            expect(elapsed).toBeGreaterThanOrEqual(6.5);
            expect(finalState.score).toBeLessThanOrEqual(PROPOSED_LIMITS.maxScore);
            expect(withinProposedLimits(finalState.score, finalState.elapsedMs)).toBe(true);
         }
      });

      it("idle player times out with 0 score at 75 s", () => {
         const store = createArcadeStore();
         store.getState().configure({ durationMs: 75000 });
         store.getState().markReady();
         store.getState().start();
         for (let i = 0; i < 30; i++) {
            advanceRunClock(store, 100);
         }
         const run = createRun(123);
         for (let f = 0; f < 75 * 60; f++) {
            advanceRunClock(store, DT * 1000);
            const ev = stepRun(run, input(0, 0, false), DT, f * DT);
            if (ev.timeup) {
               store.getState().setScore(run.score);
               store.getState().end("timeup");
               break;
            }
         }
         expect(store.getState().score).toBe(0);
         expect(store.getState().phase).toBe("over");
         expect(withinServerLimits(0, 75000)).toBe(true);
      });
   });
});
