// Warehouse Rush rules: the warehouse map, the seeded layout and its three streams, robot movement
// with the carry speed, pallets and refills, orders, Action handling, scoring and the constants of
// the scoring proof. Pure and deterministic: no three.js, React, DOM, Math.random or Date.now.
// Scene.tsx draws the seed (randomSeed), maps input with the view's yaw (inputToWorld) and calls
// step() once per useRunFrame; rules.test.ts drives it directly. Same seed + same inputs = same run.
//
// Clock: whole milliseconds, the fraction carried to the next step (as office-escape), so simMs
// never runs ahead of the store's elapsedMs and lags it by less than 1 ms. No allocation after
// createRun(): the pallets, the refill queue and the events object are fixed and rewritten in place,
// and step() returns the same events object every time.
// README.md is the design and holds the scoring proof. MIN_LEG, CYCLE_MIN_MS, FIRST_DELIVERY_MIN_MS,
// EARLIEST_DELIVERY_MS and SCORE_BOUND are computed below from the tuning numbers; rules.test.ts
// checks them.
import { clampToBounds, distanceToBoxXZ, resolveSphereAabb, type AABB, type Vec3Like } from "@/arcade3d/core/collision";
import { capScore as capToLimits, withinServerLimits as fitsLimits } from "@/arcade3d/core/limits";
import { rngNext, turnTowards, type RngState } from "@/arcade3d/core/math";
import { warehouseRushMeta } from "./meta";

// ---------- tuning (README "Constants") ----------

/** One run: 60 s of play. Only the clock ends a run ("timeup"); no lives, no win. */
export const DURATION_MS = 60_000;

/** The floor is 20 x 12 units (1 unit = 1 m) centred on the origin; the walls stand just outside it. */
export const ARENA = { halfX: 10, halfZ: 6 } as const;
/** Looks only: the walls outside the floor (Scene). */
export const WALL = { thickness: 0.4, height: 0.9 } as const;

/**
 * Units, units/s, units/s², 1/s. `speed` (empty-handed) and `carrySpeed` are the numbers the scoring
 * proof rests on: the speed guard in stepRobot never lets one step go farther than speed · dt.
 */
export const ROBOT = { radius: 0.5, speed: 6, carrySpeed: 5, accel: 30, brake: 36, turnRate: 14 } as const;
/** In the gap between the racks, facing the camera (heading 0 = facing +z, atan2(vx, vz)). */
export const ROBOT_START = { x: 0, z: 0, heading: 0 } as const;

/** "Nothing": an empty pallet, an empty grip, no zone, no pallet in reach. */
export const NONE = -1;

export const COLOUR_COUNT = 4;
/** Index = colour id. The zone letter belongs to the colour: "Zone B" is always the blue zone. */
export const COLOURS = [
   { name: "RED", hex: "#ef4444", zone: "A" },
   { name: "BLUE", hex: "#3b82f6", zone: "B" },
   { name: "YELLOW", hex: "#facc15", zone: "C" },
   { name: "GREEN", hex: "#22c55e", zone: "D" },
] as const;

/**
 * The 4 drop zones: corner squares of 3.5 x 3.5, |x| 6.5..10 and |z| 2.5..6. Corner index: bit 0 =
 * the +x side, bit 1 = the +z side (the camera's side in landscape), so 0 = back-left, 1 =
 * back-right, 2 = front-left, 3 = front-right. A drop counts when the robot's centre is inside
 * (edges included). Which colour sits in which corner is seeded per run.
 */
export const ZONE = { size: 3.5, innerX: 6.5, innerZ: 2.5 } as const;
export const CORNER_COUNT = 4;
export const cornerSignX = (corner: number): number => (corner & 1 ? 1 : -1);
export const cornerSignZ = (corner: number): number => (corner & 2 ? 1 : -1);

/** The 2 shelf racks across the middle: centres (±2.8, 0), footprint 3.6 x 0.9, height 1.1. Solid. */
export const RACK = { innerX: 1, outerX: 4.6, halfZ: 0.45, height: 1.1 } as const;

/**
 * The 6 pallet slots, in index order: the row z = -3.4 first, x ascending. Each run uses 2 per row.
 * With 4 pallets, index i of a layout's pallets is its i-th slot in this order.
 */
