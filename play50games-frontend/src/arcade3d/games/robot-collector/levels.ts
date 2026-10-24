// Robot Collector's five levels: pure data (no React, no three.js, no rules.ts values), read by
// rules.ts (createRun, layouts, stepRun), Scene.tsx / Primitives.tsx (the look) and index.tsx
// (the LevelSpecs). One warehouse, five configurations (docs/arcade-levels.md, core/README.md
// "Levels"). Level 1 is today's game and must never change: the same 10 batteries, 60 s, props
// and layouts, with no hazards.
//
// What a level varies: how many batteries (2 per wave), the clock, how many extra props stand,
// and the hazards. The hazards never let the robot move faster than ROBOT.maxSpeed (stepRobot's
// speed guard), so the scoring proof (README "Server limits") holds for every level:
// - slow zones: oil patches, the robot drives at SLOW_FACTOR of its top speed inside;
// - conveyor belts: floor strips that drift the robot along them at the level's beltSpeed.
// Every list below is nested: level n+1 keeps everything level n has (rules.test.ts checks it).
import type { LevelId } from "../../types";
import type { Prop } from "./rules";

export interface SlowZone {
   x: number;
   z: number;
   r: number;
}

/** A conveyor belt: the robot drifts from a towards b while its centre is within BELT_HALF_WIDTH of the segment a-b. */
export interface Belt {
   ax: number;
   az: number;
   bx: number;
   bz: number;
}

export interface RobotLevel {
   /** batteries come 2 per wave, so a level has `2 * waves` of them */
   waves: number;
   durationMs: number;
   /** how many of EXTRA_PROPS stand (the first n) */
   extraProps: number;
   /** how many of SLOW_ZONES (the first n) */
   slowZones: number;
   /** how many of BELTS run (the first n) */
   belts: number;
   /** units per second the belts drift the robot (0 with no belts) */
   beltSpeed: number;
   /** hand-placed layout for a seed that cannot produce a valid one (omitted = rules.ts FALLBACK_SPOTS, level 1) */
   fallback?: ReadonlyArray<readonly [number, number]>;
}

/** The robot's top speed inside a slow zone, as a fraction of ROBOT.maxSpeed. */
export const SLOW_FACTOR = 0.55;
/** Half the width of a belt strip. */
export const BELT_HALF_WIDTH = 0.8;

/**
 * Extra crates and barrels for levels 2-5 (after the 18 of rules.ts PROPS), in the order they
 * appear: L2 the first 4, L3 7, L4 10, L5 all 12. Hand-placed: every prop keeps a lane of at least
 * 1.2 to its neighbours (or touches them, a cluster), the belts and the start; the ones at
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
 * Conveyor belts on open stretches of floor, clear of every prop: L3 runs the first 2, L4 3, L5 all 4.
 * They alternate direction so no belt route is a shortcut.
 */
export const BELTS: readonly Belt[] = [
   { ax: -4, az: -4.2, bx: 1.6, bz: -4.2 },
   { ax: 10.2, az: 2.7, bx: 10.2, bz: -2.6 },
   { ax: -8, az: -1.8, bx: -8, bz: 2 },
   { ax: -2.4, az: 5.4, bx: -2.4, bz: 2.6 },
];

/** Hand-placed layouts (one valid generated layout each) for a seed that cannot produce a valid one; level 1 keeps rules.ts FALLBACK_SPOTS. */
const FALLBACKS = {
   2: [[-6.5, -4.5], [-9.5, 2], [-1.5, 2], [2.5, -3.5], [10, 3], [6, 6], [-1, -1.5], [-5, -5], [8, -1], [6.5, 5], [-10.5, -1], [-4.5, -6]],
   3: [[-9, 0.5], [-2.5, 4.5], [7.5, 6.5], [-2.5, -4.5], [8, -1.5], [-1.5, 5], [-1.5, -3], [-9.5, -0.5], [7, -6], [3.5, 5], [-9, 1], [-2, -1], [7.5, -5], [6, 3.5]],
   4: [[-7, -1], [-3, 4], [5, -0.5], [7, 6.5], [-3.5, -6.5], [-7, -0.5], [8.5, -4], [1.5, 4], [-7.5, -3.5], [-0.5, -4], [4.5, 3], [10.5, 1.5], [-10.5, 3], [-6.5, -1.5], [10.5, -1], [2.5, -3]],
   5: [[-3, -3], [-3, 3], [6.5, 6.5], [10.5, 2], [-1.5, -1], [7.5, -5.5], [-10, 6.5], [8, 2.5], [-3.5, -5], [-9.5, -2.5], [8.5, -1.5], [5.5, 6], [-4.5, -5.5], [0.5, -0.5], [8.5, -4.5], [8.5, 3], [-1.5, 1], [-9.5, -1]],
} as const;

export const LEVELS: Record<LevelId, RobotLevel> = {
   // today's game, unchanged
   1: { waves: 5, durationMs: 60_000, extraProps: 0, slowZones: 0, belts: 0, beltSpeed: 0 },
   2: { waves: 6, durationMs: 70_000, extraProps: 4, slowZones: 3, belts: 0, beltSpeed: 0, fallback: FALLBACKS[2] },
   3: { waves: 7, durationMs: 80_000, extraProps: 7, slowZones: 3, belts: 2, beltSpeed: 1.6, fallback: FALLBACKS[3] },
   4: { waves: 8, durationMs: 85_000, extraProps: 10, slowZones: 4, belts: 3, beltSpeed: 2, fallback: FALLBACKS[4] },
   5: { waves: 9, durationMs: 90_000, extraProps: 12, slowZones: 5, belts: 4, beltSpeed: 2.4, fallback: FALLBACKS[5] },
};
