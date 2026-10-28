// Color City Sprint's five levels (docs/menu2-super/world-1-ember-heights.md "15 Color City Sprint").
// Plain data: city.ts turns a spec into the course the rules run on. One base city (a grid of
// blocks between 6 m streets, CELL metres apart) and five configurations of it: which blocks are
// buildings, plazas, open lots (the coned alley), construction sites (Riko), ghost shops (Vexa);
// the beacons, buses, ramps, the elevated rail, gates, sludge, steam vents, storm drains, orbs and
// secrets. Coordinates are metres; node (ix, iz) sits at (ix * CELL, iz * CELL).
import type { LevelId } from "../../types";

/** The design card's signature. layouts.test.ts pins it. */
export const SIGNATURE = "route-making laps";

export const CELL = 12;

export type BlockKind = "building" | "plaza" | "lot" | "site" | "ghost";

export interface XZ {
   x: number;
   z: number;
}

export interface XYZ extends XZ {
   y: number;
}

/** A beacon at a point, or riding bus `bus` (its roof). */
export type BeaconSpec = XZ | { bus: number };

export interface BusSpec {
   /** the loop's corners (node ix, iz), driven in order and back to the first; one corner = parked */
   loop: [number, number][];
   /** ms for one lap of the loop (ignored when parked) */
   cycleMs: number;
   /** where in its loop the bus is at ms 0 (ms) */
   phaseMs: number;
   /** a parked bus: its centre offset across the street (m) and heading (rad, 0 = +z) */
   parked?: { dx: number; dz: number; yaw: number };
}

/** A street ramp: the lip (the high end) and the direction it rises toward. */
export interface RampSpec extends XZ {
   dir: "+x" | "-x" | "+z" | "-z";
}

/** A colour gate across the street between two nodes. Phase 0 is green while phase 1 is red. */
export interface GateSpec {
   a: [number, number];
   b: [number, number];
   phase: 0 | 1;
}

export interface CircleSpec extends XZ {
   r: number;
}

export interface OrbSpec extends XYZ {
   /** counts toward the "all orbs" star; the bonus orbs (rail, drains) only cut the time */
   main: boolean;
}

export interface CitySpec {
   id: LevelId;
   name: string;
   /** intersections on x and z */
   nx: number;
   nz: number;
   laps: number;
   timerMs: number;
   /** the third star: the submitted time at or under this */
   starTargetMs: number;
   start: XZ;
   /** blocks that are not plain buildings (bx, bz) */
   blocks: { at: [number, number]; kind: Exclude<BlockKind, "building"> }[];
   /** in order; repeated every lap. Level 5 cycles them until Greyout falls. */
   beacons: BeaconSpec[];
   buses: BusSpec[];
   ramps: RampSpec[];
   /** the elevated rail: a straight deck over a street, from a to b (node ix, iz), or null */
   rail: { a: [number, number]; b: [number, number] } | null;
   gates: GateSpec[];
   sludge: CircleSpec[];
   vents: CircleSpec[];
   /** storm drains and fountains: each hides a coin trail only Zuno's magnet pulls out */
   drains: XZ[];
   orbs: OrbSpec[];
   /** the level's secrets, in progression.ts SECRETS order */
   secrets: XYZ[];
   night: boolean;
   boss: boolean;
   /** level 4: the perfect loop (streets between these nodes, in order, closed) */
   ring: [number, number][] | null;
   /** level 5: Greyout Avenue, streets that start red and cannot be swept (between these nodes, in order) */
   avenue: [number, number][] | null;
   /** level 5: where Greyout parks for each brush window (one per ramp, the ramp facing its brushes) */
   brushStops: { x: number; z: number; yaw: number; ramp: number }[];
   /** level 5: where Greyout parks for each valve window (on the avenue) */
   valveStops: { x: number; z: number; yaw: number }[];
}

const Y = 0.75;
/** the rail deck's height (m); a jump from a bus roof falls short of it, Nami's second jump does not */
export const RAIL_Y = 7.4;
const RY = RAIL_Y + 0.75;
const n = (ix: number, iz: number): XZ => ({ x: ix * CELL, z: iz * CELL });
const blockCentre = (bx: number, bz: number): XZ => ({ x: bx * CELL + CELL / 2, z: bz * CELL + CELL / 2 });

