// Color City Sprint's five levels (the design card). Plain data: city.ts turns it into the street
// graph the rules run on. One base city (a block grid) and five configurations.
import type { LevelId } from "../../types";

/** The design card's signature. layouts.test.ts pins it. */
export const SIGNATURE = "route-making laps";

export interface OrbSpec {
   x: number;
   y: number;
   z: number;
   /** counts toward the "all orbs" star; bonus orbs only cut the time */
   main: boolean;
}

export interface SecretSpot {
   x: number;
   y: number;
   z: number;
}

export interface CitySpec {
   id: LevelId;
   name: string;
   /** intersections on x and z (a 3×3 sub-grid is 3 by 3) */
   nx: number;
   nz: number;
   laps: number;
   timerMs: number;
   starTargetMs: number;
   /** where the hero starts (an intersection) */
   start: number;
   /** beacon order; one of them may ride the bus (`busBeacon`) */
   beacons: number[];
   /** index into `beacons` that sits on the bus, or -1 */
   busBeacon: number;
   /** a diagonal alley, shorter than the avenue, with cones */
   alley: [number, number] | null;
   /** a hoarding across this diagonal; Riko's dash opens it */
   cut: [number, number] | null;
   /** a shop block (ix, iz) Vexa phases through */
   ghost: [number, number] | null;
   /** cones along the alley, offset off the centre line */
   alleyCones: number;
   sludge: { x: number; z: number; r: number }[];
   /** gates on the street between these two intersections */
   gates: [number, number][];
   /** a ramp whose lip is this intersection, rising along (dx, dz) */
   ramp: { node: number; dx: number; dz: number } | null;
   /** the bus loop (intersections); null = no bus */
   busNodes: number[] | null;
   busCycleMs: number;
   orbs: OrbSpec[];
   secrets: SecretSpot[];
   night: boolean;
   boss: boolean;
   /** the perimeter is a perfect-loop ring (level 4) */
   ring: boolean;
   /** streets that start already red (the boss avenue) */
   prePaint: [number, number][];
}

const Y = 0.55;