export const PALLET_SLOTS: ReadonlyArray<{ readonly x: number; readonly z: number }> = [
   { x: -3, z: -3.4 },
   { x: 0, z: -3.4 },
   { x: 3, z: -3.4 },
   { x: -3, z: 3.4 },
   { x: 0, z: 3.4 },
   { x: 3, z: 3.4 },
];
export const SLOTS_PER_ROW = 3;
export const PALLETS_PER_ROW = 2;
export const PALLET_COUNT = 4;
/** Pallet footprint 1.2 x 1.2 (solid), 0.18 high (looks). Holds at most one box. */
export const PALLET_HALF = 0.6;
export const PALLET_HEIGHT = 0.18;

/** Reach: the robot's centre within this distance of a pallet's edge (touching it is 0.5). */
export const PICK_GAP = 0.8;
/** A pick or a drop freezes the robot for this much play (whole steps, input ignored). */
export const PICK_MS = 250;
export const DROP_MS = 250;
/** A delivery puts a new box on the pallet that has been empty longest, this much later. */
export const REFILL_MS = 1500;
/** Right zone +50, wrong zone -20; the score never goes below 0. */
export const POINTS = { right: 50, wrong: -20 } as const;

/** Largest simulation step, ms: useRunFrame's dt is at most 1/20 s. Longer steps are clamped. */
export const MAX_STEP_MS = 50;

/** The streams' seeds: the run seed (layout), mixed with these (boxes, orders). */
export const BOX_SEED_MIX = 0x9e3779b9;
export const ORDER_SEED_MIX = 0x85ebca6b;
export const boxSeedFor = (seed: number): number => ((seed >>> 0) ^ BOX_SEED_MIX) >>> 0;
export const orderSeedFor = (seed: number): number => ((seed >>> 0) ^ ORDER_SEED_MIX) >>> 0;

/**
 * Float slack for the reach and zone edges, so the exact edge (0.8 from a pallet, x = 6.5) counts
 * although 4.4 - 3.6 is 0.8000000000000003 in floats. It cannot move a delivery: simMs is whole ms,
 * and the proof's bounds have more than a whole ms of room against 1e-9 m.
 */
const EDGE_EPS = 1e-9;

// ---------- the warehouse ----------

/** A box on the ground, tall in y: the robot (y = 0) is always level with it, so pushes are horizontal. */
function groundBox(minX: number, maxX: number, minZ: number, maxZ: number): AABB {
   return { min: { x: minX, y: -10, z: minZ }, max: { x: maxX, y: 10, z: maxZ } };
}

/** Zone `corner` as a ground box (|x| 6.5..10, |z| 2.5..6 on its side). */
export function zoneBounds(corner: number): AABB {
   const sx = cornerSignX(corner);
   const sz = cornerSignZ(corner);
   const xs = [sx * ZONE.innerX, sx * ARENA.halfX];
   const zs = [sz * ZONE.innerZ, sz * ARENA.halfZ];
   return groundBox(Math.min(xs[0], xs[1]), Math.max(xs[0], xs[1]), Math.min(zs[0], zs[1]), Math.max(zs[0], zs[1]));
}

export const ZONES: readonly AABB[] = [0, 1, 2, 3].map(zoneBounds);

export const RACKS: readonly AABB[] = [
   groundBox(-RACK.outerX, -RACK.innerX, -RACK.halfZ, RACK.halfZ),
   groundBox(RACK.innerX, RACK.outerX, -RACK.halfZ, RACK.halfZ),
];

/** Collision footprint of the pallet on `slot`. */
export function palletBounds(slot: number): AABB {
   const { x, z } = PALLET_SLOTS[slot];
   return groundBox(x - PALLET_HALF, x + PALLET_HALF, z - PALLET_HALF, z + PALLET_HALF);
}

/** The walls: the robot's centre stays ROBOT.radius inside this box (|x| <= 9.5, |z| <= 5.5). */
export const BOUNDS: AABB = groundBox(-ARENA.halfX, ARENA.halfX, -ARENA.halfZ, ARENA.halfZ);

/** The zone corner the point (the robot's centre) is in, edges included; NONE outside every zone. */
export function zoneAt(x: number, z: number): number {
   const ax = Math.abs(x);
   const az = Math.abs(z);
   if (ax < ZONE.innerX - EDGE_EPS || az < ZONE.innerZ - EDGE_EPS) return NONE;
   if (ax > ARENA.halfX + EDGE_EPS || az > ARENA.halfZ + EDGE_EPS) return NONE;
   return (x > 0 ? 1 : 0) | (z > 0 ? 2 : 0);
}