export const LEVELS: Record<LevelId, CitySpec> = {
   // L1 teaches in three beats on a 3 x 3 block sub-grid: a beacon straight down the avenue, a beacon
   // behind a choice (the coned lot cuts the corner, the clear avenue goes round), then lap 2 on your
   // own red lanes into the plaza.
   1: {
      id: 1,
      name: "Red Block",
      nx: 4,
      nz: 4,
      laps: 2,
      timerMs: 100_000,
      starTargetMs: 44_000,
      start: n(0, 0),
      blocks: [
         { at: [1, 1], kind: "plaza" },
         { at: [2, 0], kind: "lot" },
         { at: [0, 2], kind: "site" },
         { at: [2, 2], kind: "ghost" },
      ],
      beacons: [n(3, 0), n(2, 1), n(0, 3), blockCentre(1, 1)],
      // a bus parked on the north street under the rail: the ramp puts you on its roof
      buses: [{ loop: [[2, 3]], cycleMs: 0, phaseMs: 0, parked: { dx: 4, dz: 0.9, yaw: Math.PI / 2 } }],
      ramps: [{ x: 22.4, z: 36.9, dir: "+x" }],
      rail: { a: [0, 3], b: [3, 3] },
      gates: [],
      sludge: [{ x: 36, z: 5.5, r: 1.9 }],
      vents: [],
      drains: [blockCentre(1, 1), { x: 30, z: 6 }],
      orbs: [
         { x: 18, y: Y, z: 0, main: true },
         { x: 30.5, y: Y, z: 5, main: true },
         { x: 36, y: Y, z: 19, main: true },
         { x: 12, y: Y, z: 30, main: true },
         { x: 0, y: Y, z: 18, main: true },
         { x: 15, y: Y, z: 36, main: true },
         { x: 6, y: RY, z: 36, main: false },
         { x: 15, y: RY, z: 36, main: false },
      ],
      secrets: [
         { x: 1.2, y: RY, z: 36 },
         { x: 30, y: 1, z: 30 },
         { x: 6, y: 1, z: 30 },
      ],
      night: false,
      boss: false,
      ring: null,
      avenue: null,
      brushStops: [],
      valveStops: [],
   },
   // L2: two buses loop their blocks every 9 s; ramps put you on their roofs; one beacon rides a bus.
   2: {
      id: 2,
      name: "Bus Line",
      nx: 5,
      nz: 4,
      laps: 2,
      timerMs: 130_000,
      starTargetMs: 58_000,
      start: n(0, 0),
      blocks: [
         { at: [3, 0], kind: "plaza" },
         { at: [0, 2], kind: "site" },
         { at: [1, 2], kind: "ghost" },
      ],
      beacons: [{ bus: 0 }, n(4, 2), n(0, 3), blockCentre(3, 0)],
      buses: [
         { loop: [[1, 0], [2, 0], [2, 1], [1, 1]], cycleMs: 9_000, phaseMs: 0 },
         { loop: [[2, 2], [3, 2], [3, 3], [2, 3]], cycleMs: 9_000, phaseMs: 4_500 },
      ],
      ramps: [
         { x: 9.5, z: 12, dir: "+x" },
         { x: 19.5, z: 36, dir: "+x" },
      ],
      rail: { a: [0, 3], b: [4, 3] },
      gates: [],
      sludge: [{ x: 48, z: 12, r: 2 }, { x: 24, z: 30, r: 1.8 }],
      vents: [],
      drains: [blockCentre(3, 0), { x: 36, z: 18 }],
      orbs: [
         { x: 6, y: Y, z: 0, main: true },
         { x: 36, y: Y, z: 6, main: true },
         { x: 48, y: Y, z: 18, main: true },
         { x: 30, y: Y, z: 24, main: true },
         { x: 0, y: Y, z: 24, main: true },
         { x: 18, y: Y, z: 12, main: true },
         { x: 30, y: RY, z: 36, main: false },
         { x: 8, y: RY, z: 36, main: false },
      ],
      secrets: [
         { x: 1.2, y: RY, z: 36 },
         { x: 18, y: 1, z: 30 },
         { x: 6, y: 1, z: 30 },
      ],
      night: false,
      boss: false,
      ring: null,
      avenue: null,
      brushStops: [],
      valveStops: [],
   },
   // L3: colour gates at the crossings cycle like traffic lights (4 s green, 4 s red; the cross street
   // is green while yours is red), so your line has to meet green. Sludge and steam vents for Kiro.
   3: {
      id: 3,
      name: "Rush Hour",
      nx: 6,
      nz: 6,
      laps: 2,
      timerMs: 160_000,
      starTargetMs: 78_000,
      start: n(0, 0),
      blocks: [
         { at: [2, 2], kind: "plaza" },
         { at: [3, 0], kind: "lot" },
         { at: [0, 3], kind: "site" },
         { at: [3, 3], kind: "ghost" },
      ],
      beacons: [n(5, 1), n(4, 5), n(0, 4), blockCentre(2, 2)],
      buses: [{ loop: [[3, 4], [5, 4], [5, 5], [3, 5]], cycleMs: 9_000, phaseMs: 0 }],
      ramps: [{ x: 31.5, z: 60, dir: "+x" }],
      rail: { a: [0, 5], b: [5, 5] },
      gates: [
         { a: [1, 0], b: [2, 0], phase: 0 },
         { a: [5, 2], b: [5, 3], phase: 1 },
         { a: [2, 4], b: [2, 5], phase: 1 },
         { a: [1, 4], b: [2, 4], phase: 0 },
         { a: [2, 3], b: [3, 3], phase: 0 },
         { a: [2, 1], b: [3, 1], phase: 1 },
      ],
      sludge: [{ x: 60, z: 30, r: 2 }, { x: 18, z: 48, r: 2 }, { x: 36, z: 18, r: 1.8 }],
      vents: [{ x: 48, z: 12, r: 1.4 }, { x: 12, z: 42, r: 1.4 }, { x: 42, z: 48, r: 1.4 }],
      drains: [blockCentre(2, 2), { x: 42, z: 6 }, { x: 0, z: 30 }],
      orbs: [
         { x: 18, y: Y, z: 0, main: true },
         { x: 42, y: Y, z: 5, main: true },
         { x: 60, y: Y, z: 42, main: true },
         { x: 30, y: Y, z: 60, main: true },
         { x: 6, y: Y, z: 48, main: true },
         { x: 24, y: Y, z: 18, main: true },
         { x: 12, y: RY, z: 60, main: false },
         { x: 24, y: RY, z: 60, main: false },
      ],
      secrets: [
         { x: 1.2, y: RY, z: 60 },
         { x: 42, y: 1, z: 42 },
         { x: 6, y: 1, z: 42 },
      ],
      night: false,
      boss: false,
      ring: null,
      avenue: null,
      brushStops: [],
      valveStops: [],
   },
   // L4: night. Only the streetlamps and your red lanes are lit. Lap 1 scouts in the dark, laps 2 and
   // 3 run fast on the network you built. The four beacons sit on one ring: paint every street of it
   // and the perfect-loop sticker lights in the plaza.
   4: {
      id: 4,
      name: "Night Neon",
      nx: 6,
      nz: 6,
      laps: 3,
      timerMs: 200_000,
      starTargetMs: 96_000,
      start: n(1, 1),
      blocks: [
         { at: [2, 2], kind: "plaza" },
         { at: [4, 1], kind: "lot" },
         { at: [1, 3], kind: "site" },
         { at: [3, 3], kind: "ghost" },
      ],
      beacons: [n(4, 1), n(4, 4), n(1, 4), n(1, 1)],
      buses: [{ loop: [[1, 5], [4, 5]], cycleMs: 9_000, phaseMs: 2_000 }],
      ramps: [{ x: 6, z: 60, dir: "+x" }],
      rail: { a: [0, 5], b: [5, 5] },
      gates: [],
      sludge: [{ x: 48, z: 30, r: 2 }, { x: 30, z: 12, r: 1.8 }],
      vents: [{ x: 12, z: 30, r: 1.4 }, { x: 36, z: 48, r: 1.4 }],
      drains: [blockCentre(2, 2), { x: 54, z: 24 }],
      orbs: [
         { x: 30, y: Y, z: 0, main: true },
         { x: 60, y: Y, z: 30, main: true },
         { x: 30, y: Y, z: 48, main: true },
         { x: 0, y: Y, z: 36, main: true },
         { x: 24, y: Y, z: 30, main: true },
         { x: 54, y: Y, z: 18, main: true },
         { x: 18, y: RY, z: 60, main: false },
         { x: 42, y: RY, z: 60, main: false },
      ],
      secrets: [
         { x: 58.8, y: RY, z: 60 },
         { x: 42, y: 1, z: 42 },
         { ...blockCentre(2, 2), y: 1.4 },
      ],
      night: true,
      boss: false,
      ring: [[1, 1], [4, 1], [4, 4], [1, 4]],
      avenue: null,
      brushStops: [],
      valveStops: [],
   },
   // L5: Greyout, the Street Sweeper. The beacons keep lighting round the city and paint your lanes;
   // Greyout's brushes sweep them grey. P1: off a ramp onto its roof brushes (3). P2: ride the red
   // avenue and roll-ram its tank valves (2). P3: it hunts you through the plaza; lure it under a
   // colour gate as the gate shuts (2).
   5: {
      id: 5,
      name: "Greyout Avenue",
      nx: 6,
      nz: 6,
      laps: 1,
      timerMs: 200_000,
      starTargetMs: 92_000,
      start: n(1, 2),
      blocks: [
         { at: [2, 2], kind: "plaza" },
         { at: [0, 4], kind: "site" },
         { at: [4, 4], kind: "ghost" },
         { at: [4, 0], kind: "lot" },
      ],
      beacons: [n(3, 3), n(5, 1), n(1, 5), n(5, 5), n(0, 1), n(3, 0)],
      buses: [{ loop: [[1, 5]], cycleMs: 0, phaseMs: 0, parked: { dx: 4, dz: 0.9, yaw: Math.PI / 2 } }],
      ramps: [
         { x: 7, z: 12, dir: "+x" },
         { x: 53, z: 36, dir: "-x" },
         { x: 24, z: 53, dir: "-z" },
         { x: 10.4, z: 60.9, dir: "+x" },
      ],
      rail: { a: [0, 5], b: [5, 5] },
      gates: [
         { a: [2, 2], b: [2, 3], phase: 0 },
         { a: [3, 2], b: [3, 3], phase: 1 },
      ],
      sludge: [{ x: 60, z: 48, r: 1.8 }],
      vents: [{ x: 0, z: 42, r: 1.4 }, { x: 48, z: 6, r: 1.4 }],
      drains: [blockCentre(2, 2), { x: 54, z: 0 }],
      orbs: [
         { x: 36, y: Y, z: 24, main: true },
         { x: 60, y: Y, z: 18, main: true },
         { x: 6, y: Y, z: 60, main: true },
         { x: 0, y: Y, z: 6, main: true },
         { x: 42, y: Y, z: 60, main: true },
         { x: 18, y: RY, z: 60, main: false },
         { x: 30, y: RY, z: 60, main: false },
      ],
      secrets: [
         { x: 58.8, y: RY, z: 60 },
         { x: 54, y: 1, z: 54 },
         { x: 6, y: 1, z: 54 },
      ],
      night: true,
      boss: true,
      ring: null,
      avenue: [[0, 2], [5, 2]],
      // each faces its ramp: the brushes (its front) toward the ramp's lip
      brushStops: [
         { x: 13.3, z: 12, yaw: -Math.PI / 2, ramp: 0 },
         { x: 46.7, z: 36, yaw: Math.PI / 2, ramp: 1 },
         { x: 24, z: 46.7, yaw: 0, ramp: 2 },
      ],
      valveStops: [
         { x: 42, z: 24, yaw: Math.PI / 2 },
         { x: 18, z: 24, yaw: -Math.PI / 2 },
      ],
   },
};
