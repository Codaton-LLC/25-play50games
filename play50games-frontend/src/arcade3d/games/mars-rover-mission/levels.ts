// Mars Rover Mission level configs (docs/menu1-new/specs-41-50.md §43).
// Plain data only: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

export interface MarsLevel {
   width: number;
   depth: number;
   sites: number;
   chargers: number;
   rocks: number;
   boulders: number;
   boulderSpeed: number;
   drainScale: number;
   durationMs: number;
   lighting: "day" | "sunset" | "space";
   background: string;
   fogFar: number;
}

export const LEVELS: Record<LevelId, MarsLevel> = {
   1: { width: 40, depth: 32, sites: 3, chargers: 1, rocks: 6, boulders: 0, boulderSpeed: 0, drainScale: 0.8, durationMs: 120_000, lighting: "day", background: "#fdba74", fogFar: 80 },
   2: { width: 46, depth: 36, sites: 4, chargers: 1, rocks: 12, boulders: 0, boulderSpeed: 0, drainScale: 0.9, durationMs: 150_000, lighting: "day", background: "#fb923c", fogFar: 80 },
   3: { width: 50, depth: 40, sites: 5, chargers: 2, rocks: 12, boulders: 2, boulderSpeed: 3.5, drainScale: 1.0, durationMs: 180_000, lighting: "sunset", background: "#c2410c", fogFar: 60 },
   4: { width: 50, depth: 40, sites: 6, chargers: 2, rocks: 14, boulders: 3, boulderSpeed: 4.0, drainScale: 1.15, durationMs: 180_000, lighting: "sunset", background: "#9a3412", fogFar: 28 },
   5: { width: 56, depth: 44, sites: 7, chargers: 2, rocks: 16, boulders: 4, boulderSpeed: 4.5, drainScale: 1.1, durationMs: 240_000, lighting: "space", background: "#0c0a09", fogFar: 90 },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Landing Zone",
   2: "Rocky Plains",
   3: "Mars Canyon",
   4: "Crater",
   5: "Ancient Mars Site",
};

/** Start-card line under the level tile. */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Three sites near the capsule.",
   2: "Rocks everywhere: slow down.",
   3: "Boulders roll down the canyon.",
   4: "Dust storm: follow the beacons.",
   5: "Seven sites under the stars.",
};