/** Is the point (the robot's centre) within PICK_GAP of the pallet footprint? */
export function inReach(x: number, z: number, bounds: AABB): boolean {
   return distanceToBoxXZ(x, z, bounds) <= PICK_GAP + EDGE_EPS;
}

// ---------- the scoring proof (README "Server limits and why they hold") ----------

/** Horizontal gap between two ground boxes (0 when they touch or overlap). */
function boxGapXZ(a: AABB, b: AABB): number {
   const dx = Math.max(0, b.min.x - a.max.x, a.min.x - b.max.x);
   const dz = Math.max(0, b.min.z - a.max.z, a.min.z - b.max.z);
   return Math.hypot(dx, dz);
}

/**
 * Straight-line distance from the reach of the pallet on `slot` (every centre within PICK_GAP of its
 * edge) to the inside of zone `corner`. Racks and pallets only make real paths longer.
 */
export function reachToZone(slot: number, corner: number): number {
   return Math.max(0, boxGapXZ(palletBounds(slot), ZONES[corner]) - PICK_GAP);
}

/** Straight-line distance from the start to the reach of the pallet on `slot`. */
export function startToReach(slot: number): number {
   return Math.max(0, distanceToBoxXZ(ROBOT_START.x, ROBOT_START.z, palletBounds(slot)) - PICK_GAP);
}

function minLegFrom(slot: number): number {
   let best = Infinity;
   for (let c = 0; c < CORNER_COUNT; c++) best = Math.min(best, reachToZone(slot, c));
   return best;
}

/** Proof step 4: the closest any reach comes to any zone (a side pallet and the corner beside it): 2.1. */
export const MIN_LEG = PALLET_SLOTS.reduce((best, _s, slot) => Math.min(best, minLegFrom(slot)), Infinity);

/**
 * Proof step 5: two deliveries are at least this far apart (ms of play): the drop lock, a drive of
 * MIN_LEG empty-handed, the pick lock and a drive of MIN_LEG carrying. 250 + 350 + 250 + 420 = 1270.
 */
export const CYCLE_MIN_MS = DROP_MS + (MIN_LEG / ROBOT.speed) * 1000 + PICK_MS + (MIN_LEG / ROBOT.carrySpeed) * 1000;

/**
 * Proof step 6: the first delivery comes no earlier than this (ms of play): from the start to the
 * reach of a pallet, the pick lock, then the carry into the nearest zone, over the best pallet (a
 * side pallet: 2.888 / 6 + 0.25 + 2.1 / 5 s = 1151.3 ms).
 */
export const FIRST_DELIVERY_MIN_MS = PALLET_SLOTS.reduce(
   (best, _s, slot) =>
      Math.min(best, (startToReach(slot) / ROBOT.speed) * 1000 + PICK_MS + (minLegFrom(slot) / ROBOT.carrySpeed) * 1000),
   Infinity
);

/**
 * The 9 pallet sets a layout can have (drawLayout): 2 of the 3 slots in the back row with 2 of the 3
 * in the front row, in index order.
 */
export const PALLET_SETS: ReadonlyArray<readonly number[]> = [0, 1, 2].flatMap((skipBack) =>
   [0, 1, 2].map((skipFront) => [
      ...[0, 1, 2].filter((k) => k !== skipBack),
      ...[0, 1, 2].filter((k) => k !== skipFront).map((k) => SLOTS_PER_ROW + k),
   ])
);

/**
 * Proof step 8: the earliest ms of play of the k-th delivery (index k - 1), right or wrong, over all 9
 * pallet sets and any play. An exact search over the state (zone corner of the last drop, last picked
 * pallet) with straight-line legs at the speed caps (steps 3 and 4), both locks (step 5) and the refill
 * lemma (step 7): a pallet picked twice in a row has its box again no earlier than REFILL_MS after the
 * delivery in between. Colours, racks, acceleration and every other refill are left out, which can only
 * make the times earlier, so each entry is a lower bound for real play. The last entry is past the clock.
 */
