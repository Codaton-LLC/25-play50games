// Alien Farm's five levels: pure data (no React, no three.js).
// Each level configures the clock, plot layout / cycle speeds, saucer speed schedule,
// lingering spore duration, and late-game harvest window widths.
// Level 1 is today's certified 100 s game (docs/arcade-levels.md §6.3, README "Levels").
import type { LevelId } from "@/arcade3d/types";
import type { CropKind } from "./rules";

export interface PlotConfig {
   readonly id: number;
   readonly x: number;
   readonly z: number;
   readonly activateAt: number;
   readonly cycleS: number;
   readonly kind: CropKind;
   readonly halfLate?: number;
}

export type FarmTheme = "starter" | "crystal" | "marsh" | "meteor" | "grand";

/** A slow patch of ground (marsh water): top speed x POOLS.slow inside, never blocks. */
export interface Pool {
   readonly x: number;
   readonly z: number;
   readonly r: number;
}

export interface AlienFarmLevel {
   /** Run length in ms: shell timer ends the score attack with "timeup" */
   readonly durationMs: number;
   /** The 9 bed configurations (cycleS, activateAt, kind, optional halfLate) */
   readonly plots: readonly PlotConfig[];
   /** Saucer speed schedule: m/s before 40 s, 40-70 s, after 70 s */
   readonly shipSpeeds: readonly [number, number, number];
   /** Spore hazard life in seconds */
   readonly sporesLifeS: number;
   /** Ripe half-window after 70 s */
   readonly cycleHalfLate: number;
   /** Basket capacity (fixed at 4) */
   readonly capacity: number;
   /** the level's look (looks.ts THEMES): sky, light, soil, beds and scenery */
   readonly theme: FarmTheme;
   /** marsh pools that slow the farmer (rules.ts POOLS); none on levels 1, 2 and 4 */
   readonly pools: readonly Pool[];
}

/**
 * Glow Marsh water: four pools in the lanes between the beds, each clear of every bed's reach
 * (centre to bed centre >= r + 0.9 + 0.5) and of the saucer's route. They only slow (x POOLS.slow),
 * so the limit proof (which relaxes every slowdown) holds unchanged.
 */
export const MARSH_POOLS: readonly Pool[] = [
   { x: -2.5, z: -2, r: 1.1 },
   { x: 2.5, z: -2, r: 1.1 },
   { x: -2.5, z: 2, r: 1.1 },
   { x: 2.5, z: 2, r: 1.1 },
];

export const BASE_PLOTS: readonly PlotConfig[] = [
   { id: 0, x: -5, z: -4, activateAt: 0, cycleS: 6, kind: "glowPod" },
   { id: 1, x: 0, z: -4, activateAt: 20, cycleS: 6, kind: "glowPod" },
   { id: 2, x: 5, z: -4, activateAt: 0, cycleS: 6, kind: "glowPod" },
   { id: 3, x: -5, z: 0, activateAt: 40, cycleS: 8, kind: "gourd" },
   { id: 4, x: 0, z: 0, activateAt: 0, cycleS: 6, kind: "glowPod" },
   { id: 5, x: 5, z: 0, activateAt: 40, cycleS: 8, kind: "gourd" },
   { id: 6, x: -5, z: 4, activateAt: 0, cycleS: 6, kind: "glowPod" },
   { id: 7, x: 0, z: 4, activateAt: 20, cycleS: 6, kind: "glowPod" },
   { id: 8, x: 5, z: 4, activateAt: 0, cycleS: 6, kind: "glowPod" },
];

export const DESCRIPTIONS: Record<LevelId, string> = {
   1: "Starter plot: 9 beds under the purple dusk, pulse harvesting and beam delivery across 100 s.",
   2: "Crystal farm: icy crystal planters in a frozen valley, all 9 beds live from the start, 150 s.",
   3: "Glow marsh: glowing reeds and slow marsh pools between the beds, 5 s pulses, 7 s spores, 180 s.",
   4: "Meteor field: craters and a falling meteor shower, a swift saucer and tighter late windows, 180 s.",
   5: "Grand harvest: the festival field with lanterns and marsh pools, 5 s pods, 7 s gourds, 210 s.",
};

export const LEVELS: Record<LevelId, AlienFarmLevel> = {
   1: {
      durationMs: 100_000,
      plots: BASE_PLOTS,
      shipSpeeds: [2, 2.5, 3],
      sporesLifeS: 5,
      cycleHalfLate: 0.6,
      capacity: 4,
      theme: "starter", pools: [],
   },
   2: {
      durationMs: 150_000,
      plots: BASE_PLOTS.map((p) => ({ ...p, activateAt: 0 })),
      shipSpeeds: [2, 2.5, 3],
      sporesLifeS: 5,
      cycleHalfLate: 0.6,
      capacity: 4,
      theme: "crystal", pools: [],
   },
   3: {
      durationMs: 180_000,
      plots: BASE_PLOTS.map((p) => ({ ...p, cycleS: p.kind === "glowPod" ? 5 : p.cycleS })),
      shipSpeeds: [2, 2.5, 3],
      sporesLifeS: 7,
      cycleHalfLate: 0.6,
      capacity: 4,
      theme: "marsh", pools: MARSH_POOLS,
   },
   4: {
      durationMs: 180_000,
      plots: BASE_PLOTS.map((p) => ({ ...p, activateAt: 0, halfLate: 0.5 })),
      shipSpeeds: [2.5, 3, 3.5],
      sporesLifeS: 7,
      cycleHalfLate: 0.5,
      capacity: 4,
      theme: "meteor", pools: [],
   },
   5: {
      durationMs: 210_000,
      plots: BASE_PLOTS.map((p) => ({ ...p, activateAt: 0, cycleS: p.kind === "glowPod" ? 5 : 7, halfLate: 0.5 })),
      shipSpeeds: [2.5, 3, 3.5],
      sporesLifeS: 7,
      cycleHalfLate: 0.5,
      capacity: 4,
      theme: "grand",
      pools: MARSH_POOLS,
   },
};
