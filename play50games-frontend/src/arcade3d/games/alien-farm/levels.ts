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
}

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
   1: "Starter plot: 9 beds, pulse harvesting and beam delivery across 100 s.",
   2: "Crystal farm: all 9 beds live from the start, slower saucer haul, 150 s.",
   3: "Glow marsh: 5 s rapid pulse cycles, 7 s lingering spores, 180 s.",
   4: "Meteor field: all beds live, swift saucer and tighter late harvest windows, 180 s.",
   5: "Grand harvest: all beds open, 5 s pods, 7 s gourds, persistent spores, 210 s.",
};

export const LEVELS: Record<LevelId, AlienFarmLevel> = {
   1: {
      durationMs: 100_000,
      plots: BASE_PLOTS,
      shipSpeeds: [2, 2.5, 3],
      sporesLifeS: 5,
      cycleHalfLate: 0.6,
      capacity: 4,
   },
   2: {
      durationMs: 150_000,
      plots: BASE_PLOTS.map((p) => ({ ...p, activateAt: 0 })),
      shipSpeeds: [1.7, 2.1, 2.5],
      sporesLifeS: 5,
      cycleHalfLate: 0.6,
      capacity: 4,
   },
   3: {
      durationMs: 180_000,
      plots: BASE_PLOTS.map((p) => ({ ...p, cycleS: p.kind === "glowPod" ? 5 : p.cycleS })),
      shipSpeeds: [2, 2.5, 3],
      sporesLifeS: 7,
      cycleHalfLate: 0.6,
      capacity: 4,
   },
   4: {
      durationMs: 180_000,
      plots: BASE_PLOTS.map((p) => ({ ...p, activateAt: 0, halfLate: 0.5 })),
      shipSpeeds: [2.5, 3, 3.5],
      sporesLifeS: 5,
      cycleHalfLate: 0.5,
      capacity: 4,
   },
   5: {
      durationMs: 210_000,
      plots: BASE_PLOTS.map((p) => ({ ...p, activateAt: 0, cycleS: p.kind === "glowPod" ? 5 : 7, halfLate: 0.5 })),
      shipSpeeds: [2.5, 3, 3.5],
      sporesLifeS: 7,
      cycleHalfLate: 0.5,
      capacity: 4,
   },
};