function earliestDeliveries(): number[] {
   // enough entries to pass DURATION_MS: every delivery after the first takes at least CYCLE_MIN_MS
   const count = 2 + Math.ceil((DURATION_MS - FIRST_DELIVERY_MIN_MS) / CYCLE_MIN_MS);
   const best = new Array<number>(count).fill(Infinity);
   const emptyMs = (slot: number, corner: number) => (reachToZone(slot, corner) / ROBOT.speed) * 1000;
   const carryMs = (slot: number, corner: number) => (reachToZone(slot, corner) / ROBOT.carrySpeed) * 1000;
   for (const set of PALLET_SETS) {
      const n = set.length;
      // time[corner * n + p]: the earliest delivery into `corner` of a box picked from pallet p
      let time = new Array<number>(CORNER_COUNT * n).fill(Infinity);
      for (let p = 0; p < n; p++) {
         const pick = (startToReach(set[p]) / ROBOT.speed) * 1000;
         for (let c = 0; c < CORNER_COUNT; c++) time[c * n + p] = pick + PICK_MS + carryMs(set[p], c);
      }
      for (let k = 0; k < count; k++) {
         best[k] = Math.min(best[k], ...time);
         const next = new Array<number>(CORNER_COUNT * n).fill(Infinity);
         for (let c = 0; c < CORNER_COUNT; c++) {
            for (let p = 0; p < n; p++) {
               const t = time[c * n + p];
               for (let q = 0; q < n; q++) {
                  let pick = t + DROP_MS + emptyMs(set[q], c);
                  // the refill lemma: the pallet emptied by the last pick is refilled REFILL_MS after this delivery
                  if (q === p) pick = Math.max(pick, t + REFILL_MS);
                  for (let c2 = 0; c2 < CORNER_COUNT; c2++) {
                     const s = c2 * n + q;
                     next[s] = Math.min(next[s], pick + PICK_MS + carryMs(set[q], c2));
                  }
               }
            }
         }
         time = next;
      }
   }
   return best;
}

/**
 * Proof step 8 (README table): EARLIEST_DELIVERY_MS[k - 1] is the earliest ms of play of the k-th
 * delivery: 1151.3, 2873.3, 4666.9, then 1793.6 ms more each; the 33rd at 58474.5, the 34th at 60268.1.
 */
export const EARLIEST_DELIVERY_MS: readonly number[] = earliestDeliveries();

/** The most deliveries (right or wrong) any play can make by `ms` of play. */
export function maxDeliveriesBy(ms: number): number {
   const table = EARLIEST_DELIVERY_MS;
   if (!(ms >= table[0])) return 0;
   const last = table.length - 1;
   // past the table (never in a 60 s run): every further delivery takes at least CYCLE_MIN_MS
   if (ms >= table[last]) return table.length + Math.floor((ms - table[last]) / CYCLE_MIN_MS);
   // table[lo] <= ms < table[hi]; the table rises strictly
   let lo = 0;
   let hi = last;
   while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (table[mid] <= ms) lo = mid;
      else hi = mid;
   }
   return lo + 1;
}

/** The highest score any play can have by `ms` of play: 50 per possible delivery. */
export const scoreBoundAt = (ms: number): number => POINTS.right * maxDeliveriesBy(ms);

/** The highest score any 60 s run can reach: 33 deliveries, 1650 (under maxScore 1700). */
export const SCORE_BOUND = scoreBoundAt(DURATION_MS);

// ---------- layouts ----------

export interface Layout {
   seed: number;
   /** the colour (0..3) of the zone in each corner (index = corner): a permutation */
   zoneColours: number[];
   /** the 4 pallet slots (indices into PALLET_SLOTS) in index order: 2 in the row z = -3.4, then 2 in z = +3.4 */
   slots: number[];
}

/**
 * Draws a layout from the layout stream `rng` (createRun keeps it in the run): the zone permutation
 * (Fisher-Yates, 3 draws), then per row the one slot it leaves out (2 draws). 24 x 9 = 216 layouts.
 */
function drawLayout(seed: number, rng: RngState): Layout {
   const zoneColours = [0, 1, 2, 3];
   for (let i = CORNER_COUNT - 1; i > 0; i--) {
      const j = Math.floor(rngNext(rng) * (i + 1));
      const t = zoneColours[i];
      zoneColours[i] = zoneColours[j];
      zoneColours[j] = t;
   }
   const slots: number[] = [];
   for (let row = 0; row < 2; row++) {
      const skip = Math.floor(rngNext(rng) * SLOTS_PER_ROW);
      for (let k = 0; k < SLOTS_PER_ROW; k++) if (k !== skip) slots.push(row * SLOTS_PER_ROW + k);
   }
   return { seed: seed >>> 0, zoneColours, slots };
}

/** The layout of a run seed (the same one createRun(seed) uses). */
export function generateLayout(seed: number): Layout {
   return drawLayout(seed, { s: seed >>> 0 });
}

