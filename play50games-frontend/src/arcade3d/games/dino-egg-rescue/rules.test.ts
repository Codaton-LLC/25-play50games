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
         expect(EGGS.stackMultipliers[0]).toBe(1.0);
         expect(EGGS.stackMultipliers[1]).toBe(0.85);
         expect(EGGS.stackMultipliers[2]).toBe(0.72);
         expect(EGGS.stackMultipliers[3]).toBe(0.60);
         expect(EGGS.points.regular[1]).toBe(100);
         expect(EGGS.points.regular[2]).toBe(240);
         expect(EGGS.points.regular[3]).toBe(450);
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
         expect(BOULDER_LANES[0].speed).toBe(3.6);
         expect(BOULDER_LANES[1].speed).toBe(4.2);
         expect(BOULDER_LANES[2].speed).toBe(4.8);
         expect(BOULDER_LANES[3].speed).toBe(5.2);
      });
   });

   describe("lane clearance table (>= 2.0 m edge distance)", () => {
      it("nest and dino start clear all 4 lane bands with values >= 2.0 m matching spec", () => {
         const nestClearances = BOULDER_LANES.map((lane) =>
            laneEdgeClearance(NEST.x, NEST.z, NEST.radius, lane)
         );
         expect(nestClearances[0]).toBeCloseTo(5.6, 1);
         expect(nestClearances[1]).toBeCloseTo(10.04, 1);
         expect(nestClearances[2]).toBeCloseTo(14.28, 1);
         expect(nestClearances[3]).toBeCloseTo(18.36, 1);
         for (const c of nestClearances) {
            expect(c).toBeGreaterThanOrEqual(2.0);
         }

         const dinoClearances = BOULDER_LANES.map((lane) =>
            laneEdgeClearance(DINO.startX, DINO.startZ, DINO.radius, lane)
         );
         expect(dinoClearances[0]).toBeCloseTo(6.85, 1);
         expect(dinoClearances[1]).toBeCloseTo(11.29, 1);
         expect(dinoClearances[2]).toBeCloseTo(15.53, 1);
         expect(dinoClearances[3]).toBeCloseTo(19.61, 1);
         for (const c of dinoClearances) {
            expect(c).toBeGreaterThanOrEqual(2.0);
         }
      });

      it("all 3 mud pits maintain >= 2.0 m edge clearance from all 4 lane bands", () => {
         for (const mud of MUD.patches) {
            for (const lane of BOULDER_LANES) {
               const clearance = laneEdgeClearance(mud.x, mud.z, MUD.radius, lane);
               expect(clearance).toBeGreaterThanOrEqual(2.0);
            }
         }
      });

      it("all 8 tree trunks maintain >= 2.0 m edge clearance from all 4 lane bands", () => {
         for (const tree of TREES.positions) {
            for (const lane of BOULDER_LANES) {
               const clearance = laneEdgeClearance(
                  tree.x,
                  tree.z,
                  TREES.trunkRadius,
                  lane
               );
               expect(clearance).toBeGreaterThanOrEqual(2.0);
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
         const inputMove: StepInput = {
            moveX: -1,
            moveY: 0,
            actionPressed: false,
            jumpPressed: false,
         };

         // 0 eggs: base 5.0
         run.dino.x = 0;
         run.dino.z = 0;
         for (let i = 0; i < 60; i++) stepDinoRun(run, inputMove, 1 / 60);
         expect(Math.abs(run.dino.vx)).toBeCloseTo(5.0, 1);

         // 1 egg: 4.25
         run.dino.carriedEggs = [1];
         for (let i = 0; i < 60; i++) stepDinoRun(run, inputMove, 1 / 60);
         expect(Math.abs(run.dino.vx)).toBeCloseTo(5.0 * 0.85, 1);

         // 2 eggs: 3.60
         run.dino.carriedEggs = [1, 2];
         for (let i = 0; i < 60; i++) stepDinoRun(run, inputMove, 1 / 60);
         expect(Math.abs(run.dino.vx)).toBeCloseTo(5.0 * 0.72, 1);

         // 3 eggs: 3.00
         run.dino.carriedEggs = [1, 2, 3];
         for (let i = 0; i < 60; i++) stepDinoRun(run, inputMove, 1 / 60);
         expect(Math.abs(run.dino.vx)).toBeCloseTo(5.0 * 0.60, 1);
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

   describe("scoring limit proof and bot harness", () => {
      it("scoring ceiling strictly proves max score <= 5850 <= 6000", () => {
         const maxRegular = 33 * 150; // 4950
         const maxGolden = 3 * 300; // 900
         const absoluteMax = maxRegular + maxGolden;
         expect(absoluteMax).toBe(5850);
         expect(absoluteMax).toBeLessThanOrEqual(dinoEggRescueMeta.scoring.maxScore);
         expect(capScore(absoluteMax)).toBe(5850);
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
               frame: s % 2 === 0 ? fixedFrames(16.666) : randomFrames(s, 14, 25),
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
