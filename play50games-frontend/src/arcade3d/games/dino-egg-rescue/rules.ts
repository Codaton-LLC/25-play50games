// Pure, deterministic rules for Dino Egg Rescue (Adventure Game 14).
// No Three.js, React or DOM imports. All gameplay numbers live here.

import type { AABB, Vec3Like } from "@/arcade3d/core/collision";
import { rngNext, turnTowards, type RngState } from "@/arcade3d/core/math";
import {
   capScore as capToLimits,
   withinServerLimits as fitsLimits,
} from "@/arcade3d/core/limits";
import type { LevelId, ScoringRules } from "@/arcade3d/types";
import { LEVELS, type DinoLevel } from "./levels";
import { MAP_1, VENT, WATER, type Obstacle, type ValleyMap, type WaterBox } from "./maps";
import dinoEggRescueMeta from "./meta";

// ---------- constants and layout ----------

export const DURATION_MS = 90_000;
export const RESULT_DELAY_MS = 1200;

export const VALLEY = {
   width: 30,
   depth: 22,
   halfX: 15,
   halfZ: 11,
} as const;

export const VALLEY_BOUNDS: AABB = {
   min: { x: -15, y: 0, z: -11 },
   max: { x: 15, y: 0, z: 11 },
};

export const NEST = {
   x: 11.0,
   z: 7.5,
   radius: 1.8,
   deliveryRadius: 1.4,
} as const;

export const DINO = {
   startX: 11.0,
   startZ: 7.5,
   startFacing: -Math.PI / 2, // -x towards valley
   radius: 0.55,
   baseSpeed: 5.0,
   dashSpeed: 8.0,
   accel: 20.0,
   brake: 25.0,
   turnRate: 12.0,
   dashDuration: 0.4,
   dashCooldown: 1.5,
   stunDuration: 0.8,
   graceDuration: 1.0,
} as const;

export const MUD = {
   radius: 1.6,
   speedMultiplier: 0.5,
   patches: [
      { id: 1, x: -11.5, z: -7.5 },
      { id: 2, x: 11.5, z: 1.0 },
      { id: 3, x: 6.5, z: 9.3 },
   ] as const,
} as const;