/** Everything fairness and the proof rely on: the colours are a permutation, 2 pallets per row on the slot grid. */
export function isValidLayout(layout: Layout): boolean {
   const { zoneColours, slots } = layout;
   if (zoneColours.length !== CORNER_COUNT || slots.length !== PALLET_COUNT) return false;
   const seen = [false, false, false, false];
   for (const colour of zoneColours) {
      if (!Number.isInteger(colour) || colour < 0 || colour >= COLOUR_COUNT || seen[colour]) return false;
      seen[colour] = true;
   }
   const perRow = [0, 0];
   for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!Number.isInteger(slot) || slot < 0 || slot >= PALLET_SLOTS.length) return false;
      // index order without repeats
      if (i > 0 && slot <= slots[i - 1]) return false;
      perRow[Math.floor(slot / SLOTS_PER_ROW)] += 1;
   }
   return perRow[0] === PALLETS_PER_ROW && perRow[1] === PALLETS_PER_ROW;
}

/** The corner of the zone painted in `colour` (NONE if the layout has none). */
export function zoneCornerOf(layout: Layout, colour: number): number {
   for (let c = 0; c < CORNER_COUNT; c++) if (layout.zoneColours[c] === colour) return c;
   return NONE;
}

// ---------- robot movement ----------

export interface RobotState extends Vec3Like {
   vx: number;
   vz: number;
   /** facing, radians around +y (0 = facing +z) */
   heading: number;
}

export function createRobot(): RobotState {
   return { x: ROBOT_START.x, y: 0, z: ROBOT_START.z, vx: 0, vz: 0, heading: ROBOT_START.heading };
}

/**
 * One movement step (robot-collector's, with the top speed of the carry state). `dirX/dirZ` is the
 * wanted world direction (length <= 1, analog; longer is normalised, so diagonals are not faster),
 * `dt` in seconds. Racks and pallets (`obstacles`) push the robot out, the walls keep it in, then the
 * speed guard scales the step back. Mutates `robot`, allocates nothing.
 * Guarantee used by the scoring proof: one step never moves more than (carrying ? 5 : 6) · dt,
 * whatever the input, the pushes or the walls do.
 */
export function stepRobot(robot: RobotState, dirX: number, dirZ: number, dt: number, carrying: boolean, obstacles: readonly AABB[]): void {
   if (!(dt > 0)) return;
   const { accel, brake, radius, turnRate } = ROBOT;
   const maxSpeed = carrying ? ROBOT.carrySpeed : ROBOT.speed;

   let len = Math.hypot(dirX, dirZ);
   if (len > 1) {
      dirX /= len;
      dirZ /= len;
      len = 1;
   }

   // ease the velocity towards the wanted one (accelerating or braking)
   let dvx = dirX * maxSpeed - robot.vx;
   let dvz = dirZ * maxSpeed - robot.vz;
   const dv = Math.hypot(dvx, dvz);
   const maxDv = (len > 0.01 ? accel : brake) * dt;
   if (dv > maxDv) {
      dvx *= maxDv / dv;
      dvz *= maxDv / dv;
   }
   robot.vx += dvx;
   robot.vz += dvz;

   const fromX = robot.x;
   const fromZ = robot.z;
   robot.x += robot.vx * dt;
   robot.y = 0;
   robot.z += robot.vz * dt;

   for (let i = 0; i < obstacles.length; i++) resolveSphereAabb(robot, radius, obstacles[i], robot);
   clampToBounds(robot, BOUNDS, radius, robot);

   // speed guard: whatever the pushes did, this step moves at most maxSpeed * dt
   const mx = robot.x - fromX;
   const mz = robot.z - fromZ;
   const moved = Math.hypot(mx, mz);
   const maxMove = maxSpeed * dt;
   if (moved > maxMove) {
      robot.x = fromX + (mx * maxMove) / moved;
      robot.z = fromZ + (mz * maxMove) / moved;
   }

   // velocity = what really happened: pushing into a rack stops, sliding along it keeps going
   robot.vx = (robot.x - fromX) / dt;
   robot.vz = (robot.z - fromZ) / dt;

   if (Math.hypot(robot.vx, robot.vz) > 0.3) {
      robot.heading = turnTowards(robot.heading, Math.atan2(robot.vx, robot.vz), 1 - Math.exp(-turnRate * dt));
   }
}

// ---------- the run ----------

