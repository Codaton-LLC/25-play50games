// Dino Egg Rescue rules: valley layout, dino kinematics, egg supply/spawns,
// boulder gullies, mud pits, stack delivery, and scoring.
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now.
// Scene.tsx feeds it input, dt and play time; rules.test.ts tests it directly.

import { clampToBounds, type AABB, type Vec3Like } from "@/arcade3d/core/collision";
import { capScore as capToLimits, withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { createRng, rngNext, turnTowards, type RngState } from "@/arcade3d/core/math";
import { dinoEggRescueMeta } from "./meta";

// ---------- tuning constants ----------

export const DURATION_MS = 90_000;
export const RESULT_DELAY_MS = 1200;

export const VALLEY = {
   halfX: 15,
   halfZ: 11,
} as const;

export const VALLEY_BOUNDS: AABB = {
   min: { x: -15, y: 0, z: -11 },
   max: { x: 15, y: 0, z: 11 },
};

export const DINO = {
   radius: 0.55,
   length: 1.1,
   height: 0.8,
   baseSpeed: 5.0,
   accel: 20.0,
   brake: 25.0,
   turnRate: 12.0,
   dashSpeed: 8.0,
   dashDuration: 0.4,
   dashCooldown: 1.5,
   stunDuration: 0.8,
   graceDuration: 1.0,
   startX: 11.0,
   startZ: 7.5,
   startFacing: -Math.PI / 2, // facing -x towards valley
} as const;

export const NEST = {
   x: 11.0,
   z: 7.5,
   radius: 1.8,
   deliveryRadius: 1.4,
} as const;

export const MUD = {
   radius: 1.6,
   speedMultiplier: 0.5,
   patches: [
      { x: -11.5, z: -7.5 }, // M1 NW
      { x: 11.5, z: 1.0 },   // M2 SE
      { x: 6.5, z: 9.3 },    // M3 SE
   ] as const,
} as const;

export const TREES = {
   trunkRadius: 0.256,
   positions: [
      { x: -13.5, z: -10.0 }, // T1
      { x: -7.5, z: -9.8 },   // T2
      { x: -13.8, z: -4.6 },  // T3
      { x: 14.0, z: -2.5 },   // T4
      { x: 14.2, z: 4.5 },    // T5
      { x: 8.0, z: 4.5 },     // T6
      { x: 14.0, z: 10.0 },   // T7
      { x: 3.5, z: 10.2 },    // T8
   ] as const,
} as const;

export interface BoulderLane {
   id: number;
   startX: number;
   startZ: number;
   endX: number;
   endZ: number;
   speed: number;
   unlockS: number;
}

export const BOULDER_LANES: readonly BoulderLane[] = [
   { id: 1, startX: 14, startZ: -11, endX: -2, endZ: 11, speed: 3.6, unlockS: 0 },
   { id: 2, startX: 9, startZ: -11, endX: -8, endZ: 11, speed: 4.2, unlockS: 0 },
   { id: 3, startX: 4, startZ: -11, endX: -14, endZ: 11, speed: 4.8, unlockS: 30 },
   { id: 4, startX: -1, startZ: -11, endX: -15, endZ: 5, speed: 5.2, unlockS: 60 },
] as const;

export const BOULDERS = {
   radius: 0.5,
   contactBandHalfWidth: 1.05, // 0.5 + 0.55
   headwayS: 2.5,
   spawnIntervalStartS: 3.0,
   spawnIntervalEndS: 1.2,
} as const;

export const EGGS = {
   maxStack: 3,
   stackMultipliers: [1.0, 0.85, 0.72, 0.60] as const,
   pickupRadius: 0.6,
   goldenPickupRadius: 0.7,
   initialSupply: 4,
   maxGroundEggs: 4,
   totalSpawnTicks: 29,
   maxRegularSupply: 33, // 4 start + 29 interval ticks
   goldenSpawnTimes: [25, 50, 75] as const,
   goldenDespawnS: 8.0,
   scatterDistance: 1.5,
   points: {
      regular: [0, 100, 240, 450] as const,
      golden: 300,
   },
} as const;

// ---------- geometry and clearance helpers ----------

/** 2D point-to-segment distance on XZ plane. */
export function pointToSegmentDistanceXZ(
   px: number,
   pz: number,
   ax: number,
   az: number,
   bx: number,
   bz: number
): number {
   const abx = bx - ax;
   const abz = bz - az;
   const apx = px - ax;
   const apz = pz - az;
   const abLenSq = abx * abx + abz * abz;
   if (abLenSq <= 1e-12) {
      return Math.hypot(apx, apz);
   }
   const t = Math.max(0, Math.min(1, (apx * abx + apz * abz) / abLenSq));
   const cx = ax + t * abx;
   const cz = az + t * abz;
   return Math.hypot(px - cx, pz - cz);
}

/** Edge clearance from an item circle to the lane contact band (half-width 1.05 m). */
export function laneEdgeClearance(
   px: number,
   pz: number,
   radius: number,
   lane: BoulderLane
): number {
   const centerDist = pointToSegmentDistanceXZ(
      px,
      pz,
      lane.startX,
      lane.startZ,
      lane.endX,
      lane.endZ
   );
   return centerDist - radius - BOULDERS.contactBandHalfWidth;
}

// ---------- data structures ----------

export interface DinoEntity {
   x: number;
   z: number;
   vx: number;
   vz: number;
   heading: number;
   dashTimer: number;
   dashCooldown: number;
   stunTimer: number;
   graceTimer: number;
   waddlePhase: number;
   carriedEggs: number[]; // ids of carried regular eggs
   carriedGolden: boolean;
}

export interface GroundEgg {
   id: number;
   x: number;
   z: number;
   isGolden: boolean;
   active: boolean;
   despawnTimer?: number;
}

export interface BoulderEntity {
   id: number;
   laneId: number;
   x: number;
   z: number;
   speed: number;
   dirX: number;
   dirZ: number;
   rollAngle: number;
   active: boolean;
}

export interface StepInput {
   moveX: number;
   moveY: number;
   actionPressed: boolean;
   jumpPressed: boolean;
}

export interface GameEvents {
   dashStarted: boolean;
   footstep: boolean;
   eggPicked: boolean;
   goldenPicked: boolean;
   eggDelivered: {
      regularCount: number;
      goldenCount: number;
      points: number;
   } | null;
   boulderHit: boolean;
   eggsScattered: number;
   goldenSpawned: boolean;
}

export interface DinoRunState {
   seed: number;
   rng: RngState;
   timeS: number;
   dino: DinoEntity;
   groundEggs: GroundEgg[];
   boulders: BoulderEntity[];
   deliveredRegularCount: number;
   deliveredGoldenCount: number;
   score: number;
   nextEggSpawnTick: number; // 1..29
   goldenSpawnIndex: number; // 0..3
   nextBoulderSpawnTime: number;
   laneLastSpawnTime: number[]; // [lane1, lane2, lane3, lane4]
   nextBoulderId: number;
   nextEggId: number;
   footstepAccumulator: number;
}

// ---------- valid ground placement ----------

export function isValidGroundSpot(x: number, z: number, margin = 0.3): boolean {
   // 1. In bounds
   if (
      x < VALLEY_BOUNDS.min.x + margin ||
      x > VALLEY_BOUNDS.max.x - margin ||
      z < VALLEY_BOUNDS.min.z + margin ||
      z > VALLEY_BOUNDS.max.z - margin
   ) {
      return false;
   }

   // 2. Outside nest zone
   if (Math.hypot(x - NEST.x, z - NEST.z) < NEST.radius + margin) {
      return false;
   }

   // 3. Outside mud pits
   for (const mud of MUD.patches) {
      if (Math.hypot(x - mud.x, z - mud.z) < MUD.radius + margin) {
         return false;
      }
   }

   // 4. Outside tree trunks
   for (const tree of TREES.positions) {
      if (Math.hypot(x - tree.x, z - tree.z) < TREES.trunkRadius + margin) {
         return false;
      }
   }

   return true;
}

/** Pushes or clamps an invalid spot into the nearest valid free ground spot. */
export function pushToValidGroundSpot(
   p: { x: number; z: number },
   margin = 0.3
): { x: number; z: number } {
   let x = Math.max(
      VALLEY_BOUNDS.min.x + margin,
      Math.min(VALLEY_BOUNDS.max.x - margin, p.x)
   );
   let z = Math.max(
      VALLEY_BOUNDS.min.z + margin,
      Math.min(VALLEY_BOUNDS.max.z - margin, p.z)
   );

   // Push out of nest zone
   const nestDist = Math.hypot(x - NEST.x, z - NEST.z);
   const minNestDist = NEST.radius + margin;
   if (nestDist < minNestDist) {
      const angle = nestDist > 1e-6 ? Math.atan2(z - NEST.z, x - NEST.x) : Math.PI;
      x = NEST.x + Math.cos(angle) * minNestDist;
      z = NEST.z + Math.sin(angle) * minNestDist;
   }

   // Push out of mud pits
   for (const mud of MUD.patches) {
      const dist = Math.hypot(x - mud.x, z - mud.z);
      const minDist = MUD.radius + margin;
      if (dist < minDist) {
         const angle = dist > 1e-6 ? Math.atan2(z - mud.z, x - mud.x) : 0;
         x = mud.x + Math.cos(angle) * minDist;
         z = mud.z + Math.sin(angle) * minDist;
      }
   }

   // Push out of trees
   for (const tree of TREES.positions) {
      const dist = Math.hypot(x - tree.x, z - tree.z);
      const minDist = TREES.trunkRadius + margin;
      if (dist < minDist) {
         const angle = dist > 1e-6 ? Math.atan2(z - tree.z, x - tree.x) : 0;
         x = tree.x + Math.cos(angle) * minDist;
         z = tree.z + Math.sin(angle) * minDist;
      }
   }

   x = Math.max(
      VALLEY_BOUNDS.min.x + margin,
      Math.min(VALLEY_BOUNDS.max.x - margin, x)
   );
   z = Math.max(
      VALLEY_BOUNDS.min.z + margin,
      Math.min(VALLEY_BOUNDS.max.z - margin, z)
   );

   return { x, z };
}

/** Samples a valid regular egg spot at time t around the nest. */
export function sampleEggSpot(
   rng: RngState,
   t: number
): { x: number; z: number } {
   const baseR = 6.0 + (10.0 * t) / 90.0;
   for (let attempt = 0; attempt < 64; attempt++) {
      const r = baseR + (rngNext(rng) * 3.0 - 1.5);
      // Nest is SE at (11, 7.5); valley lies predominantly towards -x (W) and -z (N).
      // Sample angle across the valley quadrant (roughly 110 deg to 250 deg)
      const angle = Math.PI * 0.65 + rngNext(rng) * Math.PI * 0.9;
      const candX = NEST.x + Math.cos(angle) * r;
      const candZ = NEST.z + Math.sin(angle) * r;
      if (isValidGroundSpot(candX, candZ, 0.4)) {
         return { x: candX, z: candZ };
      }
   }
   // Fallback: guaranteed valid spot clamped
   return pushToValidGroundSpot({ x: NEST.x - baseR, z: NEST.z - baseR * 0.5 }, 0.4);
}

/** Samples a valid golden egg spot within 8 m of the dino. */
export function sampleGoldenEggSpot(
   rng: RngState,
   dinoX: number,
   dinoZ: number
): { x: number; z: number } {
   for (let attempt = 0; attempt < 64; attempt++) {
      const r = 3.0 + rngNext(rng) * 5.0; // 3 to 8 m
      const angle = rngNext(rng) * Math.PI * 2;
      const candX = dinoX + Math.cos(angle) * r;
      const candZ = dinoZ + Math.sin(angle) * r;
      if (isValidGroundSpot(candX, candZ, 0.4)) {
         return { x: candX, z: candZ };
      }
   }
   return pushToValidGroundSpot({ x: dinoX - 4.0, z: dinoZ - 2.0 }, 0.4);
}

// ---------- factory ----------

export function createDinoRun(seed: number): DinoRunState {
   const rng: RngState = { s: (seed >>> 0) || 1 };
   const dino: DinoEntity = {
      x: DINO.startX,
      z: DINO.startZ,
      vx: 0,
      vz: 0,
      heading: DINO.startFacing,
      dashTimer: 0,
      dashCooldown: 0,
      stunTimer: 0,
      graceTimer: 0,
      waddlePhase: 0,
      carriedEggs: [],
      carriedGolden: false,
   };

   // 4 initial regular eggs at t = 0
   const groundEggs: GroundEgg[] = [];
   for (let i = 0; i < EGGS.initialSupply; i++) {
      const pt = sampleEggSpot(rng, 0);
      groundEggs.push({
         id: i + 1,
         x: pt.x,
         z: pt.z,
         isGolden: false,
         active: true,
      });
   }

   return {
      seed,
      rng,
      timeS: 0,
      dino,
      groundEggs,
      boulders: [],
      deliveredRegularCount: 0,
      deliveredGoldenCount: 0,
      score: 0,
      nextEggSpawnTick: 1, // k = 1..29 (t = 3, 6, ..., 87 s)
      goldenSpawnIndex: 0, // 0..2
      nextBoulderSpawnTime: 0.5,
      laneLastSpawnTime: [-99, -99, -99, -99],
      nextBoulderId: 1,
      nextEggId: EGGS.initialSupply + 1,
      footstepAccumulator: 0,
   };
}

// ---------- simulation step ----------

export function stepDinoRun(
   run: DinoRunState,
   input: StepInput,
   dt: number
): GameEvents {
   const events: GameEvents = {
      dashStarted: false,
      footstep: false,
      eggPicked: false,
      goldenPicked: false,
      eggDelivered: null,
      boulderHit: false,
      eggsScattered: 0,
      goldenSpawned: false,
   };

   if (!(dt > 0)) return events;
   run.timeS += dt;
   const t = run.timeS;
   const { dino, rng } = run;

   // 1. Golden egg despawn countdown
   for (const egg of run.groundEggs) {
      if (egg.active && egg.isGolden && egg.despawnTimer !== undefined) {
         egg.despawnTimer -= dt;
         if (egg.despawnTimer <= 0) {
            egg.active = false;
         }
      }
   }

   // 2. Scheduled golden egg spawns (at 25, 50, 75 s)
   if (run.goldenSpawnIndex < EGGS.goldenSpawnTimes.length) {
      const targetTime = EGGS.goldenSpawnTimes[run.goldenSpawnIndex];
      if (t >= targetTime) {
         const spot = sampleGoldenEggSpot(rng, dino.x, dino.z);
         run.groundEggs.push({
            id: run.nextEggId++,
            x: spot.x,
            z: spot.z,
            isGolden: true,
            active: true,
            despawnTimer: EGGS.goldenDespawnS,
         });
         run.goldenSpawnIndex++;
         events.goldenSpawned = true;
      }
   }

   // 3. Regular egg spawn ticks at t = 3k (k = 1..29)
   while (run.nextEggSpawnTick <= EGGS.totalSpawnTicks) {
      const tickTime = run.nextEggSpawnTick * 3.0;
      if (t >= tickTime) {
         // Check active regular eggs on ground
         const groundRegularCount = run.groundEggs.filter(
            (e) => e.active && !e.isGolden
         ).length;
         if (groundRegularCount < EGGS.maxGroundEggs) {
            const spot = sampleEggSpot(rng, tickTime);
            run.groundEggs.push({
               id: run.nextEggId++,
               x: spot.x,
               z: spot.z,
               isGolden: false,
               active: true,
            });
         }
         // If >= 4 eggs on ground, tick is skipped and lost forever!
         run.nextEggSpawnTick++;
      } else {
         break;
      }
   }

   // 4. Boulder spawning schedule
   const spawnInterval =
      BOULDERS.spawnIntervalStartS -
      ((BOULDERS.spawnIntervalStartS - BOULDERS.spawnIntervalEndS) * Math.min(90, t)) / 90;

   if (t >= run.nextBoulderSpawnTime) {
      run.nextBoulderSpawnTime += spawnInterval;

      // Filter eligible lanes
      const eligibleLanes: BoulderLane[] = [];
      for (const lane of BOULDER_LANES) {
         if (t >= lane.unlockS) {
            const lastSpawn = run.laneLastSpawnTime[lane.id - 1];
            if (t - lastSpawn >= BOULDERS.headwayS) {
               eligibleLanes.push(lane);
            }
         }
      }

      if (eligibleLanes.length > 0) {
         const chosenIndex = Math.floor(rngNext(rng) * eligibleLanes.length);
         const chosenLane = eligibleLanes[chosenIndex];
         run.laneLastSpawnTime[chosenLane.id - 1] = t;

         const dx = chosenLane.endX - chosenLane.startX;
         const dz = chosenLane.endZ - chosenLane.startZ;
         const len = Math.hypot(dx, dz);
         const dirX = len > 1e-6 ? dx / len : 0;
         const dirZ = len > 1e-6 ? dz / len : 1;

         run.boulders.push({
            id: run.nextBoulderId++,
            laneId: chosenLane.id,
            x: chosenLane.startX,
            z: chosenLane.startZ,
            speed: chosenLane.speed,
            dirX,
            dirZ,
            rollAngle: 0,
            active: true,
         });
      }
   }

   // 5. Boulder movement and despawn
   for (const boulder of run.boulders) {
      if (!boulder.active) continue;
      boulder.x += boulder.dirX * boulder.speed * dt;
      boulder.z += boulder.dirZ * boulder.speed * dt;
      boulder.rollAngle += (boulder.speed * dt) / BOULDERS.radius;

      const lane = BOULDER_LANES[boulder.laneId - 1];
      const remainingDist = Math.hypot(lane.endX - boulder.x, lane.endZ - boulder.z);
      const totalDist = Math.hypot(lane.endX - lane.startX, lane.endZ - lane.startZ);
      const progressDist = Math.hypot(boulder.x - lane.startX, boulder.z - lane.startZ);
      if (progressDist >= totalDist || remainingDist < 0.2) {
         boulder.active = false;
      }
   }

   // 6. Dino timers: stun, grace, dash cooldown, dash duration
   if (dino.stunTimer > 0) {
      dino.stunTimer -= dt;
      if (dino.stunTimer <= 1e-6) {
         dino.stunTimer = 0;
         dino.graceTimer = DINO.graceDuration; // 1.0 s grace after stun ends
      }
   } else if (dino.graceTimer > 0) {
      dino.graceTimer = dino.graceTimer <= dt + 1e-6 ? 0 : dino.graceTimer - dt;
   }
   if (dino.dashCooldown > 0) {
      dino.dashCooldown = dino.dashCooldown <= dt + 1e-6 ? 0 : dino.dashCooldown - dt;
   }
   if (dino.dashTimer > 0) {
      dino.dashTimer = dino.dashTimer <= dt + 1e-6 ? 0 : dino.dashTimer - dt;
   }

   // 7. Dash initiation
   const wantsDash = input.actionPressed || input.jumpPressed;
   if (wantsDash && dino.dashCooldown <= 0 && dino.stunTimer <= 0) {
      dino.dashTimer = DINO.dashDuration;
      dino.dashCooldown = DINO.dashCooldown;
      events.dashStarted = true;
   }

   // 8. Dino speed and kinematics
   const isStunned = dino.stunTimer > 0;
   let speed = 0;

   if (!isStunned) {
      // Check mud
      let inMud = false;
      for (const mud of MUD.patches) {
         if (Math.hypot(dino.x - mud.x, dino.z - mud.z) <= MUD.radius) {
            inMud = true;
            break;
         }
      }
      const mudMult = inMud ? MUD.speedMultiplier : 1.0;
      const stackMult = EGGS.stackMultipliers[dino.carriedEggs.length];
      const isDashing = dino.dashTimer > 0;
      const maxAllowedSpeed =
         (isDashing ? DINO.dashSpeed : DINO.baseSpeed) * stackMult * mudMult;

      let len = Math.hypot(input.moveX, input.moveY);
      let dirX = input.moveX;
      let dirZ = input.moveY;
      if (len > 1) {
         dirX /= len;
         dirZ /= len;
         len = 1;
      }

      const targetVx = dirX * maxAllowedSpeed;
      const targetVz = dirZ * maxAllowedSpeed;
      let dvx = targetVx - dino.vx;
      let dvz = targetVz - dino.vz;
      const dv = Math.hypot(dvx, dvz);
      const accelRate = len > 0.05 ? DINO.accel : DINO.brake;
      const maxDv = accelRate * dt;
      if (dv > maxDv) {
         dvx *= maxDv / dv;
         dvz *= maxDv / dv;
      }
      dino.vx += dvx;
      dino.vz += dvz;

      speed = Math.hypot(dino.vx, dino.vz);
      if (speed > 0.1) {
         const targetHeading = Math.atan2(dino.vx, dino.vz);
         dino.heading = turnTowards(
            dino.heading,
            targetHeading,
            Math.min(1, DINO.turnRate * dt)
         );
      }
   } else {
      dino.vx = 0;
      dino.vz = 0;
   }

   // 9. Integration: p + v * dt, tree push-out, valley bounds clamp
   dino.x += dino.vx * dt;
   dino.z += dino.vz * dt;

   // Push out of tree trunks
   for (const tree of TREES.positions) {
      const dx = dino.x - tree.x;
      const dz = dino.z - tree.z;
      const dist = Math.hypot(dx, dz);
      const minDist = TREES.trunkRadius + DINO.radius;
      if (dist < minDist) {
         const nx = dist > 1e-6 ? dx / dist : 1;
         const nz = dist > 1e-6 ? dz / dist : 0;
         dino.x = tree.x + nx * minDist;
         dino.z = tree.z + nz * minDist;
      }
   }

   // Clamp to valley bounds
   clampToBounds(
      { x: dino.x, y: 0, z: dino.z },
      VALLEY_BOUNDS,
      DINO.radius,
      dino as unknown as Vec3Like
   );

   // 10. Footstep audio accumulator & waddle phase
   if (speed > 0.3) {
      dino.waddlePhase += (speed / 0.8) * Math.PI * 2 * dt;
      run.footstepAccumulator += speed * dt;
      if (run.footstepAccumulator >= 0.9) {
         run.footstepAccumulator -= 0.9;
         events.footstep = true;
      }
   }

   // 11. Boulder collisions with dino
   const isInvulnerable = dino.dashTimer > 0 || dino.graceTimer > 0 || dino.stunTimer > 0;
   if (!isInvulnerable) {
      for (const boulder of run.boulders) {
         if (!boulder.active) continue;
         const touchDist = BOULDERS.radius + DINO.radius; // 0.5 + 0.55 = 1.05
         if (Math.hypot(dino.x - boulder.x, dino.z - boulder.z) <= touchDist) {
            // Boulder hit!
            events.boulderHit = true;
            dino.stunTimer = DINO.stunDuration;
            dino.vx = 0;
            dino.vz = 0;

            // Scatter carried eggs outward 1.5 m
            const droppedEggs = [...dino.carriedEggs];
            const droppedGolden = dino.carriedGolden;
            dino.carriedEggs = [];
            dino.carriedGolden = false;

            const totalToScatter = droppedEggs.length + (droppedGolden ? 1 : 0);
            events.eggsScattered = totalToScatter;

            if (totalToScatter > 0) {
               let eggIdx = 0;
               for (const regId of droppedEggs) {
                  const angle = dino.heading + (Math.PI * 2 * eggIdx) / totalToScatter;
                  const candX = dino.x + Math.cos(angle) * EGGS.scatterDistance;
                  const candZ = dino.z + Math.sin(angle) * EGGS.scatterDistance;
                  const valid = pushToValidGroundSpot({ x: candX, z: candZ }, 0.4);
                  run.groundEggs.push({
                     id: regId,
                     x: valid.x,
                     z: valid.z,
                     isGolden: false,
                     active: true,
                  });
                  eggIdx++;
               }
               if (droppedGolden) {
                  const angle = dino.heading + (Math.PI * 2 * eggIdx) / totalToScatter;
                  const candX = dino.x + Math.cos(angle) * EGGS.scatterDistance;
                  const candZ = dino.z + Math.sin(angle) * EGGS.scatterDistance;
                  const valid = pushToValidGroundSpot({ x: candX, z: candZ }, 0.4);
                  run.groundEggs.push({
                     id: run.nextEggId++,
                     x: valid.x,
                     z: valid.z,
                     isGolden: true,
                     active: true,
                     despawnTimer: EGGS.goldenDespawnS,
                  });
               }
            }
            break;
         }
      }
   }

   // 12. Egg pickups
   if (dino.stunTimer <= 0) {
      for (const egg of run.groundEggs) {
         if (!egg.active) continue;
         if (egg.isGolden) {
            if (!dino.carriedGolden) {
               if (Math.hypot(dino.x - egg.x, dino.z - egg.z) <= EGGS.goldenPickupRadius) {
                  egg.active = false;
                  dino.carriedGolden = true;
                  events.goldenPicked = true;
               }
            }
         } else {
            if (dino.carriedEggs.length < EGGS.maxStack) {
               if (Math.hypot(dino.x - egg.x, dino.z - egg.z) <= EGGS.pickupRadius) {
                  egg.active = false;
                  dino.carriedEggs.push(egg.id);
                  events.eggPicked = true;
               }
            }
         }
      }
   }

   // 13. Nest delivery
   const distToNest = Math.hypot(dino.x - NEST.x, dino.z - NEST.z);
   if (distToNest <= NEST.deliveryRadius) {
      const regCount = dino.carriedEggs.length;
      const goldCount = dino.carriedGolden ? 1 : 0;
      if (regCount > 0 || goldCount > 0) {
         const points =
            EGGS.points.regular[regCount] + (goldCount > 0 ? EGGS.points.golden : 0);
         run.score += points;
         run.deliveredRegularCount += regCount;
         run.deliveredGoldenCount += goldCount;
         dino.carriedEggs = [];
         dino.carriedGolden = false;

         events.eggDelivered = {
            regularCount: regCount,
            goldenCount: goldCount,
            points,
         };
      }
   }

   // Clean up inactive boulders and despawned golden eggs
   run.boulders = run.boulders.filter((b) => b.active);
   run.groundEggs = run.groundEggs.filter((e) => e.active);

   return events;
}

// ---------- scoring limits helpers ----------

export function withinLimits(score: number, elapsedMs: number): boolean {
   return fitsLimits(score, elapsedMs, dinoEggRescueMeta.scoring);
}

export function capScore(score: number, elapsedMs = 90_000): number {
   return capToLimits(score, elapsedMs, dinoEggRescueMeta.scoring);
}
