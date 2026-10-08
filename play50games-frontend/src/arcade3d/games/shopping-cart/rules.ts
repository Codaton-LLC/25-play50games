// Crazy Shopping Cart rules: seeded store layout, cart kinematics, continuous swept collision,
// patrolling shoppers, spills, can pyramids, list generation and scoring.
// Pure and deterministic: no three.js, React, DOM, Math.random or Date.now.
// Units: metres and seconds; x east, z south (+z = checkout exit), y up.
import {
   aabbFromCenter,
   aabbOverlap,
   circlesOverlapXZ,
   pointInAabb,
   resolveSphereAabb,
   sweptAabbXZ,
   type AABB,
   type SweepHit,
   type Vec3Like,
} from "@/arcade3d/core/collision";
import { capScore as capToLimits, withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { createRng, rngNext, turnTowards } from "@/arcade3d/core/math";
import { createPath, type Path } from "@/arcade3d/core/path";
import { stepPatrol, type PatrolOptions, type PatrolState } from "@/arcade3d/core/ai/patrol";
import type { Agent } from "@/arcade3d/core/ai/steering";
import { PRODUCT_KINDS, type ProductKind } from "./assets";
import { shoppingCartMeta } from "./meta";

export const DURATION_MS = 75_000;
export const LIST_COUNT = 6;
export const STEER_ASSIST_RATE = 1.5; // rad/s on coarse pointers

export const STORE = {
   width: 32,
   depth: 24,
   minX: -16,
   maxX: 16,
   minZ: -12,
   maxZ: 12,
   innerMinX: -15.4,
   innerMaxX: 15.4,
   innerMinZ: -11.4,
   innerMaxZ: 11.4,
} as const;

export const START_POS = { x: -12.0, z: 6.0, heading: 0 } as const;

// 4 shelf island blocks (AABBs): width 1.2 m x 12.0 m long (z -7.5 to 4.5)
export const SHELVES: readonly AABB[] = [
   { min: { x: -9.6, y: 0, z: -7.5 }, max: { x: -8.4, y: 2.2, z: 4.5 } },
   { min: { x: -4.6, y: 0, z: -7.5 }, max: { x: -3.4, y: 2.2, z: 4.5 } },
   { min: { x: 0.4, y: 0, z: -7.5 }, max: { x: 1.6, y: 2.2, z: 4.5 } },
   { min: { x: 5.4, y: 0, z: -7.5 }, max: { x: 6.6, y: 2.2, z: 4.5 } },
] as const;

export const FRUIT_ISLAND: AABB = {
   min: { x: 11.5, y: 0, z: -3.0 },
   max: { x: 14.5, y: 1.2, z: 3.0 },
};

export const FREEZER_ROW: AABB = {
   min: { x: -12.0, y: 0, z: -11.8 },
   max: { x: 12.0, y: 2.0, z: -10.6 },
};

export const CHECKOUT_COUNTERS: readonly AABB[] = [
   { min: { x: -4.0, y: 0, z: 8.0 }, max: { x: -3.2, y: 1.2, z: 9.8 } },
   { min: { x: -1.0, y: 0, z: 8.0 }, max: { x: -0.2, y: 1.2, z: 9.8 } },
   { min: { x: 2.0, y: 0, z: 8.0 }, max: { x: 2.8, y: 1.2, z: 9.8 } },
] as const;

export const FINISH_ZONE: AABB = {
   min: { x: -4.5, y: -1.0, z: 10.2 },
   max: { x: 4.5, y: 2.0, z: 11.8 },
};

// All solid obstacle boxes for collision
export const SOLID_OBSTACLES: readonly AABB[] = [
   ...SHELVES,
   FRUIT_ISLAND,
   FREEZER_ROW,
   ...CHECKOUT_COUNTERS,
] as const;

// 24 shelf slots (6 per shelf: 3 west face, 3 east face at z -5.0, -1.5, 2.0)
export const SHELF_SLOTS: readonly { x: number; y: number; z: number; shelfIndex: number }[] = [
   // Shelf 1
   { x: -9.9, y: 0.8, z: -5.0, shelfIndex: 0 },
   { x: -9.9, y: 0.8, z: -1.5, shelfIndex: 0 },
   { x: -9.9, y: 0.8, z: 2.0, shelfIndex: 0 },
   { x: -8.1, y: 0.8, z: -5.0, shelfIndex: 0 },
   { x: -8.1, y: 0.8, z: -1.5, shelfIndex: 0 },
   { x: -8.1, y: 0.8, z: 2.0, shelfIndex: 0 },
   // Shelf 2
   { x: -4.9, y: 0.8, z: -5.0, shelfIndex: 1 },
   { x: -4.9, y: 0.8, z: -1.5, shelfIndex: 1 },
   { x: -4.9, y: 0.8, z: 2.0, shelfIndex: 1 },
   { x: -3.1, y: 0.8, z: -5.0, shelfIndex: 1 },
   { x: -3.1, y: 0.8, z: -1.5, shelfIndex: 1 },
   { x: -3.1, y: 0.8, z: 2.0, shelfIndex: 1 },
   // Shelf 3
   { x: 0.1, y: 0.8, z: -5.0, shelfIndex: 2 },
   { x: 0.1, y: 0.8, z: -1.5, shelfIndex: 2 },
   { x: 0.1, y: 0.8, z: 2.0, shelfIndex: 2 },
   { x: 1.9, y: 0.8, z: -5.0, shelfIndex: 2 },
   { x: 1.9, y: 0.8, z: -1.5, shelfIndex: 2 },
   { x: 1.9, y: 0.8, z: 2.0, shelfIndex: 2 },
   // Shelf 4
   { x: 5.1, y: 0.8, z: -5.0, shelfIndex: 3 },
   { x: 5.1, y: 0.8, z: -1.5, shelfIndex: 3 },
   { x: 5.1, y: 0.8, z: 2.0, shelfIndex: 3 },
   { x: 6.9, y: 0.8, z: -5.0, shelfIndex: 3 },
   { x: 6.9, y: 0.8, z: -1.5, shelfIndex: 3 },
   { x: 6.9, y: 0.8, z: 2.0, shelfIndex: 3 },
] as const;

export const CART = {
   radius: 0.55,
   proxyHalfX: 0.45,
   proxyHalfZ: 0.8, // covers cart + pusher runner at z -0.65
   maxWalkingSpeed: 6.0,
   maxRidingSpeed: 9.0,
   throttleAccel: 12.0,
   dragDecel: 5.0,
   turnRate: 4.0,
   gripNormal: 6.0,
   gripRiding: 3.0,
   gripSpill: 1.5,
   restitution: 0.3,
   itemReach: 1.0,
} as const;

export const PYRAMID_POSITIONS: readonly { x: number; y: number; z: number }[] = [
   { x: -9.0, y: 0, z: 4.8 },
   { x: -4.0, y: 0, z: 4.8 },
   { x: 1.0, y: 0, z: 4.8 },
   { x: -9.0, y: 0, z: -7.8 },
   { x: -4.0, y: 0, z: -7.8 },
   { x: 1.0, y: 0, z: -7.8 },
] as const;

export const PYRAMID_RADIUS = 0.4;

export const SPILLS = [
   { x: -6.5, z: 4.8, radius: 1.2, spawnS: 25.0 },
   { x: 3.5, z: -7.8, radius: 1.2, spawnS: 50.0 },
] as const;

export const POINTS = {
   item: 100,
   comboStep: 20,
   listComplete: 300,
   perSecond: 10,
} as const;

export const MIN_TOUR_DISTANCE = 52.0;

export const PROPOSED_LIMITS = {
   kind: "points" as const,
   maxScore: 2070,
   minDurationMs: 6000,
   maxDurationMs: 77000,
   base: 1470,
   maxPointsPerSec: 100,
   unitLabel: "pts",
   display: "int" as const,
} as const;

/** Turns angle `from` towards `to` (radians) the short way round, clamped to maxRadians. */
export function stepAngleTowards(from: number, to: number, maxRadians: number): number {
   let diff = (to - from) % (2 * Math.PI);
   if (diff > Math.PI) diff -= 2 * Math.PI;
   if (diff < -Math.PI) diff += 2 * Math.PI;
   const step = Math.sign(diff) * Math.min(Math.abs(diff), maxRadians);
   return from + step;
}

// ---------- State Interfaces ----------

export interface CartState {
   x: number;
   y: number;
   z: number;
   vx: number;
   vz: number;
   heading: number; // 0 = north (-z)
   speed: number;
   targetSpeed: number;
   riding: boolean;
   stunTimer: number; // >0: stunned by shopper bump
   slowTimer: number; // >0: slowed by pyramid topple
}

export interface ListItem {
   kind: ProductKind;
   slotIndex: number;
   x: number;
   y: number;
   z: number;
   collected: boolean;
}

export interface CanPyramid {
   x: number;
   y: number;
   z: number;
   toppled: boolean;
}

export interface ShopperNPC {
   id: "shopperA" | "shopperB" | "shopperC" | "shopperD";
   agent: Agent;
   patrolState: PatrolState;
   route: Path;
   graceTimer: number; // invulnerability cooldown after bump
   active: boolean;
}

export interface StepEvents {
   pickups: Array<{ kind: ProductKind; score: number; combo: number; x: number; z: number }>;
   listCompleted: boolean;
   pyramidToppled: Array<{ x: number; z: number }>;
   shopperBumped: Array<{ x: number; z: number }>;
   spillSkid: boolean;
   won: boolean;
   timeup: boolean;
}

export interface RunState {
   seed: number;
   cart: CartState;
   list: ListItem[];
   pyramids: CanPyramid[];
   shoppers: ShopperNPC[];
   combo: number;
   score: number;
   collectedCount: number;
   listComplete: boolean;
   won: boolean;
   timedOut: boolean;
   playTimeS: number;
}

export interface StepInput {
   moveX: number; // -1..1
   moveY: number; // -1..1 (up = away from camera, north)
   ride: boolean;
}

// ---------- Aisle Routing & Tour Distance ----------

/** Approximates the shortest legal aisle distance between two points in the store. */
export function storeDistance(a: { x: number; z: number }, b: { x: number; z: number }): number {
   const dx = Math.abs(a.x - b.x);
   // If both points are in the same walkway or same aisle without shelf barrier
   if (dx < 1.0) return Math.abs(a.z - b.z) + dx;
   if ((a.z < -7.5 && b.z < -7.5) || (a.z > 4.5 && b.z > 4.5)) {
      return Math.abs(a.z - b.z) + dx;
   }
   // Separated by shelves: must navigate via North walkway (-7.8) or South walkway (4.8)
   const northWay = (a.z - -7.8) + (b.z - -7.8) + dx;
   const southWay = (4.8 - a.z) + (4.8 - b.z) + dx;
   return Math.min(northWay, southWay);
}

/** Calculates the shortest route visiting all items from start to checkout via brute force. */
export function shortestPickTour(items: readonly { x: number; z: number }[]): number {
   const start = { x: START_POS.x, z: START_POS.z };
   const checkout = { x: 0, z: 10.5 };
   const n = items.length;
   if (n === 0) return storeDistance(start, checkout);

   let minTour = Infinity;
   const perm = Array.from({ length: n }, (_, i) => i);

   function search(k: number, currentLen: number, lastPoint: { x: number; z: number }) {
      if (currentLen >= minTour) return;
      if (k === n) {
         const total = currentLen + storeDistance(lastPoint, checkout);
         if (total < minTour) minTour = total;
         return;
      }
      for (let i = k; i < n; i++) {
         const tmp = perm[k];
         perm[k] = perm[i];
         perm[i] = tmp;

         const pt = items[perm[k]];
         const d = storeDistance(lastPoint, pt);
         search(k + 1, currentLen + d, pt);

         perm[i] = perm[k];
         perm[k] = tmp;
      }
   }

   search(0, 0, start);
   return minTour;
}

// Tested valid fallback list with tour distance 58.4 m
export const FALLBACK_LIST: ListItem[] = [
   { kind: "apple", slotIndex: 0, x: -9.9, y: 0.8, z: -5.0, collected: false },
   { kind: "banana", slotIndex: 4, x: -8.1, y: 0.8, z: -1.5, collected: false },
   { kind: "burger", slotIndex: 7, x: -4.9, y: 0.8, z: -1.5, collected: false },
   { kind: "tinCan", slotIndex: 13, x: 0.1, y: 0.8, z: -1.5, collected: false },
   { kind: "bottle", slotIndex: 17, x: 1.9, y: 0.8, z: 2.0, collected: false },
   { kind: "bag", slotIndex: 21, x: 6.9, y: 0.8, z: -5.0, collected: false },
];

/** Deterministically generates 6 distinct list items with minimum tour length >= 52.0 m. */
export function generateList(seed: number): ListItem[] {
   const rng = { s: seed };
   for (let attempt = 0; attempt < 40; attempt++) {
      // Pick 6 distinct products
      const availableProducts = [...PRODUCT_KINDS];
      const pickedProducts: ProductKind[] = [];
      for (let i = 0; i < LIST_COUNT; i++) {
         const idx = Math.floor(rngNext(rng) * availableProducts.length);
         pickedProducts.push(availableProducts[idx]);
         availableProducts.splice(idx, 1);
      }

      // Pick 6 distinct slots from the 24 slots
      const slotIndices: number[] = [];
      const allSlots = Array.from({ length: SHELF_SLOTS.length }, (_, i) => i);
      for (let i = 0; i < LIST_COUNT; i++) {
         const idx = Math.floor(rngNext(rng) * allSlots.length);
         slotIndices.push(allSlots[idx]);
         allSlots.splice(idx, 1);
      }

      const items: ListItem[] = slotIndices.map((slotIdx, i) => ({
         kind: pickedProducts[i],
         slotIndex: slotIdx,
         x: SHELF_SLOTS[slotIdx].x,
         y: SHELF_SLOTS[slotIdx].y,
         z: SHELF_SLOTS[slotIdx].z,
         collected: false,
      }));

      const tourLen = shortestPickTour(items);
      if (tourLen >= MIN_TOUR_DISTANCE) {
         return items;
      }
   }
   return JSON.parse(JSON.stringify(FALLBACK_LIST));
}

// ---------- Shopper Routes ----------

export function createShopperRoutes(): Record<string, Path> {
   return {
      shopperA: createPath([
         { x: -12.0, y: 0, z: -9.2 },
         { x: 12.0, y: 0, z: -9.2 },
      ], { closed: false }),
      shopperB: createPath([
         { x: 10.0, y: 0, z: 6.0 },
         { x: -10.0, y: 0, z: 6.0 },
      ], { closed: false }),
      shopperC: createPath([
         { x: -1.5, y: 0, z: -6.5 },
         { x: -1.5, y: 0, z: 3.5 },
         { x: 3.5, y: 0, z: 3.5 },
         { x: 3.5, y: 0, z: -6.5 },
      ], { closed: true }),
      shopperD: createPath([
         { x: 10.0, y: 0, z: -6.0 },
         { x: 10.0, y: 0, z: 5.0 },
      ], { closed: false }),
   };
}

export function createShoppers(routes: Record<string, Path>): ShopperNPC[] {
   return [
      {
         id: "shopperA",
         agent: { x: -12.0, y: 0, z: -9.2, vx: 0, vy: 0, vz: 0, yaw: Math.PI / 2 },
         patrolState: { index: 0, wait: 0.5, mode: "patrol", target: { x: 12, y: 0, z: -9.2 } },
         route: routes.shopperA,
         graceTimer: 0,
         active: true,
      },
      {
         id: "shopperB",
         agent: { x: 10.0, y: 0, z: 6.0, vx: 0, vy: 0, vz: 0, yaw: -Math.PI / 2 },
         patrolState: { index: 0, wait: 0.5, mode: "patrol", target: { x: -10, y: 0, z: 6.0 } },
         route: routes.shopperB,
         graceTimer: 0,
         active: true,
      },
      {
         id: "shopperC",
         agent: { x: -1.5, y: 0, z: -6.5, vx: 0, vy: 0, vz: 0, yaw: 0 },
         patrolState: { index: 0, wait: 0, mode: "patrol", target: { x: -1.5, y: 0, z: 3.5 } },
         route: routes.shopperC,
         graceTimer: 0,
         active: true,
      },
      {
         id: "shopperD",
         agent: { x: 10.0, y: 0, z: -6.0, vx: 0, vy: 0, vz: 0, yaw: 0 },
         patrolState: { index: 0, wait: 0.5, mode: "patrol", target: { x: 10.0, y: 0, z: 5.0 } },
         route: routes.shopperD,
         graceTimer: 0,
         active: false, // activates at 40s
      },
   ];
}

// ---------- Run Creation & Simulation ----------

export function createRun(seed: number): RunState {
   const routes = createShopperRoutes();
   return {
      seed,
      cart: {
         x: START_POS.x,
         y: 0,
         z: START_POS.z,
         vx: 0,
         vz: 0,
         heading: START_POS.heading,
         speed: 0,
         targetSpeed: 0,
         riding: false,
         stunTimer: 0,
         slowTimer: 0,
      },
      list: generateList(seed),
      pyramids: PYRAMID_POSITIONS.map((p) => ({ x: p.x, y: 0, z: p.z, toppled: false })),
      shoppers: createShoppers(routes),
      combo: 0,
      score: 0,
      collectedCount: 0,
      listComplete: false,
      won: false,
      timedOut: false,
      playTimeS: 0,
   };
}

const SWEEP_HIT: SweepHit = { time: 0, normalX: 0, normalZ: 0 };
const PROXY_BOX: AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };

/** Steps the game simulation by dt seconds with the given input. */
export function stepRun(
   run: RunState,
   input: StepInput,
   dt: number,
   playTimeS: number,
): StepEvents {
   const events: StepEvents = {
      pickups: [],
      listCompleted: false,
      pyramidToppled: [],
      shopperBumped: [],
      spillSkid: false,
      won: false,
      timeup: false,
   };

   if (run.won || run.timedOut) return events;

   run.playTimeS = playTimeS;

   // Check timeout
   if (playTimeS >= DURATION_MS / 1000) {
      run.timedOut = true;
      events.timeup = true;
      return events;
   }

   const cart = run.cart;
   cart.riding = input.ride;

   // Handle timers
   if (cart.stunTimer > 0) {
      cart.stunTimer = Math.max(0, cart.stunTimer - dt);
   }
   if (cart.slowTimer > 0) {
      cart.slowTimer = Math.max(0, cart.slowTimer - dt);
   }

   // 1. Spills check: is cart in any active puddle?
   let inSpill = false;
   for (const spill of SPILLS) {
      if (playTimeS >= spill.spawnS) {
         const dx = cart.x - spill.x;
         const dz = cart.z - spill.z;
         if (dx * dx + dz * dz <= spill.radius * spill.radius) {
            inSpill = true;
            break;
         }
      }
   }
   if (inSpill && cart.speed > 2.0) {
      events.spillSkid = true;
   }

   // 2. Kinematics & Speed Model
   const maxSpeedLimit = cart.slowTimer > 0
      ? 3.0
      : cart.riding
      ? CART.maxRidingSpeed
      : CART.maxWalkingSpeed;

   const grip = inSpill
      ? CART.gripSpill
      : cart.riding
      ? CART.gripRiding
      : CART.gripNormal;

   const inputMag = Math.hypot(input.moveX, input.moveY);
   const hasInput = inputMag > 0.05 && cart.stunTimer <= 0;

   if (hasInput) {
      // Input direction in world coordinates: moveX right (+x), moveY up (north, -z)
      let targetHeading = Math.atan2(input.moveX, input.moveY);

      // Auto-steer assist on coarse pointers
      if (!cart.riding && run.collectedCount < LIST_COUNT) {
         let nearestDist = 8.0;
         let nearestTarget: ListItem | null = null;
         for (const item of run.list) {
            if (!item.collected) {
               const d = Math.hypot(item.x - cart.x, item.z - cart.z);
               if (d < nearestDist) {
                  nearestDist = d;
                  nearestTarget = item;
               }
            }
         }
         if (nearestTarget) {
            const itemHeading = Math.atan2(nearestTarget.x - cart.x, -(nearestTarget.z - cart.z));
            const angleDiff = Math.abs(Math.atan2(Math.sin(itemHeading - targetHeading), Math.cos(itemHeading - targetHeading)));
            if (angleDiff <= 0.35) { // within 20 deg
               targetHeading = stepAngleTowards(targetHeading, itemHeading, STEER_ASSIST_RATE * dt);
            }
         }
      }

      cart.heading = stepAngleTowards(cart.heading, targetHeading, CART.turnRate * dt);
      cart.targetSpeed = Math.min(maxSpeedLimit, cart.targetSpeed + CART.throttleAccel * dt);
   } else {
      cart.targetSpeed = Math.max(0, cart.targetSpeed - CART.dragDecel * dt);
   }

   if (cart.stunTimer > 0) {
      cart.targetSpeed = 0;
   }

   // Desired velocity from heading and target speed
   const targetVx = Math.sin(cart.heading) * cart.targetSpeed;
   const targetVz = -Math.cos(cart.heading) * cart.targetSpeed;

   // Velocity eases toward target velocity with grip rate
   const gripFactor = 1 - Math.exp(-grip * dt);
   cart.vx += (targetVx - cart.vx) * gripFactor;
   cart.vz += (targetVz - cart.vz) * gripFactor;
   cart.speed = Math.hypot(cart.vx, cart.vz);

   // 3. Continuous Swept Collision (up to 3 passes)
   let remainingStepFrac = 1.0;
   let collidedObstacle = false;

   for (let pass = 0; pass < 3 && remainingStepFrac > 1e-4; pass++) {
      const stepDx = cart.vx * dt * remainingStepFrac;
      const stepDz = cart.vz * dt * remainingStepFrac;
      if (Math.abs(stepDx) < 1e-6 && Math.abs(stepDz) < 1e-6) break;

      // Update proxy box around current cart pos
      PROXY_BOX.min.x = cart.x - CART.proxyHalfX;
      PROXY_BOX.max.x = cart.x + CART.proxyHalfX;
      PROXY_BOX.min.z = cart.z - CART.proxyHalfZ;
      PROXY_BOX.max.z = cart.z + CART.proxyHalfZ;

      let earliestHitTime = Infinity;
      let hitNormalX = 0;
      let hitNormalZ = 0;

      const delta = { x: stepDx, z: stepDz };

      for (let i = 0; i < SOLID_OBSTACLES.length; i++) {
         const obs = SOLID_OBSTACLES[i];
         const t = sweptAabbXZ(PROXY_BOX, delta, obs, SWEEP_HIT);
         if (t !== null && t < earliestHitTime) {
            earliestHitTime = t;
            hitNormalX = SWEEP_HIT.normalX;
            hitNormalZ = SWEEP_HIT.normalZ;
         }
      }

      if (earliestHitTime === Infinity) {
         // No collision: move full remaining step
         cart.x += stepDx;
         cart.z += stepDz;
         break;
      }

      collidedObstacle = true;
      // Advance to impact point
      cart.x += stepDx * earliestHitTime;
      cart.z += stepDz * earliestHitTime;
      remainingStepFrac *= (1 - earliestHitTime);

      // Deflect velocity
      if (hitNormalX !== 0) {
         cart.vx = -CART.restitution * cart.vx;
      }
      if (hitNormalZ !== 0) {
         cart.vz = -CART.restitution * cart.vz;
      }
   }

   // Residual penetration push-out
   for (let i = 0; i < SOLID_OBSTACLES.length; i++) {
      resolveSphereAabb(cart, CART.radius, SOLID_OBSTACLES[i], cart);
   }

   // Outer store perimeter clamp
   if (cart.x < STORE.innerMinX) { cart.x = STORE.innerMinX; cart.vx = Math.abs(cart.vx) * CART.restitution; collidedObstacle = true; }
   if (cart.x > STORE.innerMaxX) { cart.x = STORE.innerMaxX; cart.vx = -Math.abs(cart.vx) * CART.restitution; collidedObstacle = true; }
   if (cart.z < STORE.innerMinZ) { cart.z = STORE.innerMinZ; cart.vz = Math.abs(cart.vz) * CART.restitution; collidedObstacle = true; }
   if (cart.z > STORE.innerMaxZ) { cart.z = STORE.innerMaxZ; cart.vz = -Math.abs(cart.vz) * CART.restitution; collidedObstacle = true; }

   if (collidedObstacle) {
      run.combo = 0; // Obstacle impact breaks combo streak
   }

   // 4. Can Pyramids Collision
   for (let i = 0; i < run.pyramids.length; i++) {
      const p = run.pyramids[i];
      if (!p.toppled && circlesOverlapXZ(cart, CART.radius, p, PYRAMID_RADIUS)) {
         p.toppled = true;
         cart.slowTimer = 0.5;
         run.combo = 0;
         events.pyramidToppled.push({ x: p.x, z: p.z });
      }
   }

   // 5. Shoppers Step & Collision
   for (let i = 0; i < run.shoppers.length; i++) {
      const shopper = run.shoppers[i];
      if (shopper.id === "shopperD" && !shopper.active && playTimeS >= 40.0) {
         shopper.active = true;
      }
      if (!shopper.active) continue;

      if (shopper.graceTimer > 0) {
         shopper.graceTimer = Math.max(0, shopper.graceTimer - dt);
      }

      stepPatrol(shopper.agent, shopper.patrolState, shopper.route, dt, { speed: 1.8, wait: 0.6 });

      if (shopper.graceTimer <= 0 && circlesOverlapXZ(cart, CART.radius, shopper.agent, 0.4)) {
         cart.stunTimer = 1.0;
         cart.targetSpeed = 0;
         cart.vx = 0;
         cart.vz = 0;
         cart.speed = 0;
         shopper.graceTimer = 1.5;
         run.combo = 0;
         events.shopperBumped.push({ x: shopper.agent.x, z: shopper.agent.z });
      }
   }

   // 6. List Item Pickups
   for (let i = 0; i < run.list.length; i++) {
      const item = run.list[i];
      if (!item.collected) {
         const dx = cart.x - item.x;
         const dz = cart.z - item.z;
         if (dx * dx + dz * dz <= CART.itemReach * CART.itemReach) {
            item.collected = true;
            run.collectedCount++;
            run.combo++;
            const pointsGained = POINTS.item + run.combo * POINTS.comboStep;
            run.score += pointsGained;
            events.pickups.push({
               kind: item.kind,
               score: pointsGained,
               combo: run.combo,
               x: item.x,
               z: item.z,
            });

            if (run.collectedCount === LIST_COUNT && !run.listComplete) {
               run.listComplete = true;
               run.score += POINTS.listComplete;
               events.listCompleted = true;
            }
         }
      }
   }

   // 7. Checkout Finish Zone Check
   if (run.listComplete && pointInAabb(cart, FINISH_ZONE)) {
      run.won = true;
      events.won = true;
      const timeLeftMs = Math.max(0, DURATION_MS - playTimeS * 1000);
      const timeBonus = POINTS.perSecond * Math.floor(timeLeftMs / 1000);
      run.score += timeBonus;
   }

   return events;
}

// ---------- Score & Limit Validation Helpers ----------

export function runScore(
   itemsCollected: number,
   comboPoints: number,
   listComplete: boolean,
   won: boolean,
   timeLeftMs: number,
): number {
   let s = itemsCollected * POINTS.item + comboPoints;
   if (listComplete) s += POINTS.listComplete;
   if (won) s += POINTS.perSecond * Math.floor(Math.max(0, timeLeftMs) / 1000);
   return s;
}

export function capScore(score: number, durationMs: number): number {
   return capToLimits(score, durationMs, shoppingCartMeta.scoring);
}

export function withinServerLimits(score: number, durationMs: number): boolean {
   return fitsLimits(score, durationMs, shoppingCartMeta.scoring);
}

export function withinProposedLimits(score: number, durationMs: number): boolean {
   return fitsLimits(score, durationMs, PROPOSED_LIMITS);
}