export interface Pallet {
   /** index into PALLET_SLOTS */
   slot: number;
   x: number;
   z: number;
   /** the colour of the box on it, NONE = empty */
   box: number;
   /** simMs when it last became empty (a refill goes to the pallet empty longest) */
   emptiedAt: number;
   /** collision footprint, also the reach test's box */
   bounds: AABB;
}

/** One frame of input. Scene fills one object per run and passes it every step. */
export interface StepInput {
   /**
    * The wanted direction on the floor in world space: moveX = world x, moveY = world z. Scene maps
    * the core's moveX / moveY with inputToWorld(moveX, moveY, view.yaw), so up is always "away from
    * the camera". Length <= 1 (longer is normalised); not finite counts as 0.
    */
   moveX: number;
   moveY: number;
   /** Action this frame: the core's actionPressed || jumpPressed (one-frame press events) */
   actionPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveY: 0, actionPressed: false };
}

/** What happened in one step. The same object every step (reset at the start of each step). */
export interface StepEvents {
   /** the pallet (index) whose box was lifted, NONE without a pick */
   picked: number;
   /** the pallet (index) whose box was refused (not the order colour): it shakes; NONE otherwise */
   refused: number;
   /** a box went into the zone of the order colour (+50) */
   delivered: boolean;
   /** a box went into another zone (-20, floored at 0) */
   wrong: boolean;
   /** the corner of the zone a box went into, NONE without a delivery */
   zone: number;
   /** the real change of the score: +50, -20, or less when the floor at 0 cut the penalty; 0 otherwise */
   delta: number;
   /** a new order was drawn (in the same step as every delivery) */
   newOrder: boolean;
   /** bit i set: pallet i received a new box (a refill landed) */
   refilled: number;
   /** the run ended: the clock reached DURATION_MS */
   ended: "timeup" | null;
}

export interface WarehouseRun {
   seed: number;
   layout: Layout;
   /** the three rngNext streams (README "Seeds and streams") */
   rng: { layout: RngState; boxes: RngState; orders: RngState };

   // clock
   /** simulation time, whole ms of play */
   simMs: number;
   /** fraction of a ms carried to the next step, [0, 1) */
   carry: number;
   /** whole ms of the latest step, 0..MAX_STEP_MS */
   stepMs: number;
   /** ms of play spent in steps that moved the robot / that stood in a lock (the proof's split) */
   movedMs: number;
   lockedMs: number;

   // robot
   robot: RobotState;
   /** the colour of the box in the grip, NONE = empty-handed. Always the order colour. */
   carrying: number;
   /** ms left of the pick or drop lock */
   lockMs: number;

   // pallets and refills
   /** PALLET_COUNT pallets, in the layout's index order */
   pallets: Pallet[];
   /** racks, then the pallets' footprints (stepRobot) */
   obstacles: AABB[];
   /** pending refills: a ring of PALLET_COUNT due times (simMs), oldest at refillHead */
   refillDue: number[];
   refillHead: number;
   refillCount: number;

   // orders and scoring
   /** the ordered colour: its box and its zone */
   order: number;
   /** orders drawn so far (the first one in createRun) */
   orders: number;
   score: number;
   picks: number;
   /** every delivery, right or wrong */
   drops: number;
   /** right deliveries (the HUD's "Delivered") */
   delivered: number;
   wrong: number;
   refusals: number;
   /** the change of the score at the latest delivery, and its zone corner (NONE before the first) */
   lastDelta: number;
   lastZone: number;

   ended: "timeup" | null;
   events: StepEvents;
}

function createEvents(): StepEvents {
   return { picked: NONE, refused: NONE, delivered: false, wrong: false, zone: NONE, delta: 0, newOrder: false, refilled: 0, ended: null };
}

function resetEvents(ev: StepEvents): void {
   ev.picked = NONE;
   ev.refused = NONE;
   ev.delivered = false;
   ev.wrong = false;
   ev.zone = NONE;
   ev.delta = 0;
   ev.newOrder = false;
   ev.refilled = 0;
   ev.ended = null;
}

export interface RunOptions {
   /** tests only: play this layout instead of the seed's */
   layout?: Layout;
   /** tests only: the order stream's seed (changing it must leave the layout and the boxes alone) */
   orderSeed?: number;
}

/**
 * A new run, standing on the start spot: the layout, the 4 starting boxes (pallets in index order)
 * and the first order are drawn here, so Scene can publish the order before the countdown.
 * Allocates everything the run will ever use.
 */
