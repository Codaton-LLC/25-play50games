// Dino Egg Rescue's five levels: pure data, no React (docs/arcade-levels.md §6.3).
// Five valleys (maps.ts), each with its own nest, gullies, mud, solids and twist, plus the
// pressure knobs. Level 1 is today's 90 s game and must never change. Levels 2-5 add the plan's
// pressure (docs/levels-backlog.md): earlier lanes, a faster boulder cadence, faster rocks,
// earlier golden eggs, then a bigger supply and a fourth carried egg. Each level has its own
// lighting (index.tsx). Runs end only on timeup; an egg-counted win and nest matching are not built.
import type { LevelId } from "@/arcade3d/types";
import { MAP_1, MAP_2, MAP_3, MAP_4, MAP_5, type ValleyMap } from "./maps";

export type { MudSpot } from "./maps";

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
   /** how many mud pits the level's map has (map.mud.length; level 1: today's 3) */
   mudPatches: number;
   /** the level's valley (maps.ts): nest, gullies, mud, solids, water, vents */
   map: ValleyMap;
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
      map: MAP_1,
      goldenSpawnTimes: [25, 50, 75],
      initialSupply: 4,
      maxGroundEggs: 4,
      totalSpawnTicks: 29,
      maxStack: 3,
      stackMultipliers: MULT_L1,
      deliveryPoints: POINTS_L1,
   },
   // Fern Forest: logs and trunks; lanes 2 and 4 open sooner, the cadence reaches 1.2 s at 60 s, 120 s clock
   2: {
      durationMs: 120_000,
      unlocks: [0, 15, 30, 45],
      speeds: SPEEDS_L1,
      spawnRampS: 60,
      mudPatches: 3,
      map: MAP_2,
      goldenSpawnTimes: [25, 50, 75],
      initialSupply: 4,
      maxGroundEggs: 4,
      totalSpawnTicks: 29,
      maxStack: 3,
      stackMultipliers: MULT_L1,
      deliveryPoints: POINTS_L1,
   },
   // Riverbank: the river (slow, drifting) and its bridges, five mud pits, +0.5 m/s on every lane
   3: {
      durationMs: 120_000,
      unlocks: [0, 15, 30, 45],
      speeds: SPEEDS_FAST,
      spawnRampS: 60,
      mudPatches: 5,
      map: MAP_3,
      goldenSpawnTimes: [25, 50, 75],
      initialSupply: 4,
      maxGroundEggs: 4,
      totalSpawnTicks: 29,
      maxStack: 3,
      stackMultipliers: MULT_L1,
      deliveryPoints: POINTS_L1,
   },
   // Volcanic Pass: four lava vents; three lanes from the start, lane 4 at 15 s, golden eggs at 20 / 40 / 60
   4: {
      durationMs: 120_000,
      unlocks: [0, 0, 0, 15],
      speeds: SPEEDS_FAST,
      spawnRampS: 60,
      mudPatches: 3,
      map: MAP_4,
      goldenSpawnTimes: [20, 40, 60],
      initialSupply: 4,
      maxGroundEggs: 4,
      totalSpawnTicks: 29,
      maxStack: 3,
      stackMultipliers: MULT_L1,
      deliveryPoints: POINTS_L1,
   },
   // Dino Sanctuary: the fenced pen and gate, a pond, two geysers, logs; 6 eggs at the start, 35 spawn ticks, a fourth carried egg (slower, still 150 pts each)
   5: {
      durationMs: 120_000,
      unlocks: [0, 0, 0, 15],
      speeds: SPEEDS_FAST,
      spawnRampS: 60,
      mudPatches: 4,
      map: MAP_5,
      goldenSpawnTimes: [20, 40, 60],
      initialSupply: 6,
      maxGroundEggs: 6,
      totalSpawnTicks: 35,
      maxStack: 4,
      stackMultipliers: [1.0, 0.85, 0.72, 0.60, 0.50],
      deliveryPoints: [0, 100, 240, 450, 600],
   },
};
