// Dino Egg Rescue's five levels: pure data, no React (docs/arcade-levels.md §6.3).
// One valley, five hazard/supply configurations. Level 1 is today's 90 s game and must
// never change. Levels 2-5 keep every earlier hazard and add the plan's pressure
// (docs/levels-backlog.md): earlier lanes, a faster boulder cadence, more mud, faster
// rocks, earlier golden eggs, then a bigger supply and a fourth carried egg.
// Nest matching, an egg-counted win and per-level lighting have no support: one nest,
// runs end only on timeup, and the sunset in index.tsx stays for every level.
import type { LevelId } from "@/arcade3d/types";

export interface MudSpot {
   id: number;
   x: number;
   z: number;
}

/**
 * Two more pits for levels 3-5, beside today's three (rules.ts MUD). Both sit off every
 * boulder band by >= 2 m (edge clearance) and clear of the nest, the trunks and the
 * other pits. M4 is the north-west bank; M5 sits between the two south-east pits.
 */
export const EXTRA_MUD: readonly MudSpot[] = [
   { id: 4, x: -9.5, z: -10.5 },
   { id: 5, x: 10.25, z: 4 },
];

export interface DinoLevel {
   durationMs: number;
   /** seconds each of the four lanes starts rolling; level 1 is [0, 0, 30, 60] */
   unlocks: readonly [number, number, number, number];
   /** m/s of each lane; level 1 is [3.6, 4.2, 4.8, 5.2] */
   speeds: readonly [number, number, number, number];
   /**
    * The boulder gap lerps from 3.0 s to 1.2 s across this many seconds, then stays at
    * 1.2 s. Level 1 is 90, so the lerp is today's formula. A shorter ramp is faster.
    */
   spawnRampS: number;
   /** how many mud pits are live: 3 = today's MUD.patches, 5 = those plus EXTRA_MUD */
   mudPatches: 3 | 5;
   goldenSpawnTimes: readonly number[];
   initialSupply: number;
   /** a spawn tick is skipped while this many regular eggs lie on the ground (level 1: 4, rules EGGS.maxGroundEggs) */
   maxGroundEggs: number;
   totalSpawnTicks: number;
   maxStack: number;
   /** speed factor for 0..maxStack carried eggs */
   stackMultipliers: readonly number[];
   /** points for delivering 0..maxStack regular eggs at once */
   deliveryPoints: readonly number[];
}

const POINTS_L1 = [0, 100, 240, 450] as const;
const MULT_L1 = [1.0, 0.85, 0.72, 0.60] as const;
const SPEEDS_L1 = [3.6, 4.2, 4.8, 5.2] as const;
const SPEEDS_FAST = [4.1, 4.7, 5.3, 5.7] as const;

export const LEVELS: Record<LevelId, DinoLevel> = {
   // today's game, unchanged
   1: {
      durationMs: 90_000,
      unlocks: [0, 0, 30, 60],
      speeds: SPEEDS_L1,
      spawnRampS: 90,
      mudPatches: 3,
      goldenSpawnTimes: [25, 50, 75],
      initialSupply: 4,
      maxGroundEggs: 4,
      totalSpawnTicks: 29,
      maxStack: 3,
      stackMultipliers: MULT_L1,
      deliveryPoints: POINTS_L1,
   },
   // Fern Forest: lane 4 (and lane 3's neighbour) open sooner, the cadence reaches 1.2 s at 60 s, 120 s clock
   2: {
      durationMs: 120_000,
      unlocks: [0, 15, 30, 45],
      speeds: SPEEDS_L1,
      spawnRampS: 60,
      mudPatches: 3,
      goldenSpawnTimes: [25, 50, 75],
      initialSupply: 4,
      maxGroundEggs: 4,
      totalSpawnTicks: 29,
      maxStack: 3,
      stackMultipliers: MULT_L1,
      deliveryPoints: POINTS_L1,
   },
   // Riverbank: two more mud pits and +0.5 m/s on every lane, on top of level 2
   3: {
      durationMs: 120_000,
      unlocks: [0, 15, 30, 45],
      speeds: SPEEDS_FAST,
      spawnRampS: 60,
      mudPatches: 5,
      goldenSpawnTimes: [25, 50, 75],
      initialSupply: 4,
      maxGroundEggs: 4,
      totalSpawnTicks: 29,
      maxStack: 3,
      stackMultipliers: MULT_L1,
      deliveryPoints: POINTS_L1,
   },
   // Volcanic Pass: three lanes from the start, lane 4 at 15 s, golden eggs at 20 / 40 / 60
   4: {
      durationMs: 120_000,
      unlocks: [0, 0, 0, 15],
      speeds: SPEEDS_FAST,
      spawnRampS: 60,
      mudPatches: 5,
      goldenSpawnTimes: [20, 40, 60],
      initialSupply: 4,
      maxGroundEggs: 4,
      totalSpawnTicks: 29,
      maxStack: 3,
      stackMultipliers: MULT_L1,
      deliveryPoints: POINTS_L1,
   },
   // Dino Sanctuary: 6 eggs at the start, 35 spawn ticks, a fourth carried egg (slower, still 150 pts each)
   5: {
      durationMs: 120_000,
      unlocks: [0, 0, 0, 15],
      speeds: SPEEDS_FAST,
      spawnRampS: 60,
      mudPatches: 5,
      goldenSpawnTimes: [20, 40, 60],
      initialSupply: 6,
      maxGroundEggs: 6,
      totalSpawnTicks: 35,
      maxStack: 4,
      stackMultipliers: [1.0, 0.85, 0.72, 0.60, 0.50],
      deliveryPoints: [0, 100, 240, 450, 600],
   },
};