export const TREES = {
   trunkRadius: 0.256,
   positions: [
      { id: 1, x: -13.5, z: -10.0 },
      { id: 2, x: -7.5, z: -9.8 },
      { id: 3, x: -13.8, z: -4.6 },
      { id: 4, x: 14.0, z: -2.5 },
      { id: 5, x: 14.2, z: 4.5 },
      { id: 6, x: 8.0, z: 4.5 },
      { id: 7, x: 14.0, z: 10.0 },
      { id: 8, x: 3.5, z: 10.2 },
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
   contactBandHalfWidth: 1.05, // 0.5 (boulder) + 0.55 (dino)
   spawnIntervalStartS: 3.0,
   spawnIntervalEndS: 1.2,
   headwayS: 2.5,
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

/** The level's mud pits (its map's; level 1: today's MUD.patches, the same array). */
export function mudFor(level: DinoLevel): readonly { id: number; x: number; z: number }[] {
   return level.map === MAP_1 ? MUD.patches : level.map.mud;
}

/** The four gullies of this level's map with its speeds and unlock times (level 1: BOULDER_LANES). */
export function lanesFor(level: DinoLevel): BoulderLane[] {
   const lanes: BoulderLane[] = [];
   for (let i = 0; i < level.map.lanes.length; i++) {
      const lane = level.map.lanes[i];
      lanes.push({
         id: lane.id,
         startX: lane.startX,
         startZ: lane.startZ,
         endX: lane.endX,
         endZ: lane.endZ,
         speed: level.speeds[i],
         unlockS: level.unlocks[i],
      });
   }
   return lanes;
}

/**
 * Boulder gap at time t: 3.0 s at t = 0, 1.2 s once t reaches rampS.
 * Level 1's ramp is 90, so this is the formula that used to be inlined with a hardcoded 90.
 */
export function boulderIntervalAt(t: number, rampS: number): number {
   return (
      BOULDERS.spawnIntervalStartS -
      ((BOULDERS.spawnIntervalStartS - BOULDERS.spawnIntervalEndS) * Math.min(rampS, t)) / rampS
   );
}

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

/** Distance from (px, pz) to an obstacle's surface (negative inside). */
export function obstacleDistance(px: number, pz: number, o: Obstacle): number {
   return pointToSegmentDistanceXZ(px, pz, o.ax, o.az, o.bx, o.bz) - o.r;
}

/** True when (x, z) is in a water box (grown by `margin`). */
export function inWaterBox(x: number, z: number, w: WaterBox, margin = 0): boolean {
   return x >= w.x0 - margin && x <= w.x1 + margin && z >= w.z0 - margin && z <= w.z1 + margin;
}

/** The water box the dino wades in at (x, z), or null (dry ground, or a bridge). */
export function wadingIn(map: ValleyMap, x: number, z: number): WaterBox | null {
   for (const b of map.bridges) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return null;
   for (const w of map.water) if (inWaterBox(x, z, w)) return w;
   return null;
}

/** A vent's state at time t: 0 quiet, 1 glowing (warning), 2 erupting. */
export function ventState(v: { periodS: number; offsetS: number }, t: number): 0 | 1 | 2 {
   const c = (((t + v.offsetS) % v.periodS) + v.periodS) % v.periodS;
   if (c >= v.periodS - VENT.eruptS) return 2;
   if (c >= v.periodS - VENT.eruptS - VENT.warnS) return 1;
   return 0;
}

/** How far past its rim (centre distance beyond the vent's radius) an erupting vent still hits the dino. */
export const VENT_REACH = 0.3;

// ---------- data structures ----------

export interface DinoEntity {
   x: number;
   y: number;
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

export interface EggDeliveredEvent {
   regularCount: number;
   goldenCount: number;
   points: number;
}

export interface GameEvents {
   dashStarted: boolean;
   footstep: boolean;
   eggPicked: boolean;
   goldenPicked: boolean;
   eggDelivered: EggDeliveredEvent | null;
   boulderHit: boolean;
   /** a vent's eruption hit the dino (boulderHit is set too: the same stun and scatter) */
   ventHit: boolean;
   eggsScattered: number;
   goldenSpawned: boolean;
}

export interface DinoRunState {
   seed: number;
   /** The level this run was built from. Level 1 matches the module constants. */
   level: DinoLevel;
   /** the level's valley (level.map) */
   map: ValleyMap;
   lanes: readonly BoulderLane[];
   mud: readonly { x: number; z: number }[];
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
   events: GameEvents;
   eggDeliveredRecord: EggDeliveredEvent;
   laneTelegraph: [boolean, boolean, boolean, boolean];
   /** each vent's state this step (ventState): 0 quiet, 1 glowing, 2 erupting */
   ventStates: number[];
}

// ---------- valid ground placement ----------

export function isValidGroundSpot(
   x: number,
   z: number,
   margin = 0.3,
   map: ValleyMap = MAP_1
): boolean {
   // 1. In bounds
   if (
      x < VALLEY_BOUNDS.min.x + margin ||
      x > VALLEY_BOUNDS.max.x - margin ||
      z < VALLEY_BOUNDS.min.z + margin ||
      z > VALLEY_BOUNDS.max.z - margin
   ) {
      return false;
   }

   // 2. Clear of nest zone
   if (Math.hypot(x - map.nest.x, z - map.nest.z) < NEST.radius + margin) {
      return false;
   }

   // 3. Clear of mud pits
   for (const mud of map.mud) {
      if (Math.hypot(x - mud.x, z - mud.z) < MUD.radius + margin) {
         return false;
      }
   }

   // 4. Clear of trunks, rocks, logs and fences
   for (const o of map.obstacles) {
      if (obstacleDistance(x, z, o) < margin) {
         return false;
      }
   }

   // 5. Out of the water and off the vents
   for (const w of map.water) if (inWaterBox(x, z, w, margin)) return false;
   for (const v of map.vents) if (Math.hypot(x - v.x, z - v.z) < v.r + margin) return false;

   // 6. The dino can stand close enough to pick it up (not in a pocket between a trunk and the wall)
   return dinoReaches(x, z, map);
}

/**
 * True when a free dino position (clear of every solid, inside the clamp) lies within the pick-up
 * radius of (x, z): the spot pushed out of the solids and clamped settles close enough.
 */
export function dinoReaches(x: number, z: number, map: ValleyMap): boolean {
   const minX = VALLEY_BOUNDS.min.x + DINO.radius;
   const maxX = VALLEY_BOUNDS.max.x - DINO.radius;
   const minZ = VALLEY_BOUNDS.min.z + DINO.radius;
   const maxZ = VALLEY_BOUNDS.max.z - DINO.radius;
   let px = Math.max(minX, Math.min(maxX, x));
   let pz = Math.max(minZ, Math.min(maxZ, z));
   for (let pass = 0; pass < 4; pass++) {
      for (const o of map.obstacles) {
         const abx = o.bx - o.ax;
         const abz = o.bz - o.az;
         const len2 = abx * abx + abz * abz;
         const k = len2 > 1e-12 ? Math.max(0, Math.min(1, ((px - o.ax) * abx + (pz - o.az) * abz) / len2)) : 0;
         const cx = o.ax + k * abx;
         const cz = o.az + k * abz;
         const d = Math.hypot(px - cx, pz - cz);
         const min = o.r + DINO.radius + 0.01;
         if (d < min) {
            const nx = d > 1e-6 ? (px - cx) / d : 1;
            const nz = d > 1e-6 ? (pz - cz) / d : 0;
            px = cx + nx * min;
            pz = cz + nz * min;
         }
      }
      px = Math.max(minX, Math.min(maxX, px));
      pz = Math.max(minZ, Math.min(maxZ, pz));
   }
   for (const o of map.obstacles) if (obstacleDistance(px, pz, o) < DINO.radius) return false;
   return Math.hypot(px - x, pz - z) <= EGGS.pickupRadius - 0.1;
}

/** Pushes or clamps an invalid spot into the nearest valid free ground spot. */
export function pushToValidGroundSpot(
   p: { x: number; z: number },
   margin = 0.3,
   map: ValleyMap = MAP_1
): { x: number; z: number } {
   const clampX = (v: number) => Math.max(VALLEY_BOUNDS.min.x + margin, Math.min(VALLEY_BOUNDS.max.x - margin, v));
   const clampZ = (v: number) => Math.max(VALLEY_BOUNDS.min.z + margin, Math.min(VALLEY_BOUNDS.max.z - margin, v));
   let x = clampX(p.x);
   let z = clampZ(p.z);

   // a push out of one thing can land in the next: a few passes settle it (level 1: one)
   for (let pass = 0; pass < 4; pass++) {
      // Push out of nest zone
      const nestDist = Math.hypot(x - map.nest.x, z - map.nest.z);
      const minNestDist = NEST.radius + margin;
      if (nestDist < minNestDist) {
         const angle = nestDist > 1e-6 ? Math.atan2(z - map.nest.z, x - map.nest.x) : Math.PI;
         x = map.nest.x + Math.cos(angle) * minNestDist;
         z = map.nest.z + Math.sin(angle) * minNestDist;
      }

      // Push out of mud pits
      for (const mud of map.mud) {
         const dist = Math.hypot(x - mud.x, z - mud.z);
         const minDist = MUD.radius + margin;
         if (dist < minDist) {
            const angle = dist > 1e-6 ? Math.atan2(z - mud.z, x - mud.x) : 0;
            x = mud.x + Math.cos(angle) * minDist;
            z = mud.z + Math.sin(angle) * minDist;
         }
      }

      // Push out of trunks, rocks, logs and fences (from the nearest point of the segment)
      for (const o of map.obstacles) {
         const minDist = o.r + margin;
         const abx = o.bx - o.ax;
         const abz = o.bz - o.az;
         const len2 = abx * abx + abz * abz;
         const k = len2 > 1e-12 ? Math.max(0, Math.min(1, ((x - o.ax) * abx + (z - o.az) * abz) / len2)) : 0;
         const cx = o.ax + k * abx;
         const cz = o.az + k * abz;
         const dist = Math.hypot(x - cx, z - cz);
         if (dist < minDist) {
            const angle = dist > 1e-6 ? Math.atan2(z - cz, x - cx) : 0;
            x = cx + Math.cos(angle) * minDist;
            z = cz + Math.sin(angle) * minDist;
         }
      }

      // Out of the water: to the nearer bank
      for (const w of map.water) {
         if (!inWaterBox(x, z, w, margin)) continue;
         const north = z - (w.z0 - margin);
         const south = w.z1 + margin - z;
         const west = w.x0 - margin > VALLEY_BOUNDS.min.x + margin ? x - (w.x0 - margin) : Infinity;
         const east = w.x1 + margin < VALLEY_BOUNDS.max.x - margin ? w.x1 + margin - x : Infinity;
         const best = Math.min(north, south, west, east);
         if (best === north) z = w.z0 - margin - 1e-6;
         else if (best === south) z = w.z1 + margin + 1e-6;
         else if (best === west) x = w.x0 - margin - 1e-6;
         else x = w.x1 + margin + 1e-6;
      }

      // Off the vents
      for (const v of map.vents) {
         const dist = Math.hypot(x - v.x, z - v.z);
         const minDist = v.r + margin;
         if (dist < minDist) {
            const angle = dist > 1e-6 ? Math.atan2(z - v.z, x - v.x) : 0;
            x = v.x + Math.cos(angle) * minDist;
            z = v.z + Math.sin(angle) * minDist;
         }
      }

      x = clampX(x);
      z = clampZ(z);
      if (isValidGroundSpot(x, z, margin - 1e-6, map)) return { x, z };
   }

   // still boxed in (a pit against the wall pushes back into itself): the nearest free spot on rings
   for (let r = 0.25; r <= 12; r += 0.25) {
      const n = Math.max(8, Math.ceil((2 * Math.PI * r) / 0.25));
      for (let i = 0; i < n; i++) {
         const a = (2 * Math.PI * i) / n;
         const cx = x + Math.cos(a) * r;
         const cz = z + Math.sin(a) * r;
         if (isValidGroundSpot(cx, cz, margin, map)) return { x: cx, z: cz };
      }
   }
   return { x, z };
}

/** Samples a valid regular egg spot at time t around the nest. */
export function sampleEggSpot(
   rng: RngState,
   t: number,
   map: ValleyMap = MAP_1
): { x: number; z: number } {
   const baseR = 6.0 + (10.0 * t) / 90.0;
   for (let attempt = 0; attempt < 64; attempt++) {
      const r = baseR + (rngNext(rng) * 3.0 - 1.5);
      // The map's arc from the nest across the valley (level 1: the nest is SE at (11, 7.5) and the
      // valley lies towards -x (W) and -z (N): roughly 110 deg to 250 deg)
      const arc = map.eggArc;
      const angle = Math.PI * arc.a0 + rngNext(rng) * Math.PI * arc.span;
      const candX = map.nest.x + Math.cos(angle) * r;
      const candZ = map.nest.z + Math.sin(angle) * r;
      if (isValidGroundSpot(candX, candZ, 0.4, map)) {
         return { x: candX, z: candZ };
      }
   }
   // Fallback: guaranteed valid spot clamped (level 1: nest + baseR * (-1, -0.5))
   return pushToValidGroundSpot({ x: map.nest.x + baseR * map.eggArc.fx, z: map.nest.z + baseR * map.eggArc.fz }, 0.4, map);
}

/** Samples a valid golden egg spot within 8 m of the dino. */
export function sampleGoldenEggSpot(
   rng: RngState,
   dinoX: number,
   dinoZ: number,
   map: ValleyMap = MAP_1
): { x: number; z: number } {
   for (let attempt = 0; attempt < 64; attempt++) {
      const r = 3.0 + rngNext(rng) * 5.0; // 3 to 8 m
      const angle = rngNext(rng) * Math.PI * 2;
      const candX = dinoX + Math.cos(angle) * r;
      const candZ = dinoZ + Math.sin(angle) * r;
      if (isValidGroundSpot(candX, candZ, 0.4, map)) {
         return { x: candX, z: candZ };
      }
   }
   // Fallback: clamped spot around dino
   return pushToValidGroundSpot({ x: dinoX + 4.0, z: dinoZ - 3.0 }, 0.4, map);
}

// ---------- factory ----------

export function createDinoRun(seed: number, level: DinoLevel = LEVELS[1]): DinoRunState {
   const rng: RngState = { s: (seed >>> 0) || 1 };
   const mud = mudFor(level);
   const map = level.map;
   const dino: DinoEntity = {
      x: map.nest.x,
      y: 0,
      z: map.nest.z,
      vx: 0,
      vz: 0,
      heading: map.startFacing,
      dashTimer: 0,
      dashCooldown: 0,
      stunTimer: 0,
      graceTimer: 0,
      waddlePhase: 0,
      carriedEggs: [],
      carriedGolden: false,
   };

   // initial regular eggs at t = 0 (level 1: 4)
   const groundEggs: GroundEgg[] = [];
   for (let i = 0; i < level.initialSupply; i++) {
      const pt = sampleEggSpot(rng, 0, map);
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
      level,
      map,
      lanes: lanesFor(level),
      mud,
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
      nextEggId: level.initialSupply + 1,
      footstepAccumulator: 0,
      events: {
         dashStarted: false,
         footstep: false,
         eggPicked: false,
         goldenPicked: false,
         eggDelivered: null,
         boulderHit: false,
         ventHit: false,
         eggsScattered: 0,
         goldenSpawned: false,
      },
      eggDeliveredRecord: {
         regularCount: 0,
         goldenCount: 0,
         points: 0,
      },
      laneTelegraph: [false, false, false, false],
      ventStates: map.vents.map(() => 0),
   };
}

/** Same run factory, the name the level system uses. Defaults to today's game (level 1). */
export const createRun = createDinoRun;

/** A boulder or a vent hit the dino: stun, drop and scatter the stack (grace follows the stun). */
function hitDino(run: DinoRunState, events: GameEvents): void {
   const dino = run.dino;
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
         const valid = pushToValidGroundSpot({ x: candX, z: candZ }, 0.4, run.map);
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
         const valid = pushToValidGroundSpot({ x: candX, z: candZ }, 0.4, run.map);
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
}

// ---------- simulation step ----------

export function stepDinoRun(
   run: DinoRunState,
   input: StepInput,
   dt: number
): GameEvents {
   const events = run.events;
   events.dashStarted = false;
   events.footstep = false;
   events.eggPicked = false;
   events.goldenPicked = false;
   events.eggDelivered = null;
   events.boulderHit = false;
   events.ventHit = false;
   events.eggsScattered = 0;
   events.goldenSpawned = false;

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

   // 2. Golden egg scheduled spawns (level 1: 25 s, 50 s, 75 s)
   const goldenTimes = run.level.goldenSpawnTimes;
   if (run.goldenSpawnIndex < goldenTimes.length) {
      const scheduledT = goldenTimes[run.goldenSpawnIndex];
      if (t >= scheduledT) {
         const spot = sampleGoldenEggSpot(rng, dino.x, dino.z, run.map);
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

   // 3. Regular egg spawn ticks at t = 3k (level 1: k = 1..29)
   while (run.nextEggSpawnTick <= run.level.totalSpawnTicks) {
      const tickTime = run.nextEggSpawnTick * 3.0;
      if (t >= tickTime) {
         // Check active regular eggs on ground without allocation
         let groundRegularCount = 0;
         for (let i = 0; i < run.groundEggs.length; i++) {
            const e = run.groundEggs[i];
            if (e.active && !e.isGolden) groundRegularCount++;
         }
         if (groundRegularCount < run.level.maxGroundEggs) {
            const spot = sampleEggSpot(rng, tickTime, run.map);
            run.groundEggs.push({
               id: run.nextEggId++,
               x: spot.x,
               z: spot.z,
               isGolden: false,
               active: true,
            });
         }
         // with the ground full (level 1: 4 eggs) the tick is skipped and lost for good
         run.nextEggSpawnTick++;
      } else {
         break;
      }
   }

   // 4. Boulder spawning schedule & 0.8 s telegraph
   const spawnInterval = boulderIntervalAt(t, run.level.spawnRampS);
   const lanes = run.lanes;

   // Update 0.8 s lane entrance telegraph
   const isTelegraphing = t >= run.nextBoulderSpawnTime - 0.8 && t < run.nextBoulderSpawnTime;
   for (let i = 0; i < 4; i++) {
      run.laneTelegraph[i] = false;
   }
   if (isTelegraphing) {
      for (const lane of lanes) {
         if (t >= lane.unlockS) {
            const lastSpawn = run.laneLastSpawnTime[lane.id - 1];
            if (t - lastSpawn >= BOULDERS.headwayS) {
               run.laneTelegraph[lane.id - 1] = true;
            }
         }
      }
   }

   if (t >= run.nextBoulderSpawnTime) {
      run.nextBoulderSpawnTime += spawnInterval;

      // Filter eligible lanes without allocation
      let eligibleCount = 0;
      let lane1Eligible = false;
      let lane2Eligible = false;
      let lane3Eligible = false;
      let lane4Eligible = false;

      for (const lane of lanes) {
         if (t >= lane.unlockS) {
            const lastSpawn = run.laneLastSpawnTime[lane.id - 1];
            if (t - lastSpawn >= BOULDERS.headwayS) {
               eligibleCount++;
               if (lane.id === 1) lane1Eligible = true;
               else if (lane.id === 2) lane2Eligible = true;
               else if (lane.id === 3) lane3Eligible = true;
               else if (lane.id === 4) lane4Eligible = true;
            }
         }
      }

      if (eligibleCount > 0) {
         let pick = Math.floor(rngNext(rng) * eligibleCount);
         let chosenLane: BoulderLane | null = null;
         if (lane1Eligible) {
            if (pick === 0) chosenLane = lanes[0];
            pick--;
         }
         if (!chosenLane && lane2Eligible) {
            if (pick === 0) chosenLane = lanes[1];
            pick--;
         }
         if (!chosenLane && lane3Eligible) {
            if (pick === 0) chosenLane = lanes[2];
            pick--;
         }
         if (!chosenLane && lane4Eligible) {
            if (pick === 0) chosenLane = lanes[3];
            pick--;
         }

         if (chosenLane) {
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
   }

   // 5. Boulder movement and despawn
   for (const boulder of run.boulders) {
      if (!boulder.active) continue;
      boulder.x += boulder.dirX * boulder.speed * dt;
      boulder.z += boulder.dirZ * boulder.speed * dt;
      boulder.rollAngle += (boulder.speed * dt) / BOULDERS.radius;

      const lane = lanes[boulder.laneId - 1];
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
         dino.graceTimer = DINO.graceDuration; // 1.0 s grace after stun
      }
   } else if (dino.graceTimer > 0) {
      dino.graceTimer -= dt;
      if (dino.graceTimer <= 1e-6) {
         dino.graceTimer = 0;
      }
   }

   if (dino.dashCooldown > 0) {
      dino.dashCooldown -= dt;
      if (dino.dashCooldown <= 1e-6) dino.dashCooldown = 0;
   }
   if (dino.dashTimer > 0) {
      dino.dashTimer -= dt;
      if (dino.dashTimer <= 1e-6) dino.dashTimer = 0;
   }

   // 7. Dash trigger
   const dashRequested = input.actionPressed || input.jumpPressed;
   if (dashRequested && dino.stunTimer <= 0 && dino.dashCooldown <= 0) {
      dino.dashTimer = DINO.dashDuration;
      dino.dashCooldown = DINO.dashCooldown;
      events.dashStarted = true;
   }

   // 8. Dino velocity integration and speed multipliers
   let speed = 0;
   if (dino.stunTimer <= 0) {
      let inMud = false;
      for (const mud of run.mud) {
         if (Math.hypot(dino.x - mud.x, dino.z - mud.z) <= MUD.radius) {
            inMud = true;
            break;
         }
      }
      const wading = run.map.water.length > 0 ? wadingIn(run.map, dino.x, dino.z) : null;
      const mudMult = inMud ? MUD.speedMultiplier : wading ? WATER.speedMultiplier : 1.0;
      const stackMult = run.level.stackMultipliers[dino.carriedEggs.length];
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

   // 9. Integration: p + v * dt (+ the river's current while wading), solid push-out, valley bounds clamp
   dino.x += dino.vx * dt;
   dino.z += dino.vz * dt;
   if (run.map.water.length > 0) {
      const current = wadingIn(run.map, dino.x, dino.z);
      if (current) {
         dino.x += current.flowX * dt;
         dino.z += current.flowZ * dt;
      }
   }

   // Solid push-out (level 1: the 0.256 m trunks); a dash hops a low log
   const hopping = dino.dashTimer > 0;
   const solids = run.map.obstacles;
   for (let i = 0; i < solids.length; i++) {
      const o = solids[i];
      if (o.low && hopping) continue;
      const abx = o.bx - o.ax;
      const abz = o.bz - o.az;
      const len2 = abx * abx + abz * abz;
      const k = len2 > 1e-12 ? Math.max(0, Math.min(1, ((dino.x - o.ax) * abx + (dino.z - o.az) * abz) / len2)) : 0;
      const cx = o.ax + k * abx;
      const cz = o.az + k * abz;
      const dx = dino.x - cx;
      const dz = dino.z - cz;
      const dist = Math.hypot(dx, dz);
      const minDist = o.r + DINO.radius;
      if (dist < minDist) {
         const nx = dist > 1e-6 ? dx / dist : 1;
         const nz = dist > 1e-6 ? dz / dist : 0;
         dino.x = cx + nx * minDist;
         dino.z = cz + nz * minDist;
      }
   }

   // Clamp to valley bounds without allocation
   const minX = VALLEY_BOUNDS.min.x + DINO.radius;
   const maxX = VALLEY_BOUNDS.max.x - DINO.radius;
   const minZ = VALLEY_BOUNDS.min.z + DINO.radius;
   const maxZ = VALLEY_BOUNDS.max.z - DINO.radius;
   if (dino.x < minX) dino.x = minX;
   else if (dino.x > maxX) dino.x = maxX;
   if (dino.z < minZ) dino.z = minZ;
   else if (dino.z > maxZ) dino.z = maxZ;

   // 10. Footstep audio accumulator & waddle phase
   if (speed > 0.3) {
      dino.waddlePhase += (speed / 0.8) * Math.PI * 2 * dt;
      run.footstepAccumulator += speed * dt;
      if (run.footstepAccumulator >= 0.9) {
         run.footstepAccumulator -= 0.9;
         events.footstep = true;
      }
   }

   // 11. Boulder collisions and vent eruptions (the same hit: stun, scatter, then grace)
   const isInvulnerable = dino.dashTimer > 0 || dino.graceTimer > 0;
   for (let i = 0; i < run.map.vents.length; i++) run.ventStates[i] = ventState(run.map.vents[i], t);
   if (!isInvulnerable && dino.stunTimer <= 0) {
      let hit = false;
      for (const boulder of run.boulders) {
         if (!boulder.active) continue;
         const touchDist = BOULDERS.radius + DINO.radius; // 0.5 + 0.55 = 1.05
         if (Math.hypot(dino.x - boulder.x, dino.z - boulder.z) <= touchDist) {
            hit = true;
            break;
         }
      }
      if (!hit) {
         for (let i = 0; i < run.map.vents.length; i++) {
            const v = run.map.vents[i];
            if (run.ventStates[i] === 2 && Math.hypot(dino.x - v.x, dino.z - v.z) <= v.r + VENT_REACH) {
               hit = true;
               events.ventHit = true;
               break;
            }
         }
      }
      if (hit) hitDino(run, events);
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
            if (dino.carriedEggs.length < run.level.maxStack) {
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
   const distToNest = Math.hypot(dino.x - run.map.nest.x, dino.z - run.map.nest.z);
   if (distToNest <= NEST.deliveryRadius) {
      const regCount = dino.carriedEggs.length;
      const goldCount = dino.carriedGolden ? 1 : 0;
      if (regCount > 0 || goldCount > 0) {
         const points =
            run.level.deliveryPoints[regCount] + goldCount * EGGS.points.golden;
         run.score += points;
         run.deliveredRegularCount += regCount;
         run.deliveredGoldenCount += goldCount;
         dino.carriedEggs = [];
         dino.carriedGolden = false;

         run.eggDeliveredRecord.regularCount = regCount;
         run.eggDeliveredRecord.goldenCount = goldCount;
         run.eggDeliveredRecord.points = points;
         events.eggDelivered = run.eggDeliveredRecord;
      }
   }

   // Clean up inactive boulders and despawned golden eggs in-place (no array allocation)
   let bWrite = 0;
   for (let i = 0; i < run.boulders.length; i++) {
      if (run.boulders[i].active) {
         run.boulders[bWrite++] = run.boulders[i];
      }
   }
   run.boulders.length = bWrite;

   let eWrite = 0;
   for (let i = 0; i < run.groundEggs.length; i++) {
      if (run.groundEggs[i].active) {
         run.groundEggs[eWrite++] = run.groundEggs[i];
      }
   }
   run.groundEggs.length = eWrite;

   return events;
}

// ---------- scoring limits helpers ----------

/** Regular eggs a perfect run can be offered: the start pile plus every spawn tick. */
export function regularSupply(level: DinoLevel): number {
   return level.initialSupply + level.totalSpawnTicks;
}

/** Best points per regular egg. Level 1's 3-stack is 150; level 5's 4-stack is 600 / 4 = 150. */
export function maxPointsPerEgg(level: DinoLevel): number {
   let best = 0;
   for (let n = 1; n < level.deliveryPoints.length; n++) {
      const per = level.deliveryPoints[n] / n;
      if (per > best) best = per;
   }
   return best;
}

/**
 * Supply ceiling: every regular egg delivered at the best per-egg tier, plus every golden.
 * A run cannot score more than this. 33 and 41 both partition into stacks of 3 (and 4 on
 * level 5), so the per-egg maximum is reachable in whole deliveries.
 */
export function scoreCeiling(level: DinoLevel): number {
   return regularSupply(level) * maxPointsPerEgg(level) + level.goldenSpawnTimes.length * EGGS.points.golden;
}

/**
 * Limits proposed per level (README "Levels"). Level 1 is meta.scoring, already proven for
 * today's 90 s clock. Levels 2-5 are 120 s, so both duration bounds move with the clock
 * (±2 s, the same margin as level 1's 88–92 s around 90 s). Claude copies these into
 * arcade-games.json and meta.levels.
 * L2–L4: 33 × 150 + 3 × 300 = 5850. 5850 × 1.043 → 6100. 5850 / 118 s = 49.58 ≤ 52.
 * L5: 41 × 150 + 3 × 300 = 7050. 7050 × 1.035 → 7300. 7050 / 118 s = 59.75 ≤ 62.
 */
export const PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules> = {
   1: dinoEggRescueMeta.scoring,
   2: { ...dinoEggRescueMeta.scoring, maxScore: 6100, minDurationMs: 118_000, maxDurationMs: 122_000, maxPointsPerSec: 52 },
   3: { ...dinoEggRescueMeta.scoring, maxScore: 6100, minDurationMs: 118_000, maxDurationMs: 122_000, maxPointsPerSec: 52 },
   4: { ...dinoEggRescueMeta.scoring, maxScore: 6100, minDurationMs: 118_000, maxDurationMs: 122_000, maxPointsPerSec: 52 },
   5: { ...dinoEggRescueMeta.scoring, maxScore: 7300, minDurationMs: 118_000, maxDurationMs: 122_000, maxPointsPerSec: 62 },
};

export function withinLimits(score: number, elapsedMs: number): boolean {
   return fitsLimits(score, elapsedMs, dinoEggRescueMeta.scoring);
}

export function capScore(score: number, elapsedMs = 90_000): number {
   return capToLimits(score, elapsedMs, dinoEggRescueMeta.scoring);
}