export function createRun(seed: number, options: RunOptions = {}): WarehouseRun {
   const s = seed >>> 0;
   const rng = {
      layout: { s },
      boxes: { s: boxSeedFor(s) },
      orders: { s: options.orderSeed === undefined ? orderSeedFor(s) : options.orderSeed >>> 0 },
   };
   const layout = options.layout ?? drawLayout(s, rng.layout);
   const pallets: Pallet[] = layout.slots.map((slot) => ({
      slot,
      x: PALLET_SLOTS[slot].x,
      z: PALLET_SLOTS[slot].z,
      box: Math.floor(rngNext(rng.boxes) * COLOUR_COUNT),
      emptiedAt: 0,
      bounds: palletBounds(slot),
   }));
   const run: WarehouseRun = {
      seed: s,
      layout,
      rng,
      simMs: 0,
      carry: 0,
      stepMs: 0,
      movedMs: 0,
      lockedMs: 0,
      robot: createRobot(),
      carrying: NONE,
      lockMs: 0,
      pallets,
      obstacles: [...RACKS, ...pallets.map((p) => p.bounds)],
      refillDue: new Array<number>(PALLET_COUNT).fill(0),
      refillHead: 0,
      refillCount: 0,
      order: NONE,
      orders: 0,
      score: 0,
      picks: 0,
      drops: 0,
      delivered: 0,
      wrong: 0,
      refusals: 0,
      lastDelta: 0,
      lastZone: NONE,
      ended: null,
      events: createEvents(),
   };
   drawOrder(run);
   resetEvents(run.events);
   return run;
}

/** Occupied pallets right now. */
export function occupiedPallets(run: WarehouseRun): number {
   let n = 0;
   for (let i = 0; i < run.pallets.length; i++) if (run.pallets[i].box !== NONE) n += 1;
   return n;
}

/** The pallet (index) whose reach the point is in, NONE if none (at most one ever is: README "Constants"). */
export function palletInReach(pallets: readonly Pallet[], x: number, z: number): number {
   for (let i = 0; i < pallets.length; i++) if (inReach(x, z, pallets[i].bounds)) return i;
   return NONE;
}

/**
 * The next order: the k-th occupied pallet in index order, k = floor(r · occupied), so the ordered
 * box exists at the moment of the draw. With no occupied pallet (never: at least 2 are occupied at
 * every draw, README "Pallets, boxes and refills") the order stays and nothing is drawn.
 */
function drawOrder(run: WarehouseRun): void {
   const occupied = occupiedPallets(run);
   if (occupied === 0) return;
   let k = Math.floor(rngNext(run.rng.orders) * occupied);
   for (let i = 0; i < run.pallets.length; i++) {
      const box = run.pallets[i].box;
      if (box === NONE) continue;
      if (k === 0) {
         run.order = box;
         break;
      }
      k -= 1;
   }
   run.orders += 1;
   run.events.newOrder = true;
}

function scheduleRefill(run: WarehouseRun): void {
   // boxes in play + pending refills = 4 and a delivery needs a carried box, so there is always room
   if (run.refillCount >= run.refillDue.length) return;
   run.refillDue[(run.refillHead + run.refillCount) % run.refillDue.length] = run.simMs + REFILL_MS;
   run.refillCount += 1;
}

/** The empty pallet empty longest (ties: lower index), NONE if every pallet holds a box. */
function oldestEmpty(run: WarehouseRun): number {
   let best = NONE;
   for (let i = 0; i < run.pallets.length; i++) {
      const p = run.pallets[i];
      if (p.box !== NONE) continue;
      if (best === NONE || p.emptiedAt < run.pallets[best].emptiedAt) best = i;
   }
   return best;
}

/** Lands every due refill, oldest first, each with the next colour of the box stream. */
function landRefills(run: WarehouseRun): void {
   while (run.refillCount > 0 && run.refillDue[run.refillHead] <= run.simMs) {
      run.refillHead = (run.refillHead + 1) % run.refillDue.length;
      run.refillCount -= 1;
      // an empty pallet always exists: empty pallets = carried + pending >= 1
      const i = oldestEmpty(run);
      if (i === NONE) continue;
      run.pallets[i].box = Math.floor(rngNext(run.rng.boxes) * COLOUR_COUNT);
      run.events.refilled |= 1 << i;
   }
}

/** Score after one delivery: +50 in the right zone, -20 in a wrong one, never below 0. */
export function scoreAfter(score: number, right: boolean): number {
   return right ? score + POINTS.right : Math.max(0, score + POINTS.wrong);
}

