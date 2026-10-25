// Warehouse Rush's five levels: pure data, no React (docs/arcade-levels.md §6.3, README "Levels").
// One warehouse, five configurations. Level 1 is today's live game and must never change: 60 s,
// the two centre racks, four pallets, no lanes, no forklifts, no order deadline.
//
// What a level varies: the clock (more time, so more deliveries), slow lanes, extra shelves,
// forklift patrols and an order deadline. Lists are nested: level n+1 keeps everything level n has.
// Nothing here lets the robot outrun ROBOT.speed, so the straight-line score ceiling still holds.
import type { LevelId } from "../../types";

/** A floor rectangle (centre and half-size, metres). Slow lanes are paint; extra racks are solid. */
export interface FloorRect {
   x: number;
   z: number;
   hx: number;
   hz: number;
}

/** A forklift patrol. The body is hx × hz about (x, z) and travels `axis` between min and max. */
export interface ForkliftPath {
   x: number;
   z: number;
   hx: number;
   hz: number;
   axis: "x" | "z";
   min: number;
   max: number;
   /** 1 or -1, the direction it starts in */
   dir: 1 | -1;
}

export interface WarehouseLevel {
   id: LevelId;
   /** play time. Level 1 is DURATION_MS (60 s). */
   durationMs: number;
   /** how many of SLOW_ZONES apply (the first n) */
   slowZones: number;
   /** how many of EXTRA_RACKS stand (the first n) */
   extraRacks: number;
   /** how many of FORKLIFT_PATHS run (the first n) */
   forklifts: number;
   /** metres per second; 0 when no forklift runs */
   forkliftSpeed: number;
   /**
    * While empty-handed, the order expires after this much play (ms) and costs the wrong-zone
    * penalty. 0 = no deadline (levels 1–3).
    */
   orderMs: number;
   /** Looks only: a cool lamp over the robot so it reads on a dark floor. Omitted = no lamp. */
   lamp?: number;
}

/** Top speed inside a slow lane, as a fraction of the empty-handed or carry cap. */
export const SLOW_FACTOR = 0.72;

/**
 * Blue / red caution lanes on open floor, off the fast side-pallet legs (those run at |z| = 3.4).
 * L2+ uses all three: the centre aisle and both side gates.
 */
export const SLOW_ZONES: readonly FloorRect[] = [
   { x: 0, z: 0, hx: 0.95, hz: 1.85 },
   { x: 5.5, z: 0, hx: 1.05, hz: 1.7 },
   { x: -5.5, z: 0, hx: 1.05, hz: 1.7 },
];

/**
 * Short shelves in the side gates (1.4 × 0.9). They leave the |z| ≥ 1 passages and the
 * |z| = 3.4 delivery legs open. L3+ stands both.
 */
export const EXTRA_RACKS: readonly FloorRect[] = [
   { x: 5.5, z: 0, hx: 0.7, hz: 0.45 },
   { x: -5.5, z: 0, hx: 0.7, hz: 0.45 },
];

/**
 * Patrols on the open lanes just north and south of the centre racks (|z| ≈ 1.55), never on a
 * delivery leg (|z| = 3.4) and never inside a zone. Each body is narrow in z, so a robot walks
 * around it. The first crosses the north lane; the second the south lane, the other way.
 */
export const FORKLIFT_PATHS: readonly ForkliftPath[] = [
   { x: -4, z: 1.55, hx: 0.7, hz: 0.36, axis: "x", min: -6.2, max: 6.2, dir: 1 },
   { x: 4, z: -1.55, hx: 0.7, hz: 0.36, axis: "x", min: -6.2, max: 6.2, dir: -1 },
];

export const LEVELS: Record<LevelId, WarehouseLevel> = {
   // today's game, unchanged
   1: { id: 1, durationMs: 60_000, slowZones: 0, extraRacks: 0, forklifts: 0, forkliftSpeed: 0, orderMs: 0 },
   // Blue/Red Zones: the three lanes, a longer shift
   2: { id: 2, durationMs: 75_000, slowZones: 3, extraRacks: 0, forklifts: 0, forkliftSpeed: 0, orderMs: 0 },
   // Multi-Aisle: the lanes plus both extra shelves
   3: { id: 3, durationMs: 90_000, slowZones: 3, extraRacks: 2, forklifts: 0, forkliftSpeed: 0, orderMs: 0 },
   // Rush Shift: one forklift across the north lane and a 16 s order deadline, at night
   4: { id: 4, durationMs: 105_000, slowZones: 3, extraRacks: 2, forklifts: 1, forkliftSpeed: 2.2, orderMs: 16_000, lamp: 6 },
   // Night Logistics: a second forklift on the south lane, faster, and a 12 s deadline
   5: { id: 5, durationMs: 120_000, slowZones: 3, extraRacks: 2, forklifts: 2, forkliftSpeed: 3.1, orderMs: 12_000, lamp: 5 },
};
