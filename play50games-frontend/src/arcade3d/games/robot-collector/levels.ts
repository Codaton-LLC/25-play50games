// Robot Collector's five levels: pure data (no React, no three.js, no rules.ts values), read by
// rules.ts (createRun, layouts, stepRun), Scene.tsx / Primitives.tsx (the look) and index.tsx
// (the LevelSpecs). One warehouse, five configurations (docs/arcade-levels.md, core/README.md
// "Levels"). Level 1 is today's game and must never change: the same 10 batteries, 60 s, props
// and layouts, with no hazards.
//
// What a level varies: how many batteries (2 per wave), the clock, how many extra props stand,
// and the hazards. The hazards only ever block or slow the robot, never speed it up, so the
// scoring proof (README "Server limits") holds for every level:
// - slow zones: oil patches, the robot drives at SLOW_FACTOR of its top speed inside;
// - carts: crates riding a lane back and forth; touching one stuns the robot for STUN_S.
// Every list below is nested: level n+1 keeps everything level n has (rules.test.ts checks it).
import type { LevelId } from "../../types";
import type { Prop } from "./rules";

export interface SlowZone {
   x: number;
   z: number;
   r: number;
}

/** A cart rides the straight lane a -> b and back, at the level's `cartSpeed`; `phase` is its start (0..2 lane lengths). */
export interface CartLane {
   ax: number;
   az: number;
   bx: number;
   bz: number;
   phase: number;
}

export interface RobotLevel {
   /** batteries come 2 per wave, so a level has `2 * waves` of them */
   waves: number;
   durationMs: number;
   /** how many of EXTRA_PROPS stand (the first n) */
   extraProps: number;
   /** how many of SLOW_ZONES (the first n) */
   slowZones: number;
   /** how many of CART_LANES (the first n) */
   carts: number;
   /** units per second along a lane (0 with no carts) */
   cartSpeed: number;
   /** hand-placed layout for a seed that cannot produce a valid one (omitted = rules.ts FALLBACK_SPOTS, level 1) */
   fallback?: ReadonlyArray<readonly [number, number]>;
}

/** The robot's top speed inside a slow zone, as a fraction of ROBOT.maxSpeed. */
export const SLOW_FACTOR = 0.55;
/** Touching a cart: the robot cannot steer for STUN_S (it brakes), then is safe from the next stun for STUN_GRACE_S. */
export const STUN_S = 0.6;
export const STUN_GRACE_S = 0.8;
/** A cart is a crate-sized box. */
export const CART_SIZE = 1.2;

/**
 * Extra crates and barrels for levels 2-5 (after the 18 of rules.ts PROPS), in the order they
 * appear: L2 the first 4, L3 7, L4 10, L5 all 12. Hand-placed: every prop keeps a lane of at least
 * 1.2 to its neighbours (or touches them, a cluster), the carts' lanes and the start; the ones at
 * a wall touch it (rules.test.ts levels.test.ts checks).
 */
export const EXTRA_PROPS: readonly Prop[] = [
   // L2: a back-wall stack, a barrel in the right middle, a crate in the front left
   { kind: "crate", x: -1.8, z: -7.4 },
   { kind: "crate", x: -0.6, z: -7.4, stack: 2 },
   { kind: "barrel", x: 6.8, z: -3.4 },
   { kind: "crate", x: -5.6, z: 2.4 },
   // L3
   { kind: "barrel", x: 4.4, z: -2.2 },
   { kind: "crate", x: -5.4, z: 7.4 },
   { kind: "barrel", x: 11.2, z: 7.2 },
   // L4
   { kind: "crate", x: -11.4, z: -1 },
   { kind: "crate", x: -11.4, z: 0.2, stack: 2 },
   { kind: "crate", x: 6.4, z: 4 },
   // L5
   { kind: "barrel", x: 3.6, z: 3.9 },
   { kind: "crate", x: -4.4, z: -7.4 },
];

/** Oil patches (radius 1.3): L2 the first 3, L3 3, L4 4, L5 all 5. */
export const SLOW_ZONES: readonly SlowZone[] = [
   { x: -1.6, z: -2.2, r: 1.3 },
   { x: 8.6, z: 3, r: 1.3 },
   { x: -6.8, z: 0.2, r: 1.3 },
   { x: 2.4, z: -2.8, r: 1.3 },
   { x: -4.8, z: -4.2, r: 1.3 },
];

/**
 * Cart lanes: open stretches of floor, each at least 1.2 from every prop and wall, so the robot
 * is never squeezed between a cart and something else. L3 rides the first 2, L4 3, L5 all 4.
 */
export const CART_LANES: readonly CartLane[] = [
   { ax: -4, az: -4.2, bx: 1.6, bz: -4.2, phase: 0 },
   { ax: 10.2, az: -2.6, bx: 10.2, bz: 2.7, phase: 0.35 },
   { ax: -8, az: -1.8, bx: -8, bz: 2, phase: 0.7 },
   { ax: -2.4, az: 2.6, bx: -2.4, bz: 5.4, phase: 1.1 },
];

export const LEVELS: Record<LevelId, RobotLevel> = {
   // today's game, unchanged
   1: { waves: 5, durationMs: 60_000, extraProps: 0, slowZones: 0, carts: 0, cartSpeed: 0 },
   2: { waves: 6, durationMs: 70_000, extraProps: 4, slowZones: 3, carts: 0, cartSpeed: 0 },
   3: { waves: 7, durationMs: 80_000, extraProps: 7, slowZones: 3, carts: 2, cartSpeed: 1.6 },
   4: { waves: 8, durationMs: 85_000, extraProps: 10, slowZones: 4, carts: 3, cartSpeed: 2 },
   5: { waves: 9, durationMs: 90_000, extraProps: 12, slowZones: 5, carts: 4, cartSpeed: 2.4 },
};