export const LEVELS: Record<LevelId, CitySpec> = {
   1: {
      id: 1,
      name: "Red Block",
      nx: 3,
      nz: 3,
      laps: 2,
      timerMs: 90_000,
      starTargetMs: 62_000,
      start: 0,
      // straight east, then the alley-or-avenue choice to the north-west, the north-east, the plaza
      beacons: [2, 6, 8, 0],
      busBeacon: -1,
      alley: [2, 6],
      cut: [5, 7],
      ghost: [0, 0],
      alleyCones: 3,
      sludge: [],
      gates: [],
      ramp: null,
      busNodes: null,
      busCycleMs: 9_000,
      orbs: [
         { x: 18, y: Y, z: 0, main: true },
         { x: 15.6, y: Y, z: 8.4, main: true },
         { x: 6, y: Y, z: 24, main: true },
         { x: 0, y: Y, z: 6, main: true },
         { x: 24, y: Y, z: 6, main: true },
         { x: 1.6, y: Y, z: 1.6, main: true },
         { x: 12, y: 5.55, z: 24, main: false },
         { x: 18, y: 5.55, z: 24, main: false },
         { x: 8.2, y: 0.45, z: 3.7, main: false },
      ],
      secrets: [
         { x: 20, y: 5.6, z: 24 },
         { x: 6, y: 0.6, z: 6 },
         { x: 18, y: 0.6, z: 18 },
      ],
      night: false,
      boss: false,
      ring: false,
      prePaint: [],
   },
   2: {
      id: 2,
      name: "Bus Line",
      nx: 4,
      nz: 3,
      laps: 2,
      timerMs: 120_000,
      starTargetMs: 54_000,
      start: 0,
      beacons: [3, 2, 8, 0],
      busBeacon: 1,
      alley: null,
      cut: [5, 6],
      ghost: [0, 0],
      alleyCones: 0,
      sludge: [],
      gates: [],
      ramp: { node: 2, dx: 1, dz: 0 },
      busNodes: [2, 6, 7, 3],
      busCycleMs: 9_000,
      orbs: [
         { x: 18, y: Y, z: 0, main: true },
         { x: 36, y: Y, z: 6, main: true },
         { x: 18, y: Y, z: 12, main: true },
         { x: 6, y: Y, z: 24, main: true },
         { x: 0, y: Y, z: 12, main: true },
         { x: 30, y: 5.55, z: 24, main: false },
         { x: 9, y: 0.45, z: 3.8, main: false },
      ],
      secrets: [
         { x: 24, y: 5.6, z: 24 },
         { x: 6, y: 0.6, z: 6 },
         { x: 18, y: 0.6, z: 18 },
      ],
      night: false,
      boss: false,
      ring: false,
      prePaint: [],
   },
   3: {
      id: 3,
      name: "Rush Hour",
      nx: 4,
      nz: 4,
      laps: 2,
      timerMs: 140_000,
      starTargetMs: 78_000,
      start: 0,
      beacons: [3, 15, 12, 0],
      busBeacon: -1,
      alley: null,
      cut: [6, 9],
      ghost: [1, 1],
      alleyCones: 0,
      sludge: [{ x: 12, z: 18, r: 2.1 }],
      gates: [
         [3, 7],
         [15, 14],
      ],
      ramp: null,
      busNodes: null,
      busCycleMs: 9_000,
      orbs: [
         { x: 18, y: Y, z: 0, main: true },
         { x: 36, y: Y, z: 18, main: true },
         { x: 18, y: Y, z: 36, main: true },
         { x: 0, y: Y, z: 18, main: true },
         { x: 12, y: Y, z: 12, main: true },
         { x: 24, y: 5.55, z: 36, main: false },
         { x: 20, y: 0.45, z: 16.2, main: false },
      ],
      secrets: [
         { x: 30, y: 5.6, z: 36 },
         { x: 18, y: 0.6, z: 18 },
         { x: 15, y: 0.6, z: 21 },
      ],
      night: false,
      boss: false,
      ring: false,
      prePaint: [],
   },
   4: {
      id: 4,
      name: "Night Neon",
      nx: 4,
      nz: 4,
      laps: 3,
      timerMs: 180_000,
      starTargetMs: 100_000,
      start: 0,
      beacons: [3, 15, 12, 0],
      busBeacon: -1,
      alley: null,
      cut: [5, 10],
      ghost: [0, 1],
      alleyCones: 0,
      sludge: [{ x: 24, z: 12, r: 1.8 }],
      gates: [],
      ramp: null,
      busNodes: null,
      busCycleMs: 9_000,
      orbs: [
         { x: 18, y: Y, z: 0, main: true },
         { x: 36, y: Y, z: 12, main: true },
         { x: 36, y: Y, z: 30, main: true },
         { x: 18, y: Y, z: 36, main: true },
         { x: 0, y: Y, z: 24, main: true },
         { x: 0, y: Y, z: 6, main: true },
         { x: 12, y: 5.55, z: 36, main: false },
         { x: 8.4, y: 0.45, z: 16.4, main: false },
      ],
      secrets: [
         { x: 28, y: 5.6, z: 36 },
         { x: 6, y: 0.6, z: 18 },
         { x: 2, y: 0.6, z: 2 },
      ],
      night: true,
      boss: false,
      ring: true,
      prePaint: [],
   },
   5: {
      id: 5,
      name: "Greyout Avenue",
      nx: 4,
      nz: 4,
      laps: 1,
      timerMs: 160_000,
      starTargetMs: 22_000,
      start: 5,
      beacons: [6, 9],
      busBeacon: -1,
      alley: null,
      cut: [1, 6],
      ghost: [2, 1],
      alleyCones: 0,
      sludge: [{ x: 30, z: 12, r: 1.7 }],
      gates: [[5, 9]],
      ramp: { node: 6, dx: 1, dz: 0 },
      busNodes: [6, 10, 9, 5],
      busCycleMs: 9_000,
      orbs: [
         { x: 18, y: Y, z: 12, main: true },
         { x: 24, y: Y, z: 18, main: true },
         { x: 12, y: Y, z: 24, main: true },
         { x: 30, y: Y, z: 24, main: true },
         { x: 36, y: 5.55, z: 36, main: false },
         { x: 28, y: 0.45, z: 16.4, main: false },
      ],
      secrets: [
         { x: 36, y: 5.6, z: 36 },
         { x: 30, y: 0.6, z: 18 },
         { x: 18, y: 0.6, z: 6 },
      ],
      night: true,
      boss: true,
      ring: false,
      prePaint: [
         [5, 6],
         [6, 10],
         [5, 9],
         [9, 10],
      ],
   },
};
