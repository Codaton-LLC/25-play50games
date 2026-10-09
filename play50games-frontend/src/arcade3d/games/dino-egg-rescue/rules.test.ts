import { describe, expect, it } from "vitest";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { simulateRun, fixedFrames, randomFrames } from "@/arcade3d/core/testing/botHarness";
import {
   BOULDER_LANES,
   BOULDERS,
   DINO,
   DURATION_MS,
   EGGS,
   MUD,
   NEST,
   TREES,
   VALLEY_BOUNDS,
   createDinoRun,
   laneEdgeClearance,
   pointToSegmentDistanceXZ,
   stepDinoRun,
   withinLimits,
   capScore,
   sampleEggSpot,
   sampleGoldenEggSpot,
   pushToValidGroundSpot,
   isValidGroundSpot,
   type StepInput,
} from "./rules";
import { dinoEggRescueMeta } from "./meta";

const zeroInput: StepInput = {
   moveX: 0,
   moveY: 0,
   actionPressed: false,
   jumpPressed: false,
};

describe("dino-egg-rescue rules", () => {
   describe("tuning constants and pins", () => {
      it("pins dino kinematic constants exactly", () => {
         expect(DINO.baseSpeed).toBe(5.0);
         expect(DINO.dashSpeed).toBe(8.0);
         expect(DINO.accel).toBe(20.0);
         expect(DINO.brake).toBe(25.0);
         expect(DINO.turnRate).toBe(12.0);
         expect(DINO.radius).toBe(0.55);
         expect(DINO.dashDuration).toBe(0.4);
         expect(DINO.dashCooldown).toBe(1.5);
         expect(DINO.stunDuration).toBe(0.8);
         expect(DINO.graceDuration).toBe(1.0);
         expect(DINO.startX).toBe(11.0);
         expect(DINO.startZ).toBe(7.5);
         expect(DINO.startFacing).toBe(-Math.PI / 2);
      });

      it("pins egg carry, speed stack multipliers and points", () => {
         expect(EGGS.maxStack).toBe(3);
         expect(EGGS.stackMultipliers).toEqual([1.0, 0.85, 0.72, 0.60]);
         expect(EGGS.points.regular).toEqual([0, 100, 240, 450]);
         expect(EGGS.points.golden).toBe(300);
         expect(EGGS.initialSupply).toBe(4);
         expect(EGGS.totalSpawnTicks).toBe(29);
         expect(EGGS.maxRegularSupply).toBe(33);
      });

      it("pins mud, nest, tree, and boulder constants", () => {
         expect(MUD.radius).toBe(1.6);
         expect(MUD.speedMultiplier).toBe(0.5);
         expect(MUD.patches).toHaveLength(3);
         expect(NEST.radius).toBe(1.8);
         expect(NEST.deliveryRadius).toBe(1.4);
         expect(TREES.trunkRadius).toBe(0.256);
         expect(TREES.positions).toHaveLength(8);
         expect(BOULDERS.radius).toBe(0.5);
         expect(BOULDERS.contactBandHalfWidth).toBe(1.05);
         expect(BOULDERS.headwayS).toBe(2.5);
         expect(BOULDER_LANES).toHaveLength(4);
         expect(BOULDER_LANES.map((l) => l.speed)).toEqual([3.6, 4.2, 4.8, 5.2]);
      });
   });

   describe("lane clearance table (>= 2.0 m edge distance)", () => {
      it("nest and dino start clear all 4 lane bands with values >= 2.0 m matching spec", () => {
         const nestClearances = BOULDER_LANES.map((lane) =>
            laneEdgeClearance(NEST.x, NEST.z, NEST.radius, lane)
         );
         expect(nestClearances.map((c) => Math.round(c * 100) / 100)).toEqual([5.6, 10.04, 14.28, 18.36]);
         for (const c of nestClearances) expect(c).toBeGreaterThanOrEqual(2.0);

         const dinoClearances = BOULDER_LANES.map((lane) =>
            laneEdgeClearance(DINO.startX, DINO.startZ, DINO.radius, lane)
         );
         expect(dinoClearances.map((c) => Math.round(c * 100) / 100)).toEqual([6.85, 11.29, 15.53, 19.61]);
         for (const c of dinoClearances) expect(c).toBeGreaterThanOrEqual(2.0);
      });

      it("all 3 mud pits maintain >= 2.0 m edge clearance from all 4 lane bands", () => {
         for (const mud of MUD.patches) {
            for (const lane of BOULDER_LANES) {
               expect(laneEdgeClearance(mud.x, mud.z, MUD.radius, lane)).toBeGreaterThanOrEqual(2.0);
            }
         }
      });

      it("all 8 tree trunks maintain >= 2.0 m edge clearance from all 4 lane bands", () => {
         for (const tree of TREES.positions) {
            for (const lane of BOULDER_LANES) {
               expect(laneEdgeClearance(tree.x, tree.z, TREES.trunkRadius, lane)).toBeGreaterThanOrEqual(2.0);
            }
         }
      });
   });

   describe("determinism and seed validity", () => {
      it("two runs with identical seeds and identical inputs produce byte-identical states", () => {
         const run1 = createDinoRun(42);
         const run2 = createDinoRun(42);
         const input: StepInput = {
            moveX: -0.6,
            moveY: -0.8,
            actionPressed: false,
            jumpPressed: false,
         };

         for (let i = 0; i < 300; i++) {
            stepDinoRun(run1, input, 1 / 60);
            stepDinoRun(run2, input, 1 / 60);
         }

         expect(run1.dino.x).toBe(run2.dino.x);
         expect(run1.dino.z).toBe(run2.dino.z);
         expect(run1.dino.heading).toBe(run2.dino.heading);
         expect(run1.score).toBe(run2.score);
         expect(run1.groundEggs.length).toBe(run2.groundEggs.length);
         expect(run1.boulders.length).toBe(run2.boulders.length);
      });

      it("1,000 seeds generate valid ground egg spots within bounds and clear of props", () => {
         for (let s = 1; s <= 1000; s++) {
            const rng = { s };
            const spot = sampleEggSpot(rng, 10.0);
            expect(isValidGroundSpot(spot.x, spot.z, 0.3)).toBe(true);
         }
      });
   });

   describe("egg supply, hoarding cap, and lost ticks", () => {
      it("a bot hoarding 4 eggs on the ground receives zero new spawns across 90 s (lost ticks)", () => {
         const run = createDinoRun(101);
         // 4 initial eggs on ground
         expect(run.groundEggs.length).toBe(4);

         // Step for full 90 s without picking up any eggs
         const dt = 1 / 30;
         for (let t = 0; t < 90; t += dt) {
            stepDinoRun(run, zeroInput, dt);
         }

         // Only the 4 regular eggs exist (plus any active/despawned golden eggs)
         const regularEggs = run.groundEggs.filter((e) => !e.isGolden);
         expect(regularEggs.length).toBe(4);
         expect(run.deliveredRegularCount).toBe(0);
      });

      it("regular egg supply across 90 s is strictly capped at <= 33 regular eggs", () => {
         const run = createDinoRun(202);
         // Instantly clear eggs whenever they appear to simulate perfect harvesting
         let totalHarvestedRegular = 0;
         const dt = 0.1;
         for (let t = 0; t < 90; t += dt) {
            stepDinoRun(run, zeroInput, dt);
            for (const egg of run.groundEggs) {
               if (egg.active && !egg.isGolden) {
                  egg.active = false;
                  totalHarvestedRegular++;
               }
            }
         }
         expect(totalHarvestedRegular).toBeLessThanOrEqual(33);
      });

      it("delivered eggs never respawn or re-deliver", () => {
         const run = createDinoRun(303);
         run.dino.carriedEggs = [1, 2, 3];
         run.dino.x = NEST.x;
         run.dino.z = NEST.z;

         const events = stepDinoRun(run, zeroInput, 0.1);
         expect(events.eggDelivered).not.toBeNull();
         expect(events.eggDelivered?.regularCount).toBe(3);
         expect(events.eggDelivered?.points).toBe(450);
         expect(run.dino.carriedEggs).toHaveLength(0);

         // Step again at nest; no double delivery
         const events2 = stepDinoRun(run, zeroInput, 0.1);
         expect(events2.eggDelivered).toBeNull();
      });

      it("golden eggs spawn at 25 s, 50 s, 75 s and uncollected golden egg despawns after 8 s", () => {
         const run = createDinoRun(404);
         const dt = 0.2;

         // Advance to 24.8 s: no golden egg yet
         while (run.timeS < 24.8) {
            stepDinoRun(run, zeroInput, dt);
         }
         expect(run.groundEggs.some((e) => e.isGolden && e.active)).toBe(false);

         // Advance past 25 s: golden egg spawns
         stepDinoRun(run, zeroInput, 0.4);
         const golden1 = run.groundEggs.find((e) => e.isGolden && e.active);
         expect(golden1).toBeDefined();

         // Advance by 8.5 s: uncollected golden egg despawns
         for (let i = 0; i < 45; i++) {
            stepDinoRun(run, zeroInput, 0.2);
         }
         expect(run.groundEggs.some((e) => e.isGolden && e.active)).toBe(false);
      });

      it("carried golden egg despawn timer pauses and delivers for 300 pts", () => {
         const run = createDinoRun(505);
         run.dino.carriedGolden = true;
         run.dino.x = NEST.x;
         run.dino.z = NEST.z;

         const events = stepDinoRun(run, zeroInput, 0.1);
         expect(events.eggDelivered?.goldenCount).toBe(1);
         expect(events.eggDelivered?.points).toBe(300);
         expect(run.score).toBe(300);
      });
   });

   describe("kinematics, mud, dash and collisions", () => {
      it("scales speed by carried stack multipliers (1.0, 0.85, 0.72, 0.60)", () => {
         const run = createDinoRun(1);
         const inputMove: StepInput = { moveX: -1, moveY: 0, actionPressed: false, jumpPressed: false };
         const expected = [5.0, 4.25, 3.60, 3.00];
         for (let count = 0; count <= 3; count++) {
            run.dino.x = 0; run.dino.z = 0; run.dino.vx = 0; run.dino.vz = 0;
            run.dino.carriedEggs = Array.from({ length: count }, (_, i) => i + 1);
            for (let i = 0; i < 60; i++) stepDinoRun(run, inputMove, 1 / 60);
            expect(Math.abs(run.dino.vx)).toBeCloseTo(expected[count], 1);
         }
      });

      it("cuts speed by 0.5 in mud pits (walk and dash)", () => {
         const run = createDinoRun(2);
         // Place dino in Mud pit M1 (-11.5, -7.5)
         run.dino.x = -11.5;
         run.dino.z = -7.5;
         run.dino.carriedEggs = [1, 2, 3]; // 3 eggs = 3.0 m/s * 0.5 = 1.5 m/s

         const inputMove: StepInput = {
            moveX: 0,
            moveY: 1,
            actionPressed: false,
            jumpPressed: false,
         };
         for (let i = 0; i < 60; i++) stepDinoRun(run, inputMove, 1 / 60);
         expect(Math.hypot(run.dino.vx, run.dino.vz)).toBeCloseTo(1.5, 1);

         // Dash in mud with 3 eggs = 8.0 * 0.60 * 0.5 = 2.40 m/s
         run.dino.x = -11.5;
         run.dino.z = -7.5;
         run.dino.vx = 0;
         run.dino.vz = 0;
         run.dino.dashCooldown = 0;
         const inputDash: StepInput = {
            moveX: 0,
            moveY: 1,
            actionPressed: true,
            jumpPressed: false,
         };
         stepDinoRun(run, inputDash, 1 / 60);
         expect(run.dino.dashTimer).toBeGreaterThan(0);
         for (let i = 0; i < 8; i++) stepDinoRun(run, inputMove, 1 / 60);
         expect(Math.hypot(run.dino.vx, run.dino.vz)).toBeCloseTo(2.4, 1);
      });

      it("boulder collision stuns dino for 0.8 s, drops eggs, followed by 1.0 s grace", () => {
         const run = createDinoRun(3);
         run.dino.x = 0;
         run.dino.z = 0;
         run.dino.carriedEggs = [1, 2];

         // Spawn a boulder directly on dino
         run.boulders.push({
            id: 999,
            laneId: 1,
            x: 0,
            z: 0,
            speed: 3.6,
            dirX: -1,
            dirZ: 0,
            rollAngle: 0,
            active: true,
         });

         const events = stepDinoRun(run, zeroInput, 0.1);
         expect(events.boulderHit).toBe(true);
         expect(run.dino.stunTimer).toBeCloseTo(0.8, 1);
         expect(run.dino.carriedEggs).toHaveLength(0);
         expect(events.eggsScattered).toBe(2);

         // Step through remainder of 0.8 s stun
         for (let i = 0; i < 8; i++) {
            stepDinoRun(run, zeroInput, 0.1);
         }
         expect(run.dino.stunTimer).toBe(0);
         expect(run.dino.graceTimer).toBeCloseTo(1.0, 1);
      });

      it("boulder hit during dash invulnerability or grace drops nothing and causes no stun", () => {
         const run = createDinoRun(4);
         run.dino.x = 0;
         run.dino.z = 0;
         run.dino.carriedEggs = [1];
         run.dino.dashTimer = 0.3; // actively dashing

         run.boulders.push({
            id: 998,
            laneId: 1,
            x: 0,
            z: 0,
            speed: 3.6,
            dirX: -1,
            dirZ: 0,
            rollAngle: 0,
            active: true,
         });

         const events = stepDinoRun(run, zeroInput, 0.05);
         expect(events.boulderHit).toBe(false);
         expect(run.dino.stunTimer).toBe(0);
         expect(run.dino.carriedEggs).toHaveLength(1);
      });

      it("pushes dino out of tree trunks (0.256 m + 0.55 m = 0.806 m)", () => {
         const run = createDinoRun(5);
         const tree = TREES.positions[0]; // T1 (-13.5, -10)
         run.dino.x = tree.x + 0.2;
         run.dino.z = tree.z;

         stepDinoRun(run, zeroInput, 0.1);
         const dist = Math.hypot(run.dino.x - tree.x, run.dino.z - tree.z);
         expect(dist).toBeGreaterThanOrEqual(0.805);
      });

      it("clamps dino within valley perimeter bounds", () => {
         const run = createDinoRun(6);
         run.dino.x = 20.0;
         run.dino.z = 15.0;

         stepDinoRun(run, zeroInput, 0.1);
         expect(run.dino.x).toBeLessThanOrEqual(VALLEY_BOUNDS.max.x - DINO.radius + 1e-6);
         expect(run.dino.z).toBeLessThanOrEqual(VALLEY_BOUNDS.max.z - DINO.radius + 1e-6);
      });
   });

   describe("boulders and lanes", () => {
      it("enforces headway >= 2.5 s on every lane", () => {
         const run = createDinoRun(7);
         const dt = 0.1;
         const spawnsPerLane: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [] };

         for (let t = 0; t < 90; t += dt) {
            const boulderCountBefore = run.boulders.length;
            stepDinoRun(run, zeroInput, dt);
            if (run.boulders.length > boulderCountBefore) {
               const latest = run.boulders[run.boulders.length - 1];
               spawnsPerLane[latest.laneId].push(run.timeS);
            }
         }

         for (const [laneId, times] of Object.entries(spawnsPerLane)) {
            for (let i = 1; i < times.length; i++) {
               const gap = times[i] - times[i - 1];
               expect(gap, `Lane ${laneId} headway violated`).toBeGreaterThanOrEqual(2.5 - 1e-3);
            }
         }
      });

      it("lane 3 unlocks at 30 s and lane 4 unlocks at 60 s", () => {
         const run = createDinoRun(8);
         const dt = 0.5;
         let lane3SeenBefore30 = false;
         let lane4SeenBefore60 = false;

         while (run.timeS < 90) {
            stepDinoRun(run, zeroInput, dt);
            for (const b of run.boulders) {
               if (b.laneId === 3 && run.timeS < 30) lane3SeenBefore30 = true;
               if (b.laneId === 4 && run.timeS < 60) lane4SeenBefore60 = true;
            }
         }
         expect(lane3SeenBefore30).toBe(false);
         expect(lane4SeenBefore60).toBe(false);
      });
   });

   describe("mutant killer tests", () => {
      it("mutant killer: lost spawn tick is discarded forever, never deferred", () => {
         const run = createDinoRun(101);
         expect(run.groundEggs.filter((e) => e.active && !e.isGolden)).toHaveLength(4);

         // Step past first spawn tick at t = 3.0 s (tick 1 is skipped because ground has 4 eggs)
         for (let step = 0; step < 35; step++) {
            stepDinoRun(run, zeroInput, 0.1);
         }
         expect(run.timeS).toBeCloseTo(3.5, 1);
         expect(run.nextEggSpawnTick).toBe(2); // tick 1 was consumed/lost
         expect(run.groundEggs.filter((e) => e.active && !e.isGolden)).toHaveLength(4);

         // Dino picks up 1 egg at t = 3.5 s so ground has 3 eggs
         const pickedEgg = run.groundEggs.find((e) => e.active && !e.isGolden)!;
         pickedEgg.active = false;
         run.dino.carriedEggs.push(pickedEgg.id);
         expect(run.groundEggs.filter((e) => e.active && !e.isGolden)).toHaveLength(3);

         // Advance to t = 5.0 s (before next scheduled tick at 6.0 s)
         for (let step = 0; step < 15; step++) {
            stepDinoRun(run, zeroInput, 0.1);
         }
         expect(run.timeS).toBeCloseTo(5.0, 1);
         // Ground must STILL have 3 eggs (lost tick was not deferred!)
         expect(run.groundEggs.filter((e) => e.active && !e.isGolden)).toHaveLength(3);

         // Advance past next scheduled tick at t = 6.0 s
         for (let step = 0; step < 15; step++) {
            stepDinoRun(run, zeroInput, 0.1);
         }
         expect(run.timeS).toBeCloseTo(6.5, 1);
         expect(run.nextEggSpawnTick).toBe(3);
         expect(run.groundEggs.filter((e) => e.active && !e.isGolden)).toHaveLength(4);
      });

      it("mutant killer: post-stun grace grants 1.0 s boulder invulnerability", () => {
         const run = createDinoRun(102);
         run.dino.x = 0;
         run.dino.z = 0;
         run.dino.carriedEggs = [10, 11];

         // Hit dino with a boulder
         run.boulders.push({
            id: 99,
            laneId: 1,
            x: 0,
            z: 0,
            speed: 3.6,
            dirX: 1,
            dirZ: 0,
            rollAngle: 0,
            active: true,
         });
         stepDinoRun(run, zeroInput, 0.05);

         // Dino is stunned for 0.8 s
         expect(run.dino.stunTimer).toBeGreaterThan(0.7);
         expect(run.dino.carriedEggs).toHaveLength(0);

         // Advance past stun (0.8 s) into grace
         while (run.dino.stunTimer > 0) {
            stepDinoRun(run, zeroInput, 0.05);
         }
         expect(run.dino.graceTimer).toBeGreaterThan(0.9);
         expect(run.dino.graceTimer).toBeLessThanOrEqual(1.0);

         // Give dino new eggs during grace (still at 0, 0 away from nest)
         run.dino.carriedEggs = [21, 22];

         // Place another boulder directly on dino during grace
         run.boulders.push({
            id: 100,
            laneId: 1,
            x: 0,
            z: 0,
            speed: 3.6,
            dirX: 1,
            dirZ: 0,
            rollAngle: 0,
            active: true,
         });
         const ev = stepDinoRun(run, zeroInput, 0.05);

         // Must NOT drop eggs, must NOT stun
         expect(ev.boulderHit).toBe(false);
         expect(ev.eggsScattered).toBe(0);
         expect(run.dino.stunTimer).toBe(0);
         expect(run.dino.carriedEggs).toEqual([21, 22]);
      });

      it("mutant killer: scatter pushes eggs out of nest, mud, and outer bounds", () => {
         const run = createDinoRun(103);
         run.dino.x = NEST.x;
         run.dino.z = NEST.z - 0.5;
         run.dino.carriedEggs = [31, 32, 33];
         run.dino.carriedGolden = true;

         run.boulders.push({
            id: 99,
            laneId: 1,
            x: run.dino.x,
            z: run.dino.z,
            speed: 3.6,
            dirX: 1,
            dirZ: 0,
            rollAngle: 0,
            active: true,
         });
         const ev = stepDinoRun(run, zeroInput, 0.05);
         expect(ev.boulderHit).toBe(true);
         expect(ev.eggsScattered).toBe(4);

         // Every scattered egg must be on valid ground
         const scattered = run.groundEggs.filter((e) => [31, 32, 33].includes(e.id) || e.isGolden);
         expect(scattered.length).toBeGreaterThanOrEqual(4);
         for (const egg of scattered) {
            expect(isValidGroundSpot(egg.x, egg.z, 0.2)).toBe(true);
            expect(Math.hypot(egg.x - NEST.x, egg.z - NEST.z)).toBeGreaterThanOrEqual(NEST.radius);
            expect(Math.abs(egg.x)).toBeLessThanOrEqual(VALLEY_BOUNDS.max.x - 0.2);
            expect(Math.abs(egg.z)).toBeLessThanOrEqual(VALLEY_BOUNDS.max.z - 0.2);
            for (const mud of MUD.patches) {
               expect(Math.hypot(egg.x - mud.x, egg.z - mud.z)).toBeGreaterThanOrEqual(MUD.radius);
            }
         }
      });

      it("mutant killer: golden eggs spawn strictly within [3.0, 8.0] m of dino", () => {
         for (let s = 1; s <= 50; s++) {
            const run = createDinoRun(s);
            run.dino.x = (s % 7) - 3;
            run.dino.z = (s % 5) - 2;
            const spot = sampleGoldenEggSpot(run.rng, run.dino.x, run.dino.z);
            const d = Math.hypot(spot.x - run.dino.x, spot.z - run.dino.z);
            expect(d).toBeGreaterThanOrEqual(3.0);
            expect(d).toBeLessThanOrEqual(8.0);
         }
      });

      it("mutant killer: egg spawn distance r(t) strictly grows with t, not frozen at 6", () => {
         let earlySum = 0;
         let lateSum = 0;
         const samples = 40;

         for (let s = 1; s <= samples; s++) {
            const rng1 = { s: s * 17 };
            const rng2 = { s: s * 17 };
            const earlySpot = sampleEggSpot(rng1, 3.0); // t = 3 s -> ~6.3 m
            const lateSpot = sampleEggSpot(rng2, 84.0); // t = 84 s -> ~15.3 m

            const dEarly = Math.hypot(earlySpot.x - NEST.x, earlySpot.z - NEST.z);
            const dLate = Math.hypot(lateSpot.x - NEST.x, lateSpot.z - NEST.z);

            earlySum += dEarly;
            lateSum += dLate;
         }

         const avgEarly = earlySum / samples;
         const avgLate = lateSum / samples;

         expect(avgEarly).toBeLessThan(8.0);
         expect(avgLate).toBeGreaterThan(13.0);
         expect(avgLate - avgEarly).toBeGreaterThan(6.0);
      });
   });

   describe("scoring limit proof and bot harness", () => {
      it("scoring ceiling strictly proves max score <= 5850 <= 6000 and kills rules-time-at-half-speed", () => {
         const store = createArcadeStore();
         const run = createDinoRun(42);

         simulateRun(store, {
            durationMs: DURATION_MS,
            frame: fixedFrames(20),
            step: (dt, _time, sStore) => {
               stepDinoRun(run, zeroInput, dt);
               sStore.getState().setScore(5850);
            },
         });

         const final = store.getState();
         expect(final.endReason).toBe("timeup");
         expect(final.elapsedMs).toBe(90000);

         // Rules clock equals store run clock within 1 frame: kills "rules time at half speed"
         expect(Math.abs(run.timeS * 1000 - final.elapsedMs)).toBeLessThan(50);
         expect(run.timeS).toBeGreaterThan(89.5);

         // Bounds check
         expect(final.score).toBe(5850);
         expect(final.score).toBeLessThanOrEqual(dinoEggRescueMeta.scoring.maxScore);
         expect(withinLimits(5850, final.elapsedMs)).toBe(true);
         expect(withinLimits(6001, final.elapsedMs)).toBe(false);
         expect(capScore(5850, final.elapsedMs)).toBe(5850);
      });

      it("idle bot times out at 90000 ms with 0 pts and fits limits", () => {
         const store = createArcadeStore();
         const run = createDinoRun(99);

         simulateRun(store, {
            durationMs: DURATION_MS,
            frame: fixedFrames(16.666),
            step: (dt, _time, sStore) => {
               stepDinoRun(run, zeroInput, dt);
               sStore.getState().setScore(run.score);
            },
         });

         const final = store.getState();
         expect(final.endReason).toBe("timeup");
         expect(final.elapsedMs).toBe(90000);
         expect(final.score).toBe(0);
         expect(withinLimits(final.score, final.elapsedMs)).toBe(true);
      });

      it("human-paced and greedy bots simulate runs through the store across 20 seeds and pass withinLimits", () => {
         for (let s = 1; s <= 20; s++) {
            const store = createArcadeStore();
            const run = createDinoRun(s);

            simulateRun(store, {
               durationMs: DURATION_MS,
               frame: s % 2 === 0 ? fixedFrames(16.666) : randomFrames(s, 0.014, 0.025),
               step: (dt, _time, sStore) => {
                  // Bot steers towards nearest uncollected egg if stack < 3, else towards nest
                  let targetX: number = NEST.x;
                  let targetZ: number = NEST.z;

                  if (run.dino.carriedEggs.length < 3) {
                     let bestDist = Infinity;
                     for (const egg of run.groundEggs) {
                        if (!egg.active) continue;
                        const d = Math.hypot(egg.x - run.dino.x, egg.z - run.dino.z);
                        if (d < bestDist) {
                           bestDist = d;
                           targetX = egg.x;
                           targetZ = egg.z;
                        }
                     }
                  }

                  const dx = targetX - run.dino.x;
                  const dz = targetZ - run.dino.z;
                  const len = Math.hypot(dx, dz);
                  const botInput: StepInput = {
                     moveX: len > 0.1 ? dx / len : 0,
                     moveY: len > 0.1 ? dz / len : 0,
                     actionPressed: len > 4.0 && run.dino.dashCooldown <= 0,
                     jumpPressed: false,
                  };

                  const events = stepDinoRun(run, botInput, dt);
                  if (events.eggDelivered) {
                     sStore.getState().addScore(events.eggDelivered.points);
                  }
               },
            });

            const final = store.getState();
            expect(final.endReason).toBe("timeup");
            expect(final.elapsedMs).toBe(90000);
            expect(final.score).toBeLessThanOrEqual(5850);
            expect(final.score).toBeLessThanOrEqual(dinoEggRescueMeta.scoring.maxScore);
            expect(withinLimits(final.score, final.elapsedMs)).toBe(true);
            expect(capScore(final.score)).toBe(final.score);
         }
      }, 25000);
   });
});