/** Action at the robot's position after this step's move (README "Action"). */
function act(run: WarehouseRun): void {
   const ev = run.events;
   const robot = run.robot;
   if (run.carrying !== NONE) {
      const corner = zoneAt(robot.x, robot.z);
      if (corner === NONE) return;
      const right = run.layout.zoneColours[corner] === run.order;
      const before = run.score;
      run.score = scoreAfter(before, right);
      run.carrying = NONE;
      run.lockMs = DROP_MS;
      run.drops += 1;
      if (right) run.delivered += 1;
      else run.wrong += 1;
      run.lastDelta = run.score - before;
      run.lastZone = corner;
      ev.delivered = right;
      ev.wrong = !right;
      ev.zone = corner;
      ev.delta = run.lastDelta;
      robot.vx = 0;
      robot.vz = 0;
      scheduleRefill(run);
      drawOrder(run);
      return;
   }
   const i = palletInReach(run.pallets, robot.x, robot.z);
   if (i === NONE) return;
   const pallet = run.pallets[i];
   if (pallet.box === NONE) return;
   if (pallet.box !== run.order) {
      run.refusals += 1;
      ev.refused = i;
      return;
   }
   run.carrying = pallet.box;
   pallet.box = NONE;
   pallet.emptiedAt = run.simMs;
   run.lockMs = PICK_MS;
   run.picks += 1;
   ev.picked = i;
   robot.vx = 0;
   robot.vz = 0;
}

/**
 * Advances the integer clock by `dtMs` (clamped to MAX_STEP_MS) with the carried remainder, never
 * past DURATION_MS. Returns the whole-ms step. The sum of the steps never runs ahead of the sum of
 * the dts and lags it by less than 1 ms.
 */
export function advanceClock(run: WarehouseRun, dtMs: number): number {
   if (!(dtMs > 0)) {
      run.stepMs = 0;
      return 0;
   }
   run.carry += Math.min(dtMs, MAX_STEP_MS);
   let stepMs = Math.floor(run.carry);
   run.carry -= stepMs;
   if (run.simMs + stepMs >= DURATION_MS) {
      stepMs = DURATION_MS - run.simMs;
      run.carry = 0;
   }
   run.stepMs = stepMs;
   run.simMs += stepMs;
   return stepMs;
}

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);

/**
 * One simulation step: `dtMs` is useRunFrame's dt · 1000 (dt <= 0 or NaN does nothing). Order
 * (README "One step"):
 * 1. the clock (whole ms, remainder carried); the step that reaches DURATION_MS ends the run before
 *    anything else, as RunClock does;
 * 2. every due refill lands (before the move, so it can be picked in this step);
 * 3. lock: while lockMs > 0 the step only counts it down (velocity 0, input and press ignored) and
 *    ends, so a lock covers whole steps and the step that brings it to 0 does not move;
 * 4. move, with the top speed of the carry state;
 * 5. Action at the new position (pick, refuse or deliver).
 * Returns run.events, the same object every step. Allocates nothing.
 */
export function step(run: WarehouseRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   if (run.ended !== null || !(dtMs > 0)) return ev;

   const stepMs = advanceClock(run, dtMs);
   if (run.simMs >= DURATION_MS) {
      run.ended = "timeup";
      ev.ended = "timeup";
      return ev;
   }

   landRefills(run);

   const robot = run.robot;
   if (run.lockMs > 0) {
      run.lockMs = Math.max(0, run.lockMs - stepMs);
      run.lockedMs += stepMs;
      robot.vx = 0;
      robot.vz = 0;
      return ev;
   }

   run.movedMs += stepMs;
   stepRobot(robot, finite(input.moveX), finite(input.moveY), stepMs / 1000, run.carrying !== NONE, run.obstacles);
   if (input.actionPressed) act(run);
   return ev;
}

// ---------- server limits ----------

/** The server's check (core/limits.ts) with this game's limits from meta.ts. */
export function withinServerLimits(score: number, durationMs: number): boolean {
   return fitsLimits(score, durationMs, warehouseRushMeta.scoring);
}

/**
 * Safety net only (index.tsx finalScore, core/limits.ts capScore with meta.ts limits): the proof in
 * README.md shows real runs never reach the cap, and rules.test.ts checks it stays a no-op.
 */
export function capScore(score: number, durationMs: number): number {
   return capToLimits(score, durationMs, warehouseRushMeta.scoring);
}
