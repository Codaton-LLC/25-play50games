// Taxi Rush 3D level configs (docs/menu1-new/specs-31-40.md §32). One street grid;
// only counts, traffic, patience, clock and lighting change. Plain data: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

export interface TaxiLevel {
   blocksX: number;
   blocksZ: number;
   rides: number;
   lights: number;
   traffic: number;
   trafficSpeed: number;
   patienceDrain: number;
   durationMs: number;
   lighting: "day" | "sunset" | "night";
   background: string;
}

export const LEVELS: Record<LevelId, TaxiLevel> = {
   1: { blocksX: 2, blocksZ: 2, rides: 3, lights: 2, traffic: 2, trafficSpeed: 3.5, patienceDrain: 0.012, durationMs: 120_000, lighting: "day", background: "#bae6fd" },
   2: { blocksX: 2, blocksZ: 3, rides: 4, lights: 3, traffic: 3, trafficSpeed: 4.0, patienceDrain: 0.014, durationMs: 150_000, lighting: "day", background: "#7dd3fc" },
   3: { blocksX: 3, blocksZ: 3, rides: 5, lights: 4, traffic: 5, trafficSpeed: 4.5, patienceDrain: 0.016, durationMs: 180_000, lighting: "sunset", background: "#fdba74" },
   4: { blocksX: 3, blocksZ: 3, rides: 6, lights: 5, traffic: 6, trafficSpeed: 5.0, patienceDrain: 0.018, durationMs: 180_000, lighting: "night", background: "#0f172a" },
   5: { blocksX: 3, blocksZ: 4, rides: 8, lights: 6, traffic: 8, trafficSpeed: 5.5, patienceDrain: 0.020, durationMs: 210_000, lighting: "sunset", background: "#7c2d12" },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Quiet Neighborhood",
   2: "Downtown",
   3: "Shopping District",
   4: "Night City",
   5: "Rush Hour",
};

/** Start-card line under the level tile. */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Three fares, two lights.",
   2: "Longer blocks, tighter patience.",
   3: "Five fares and a busier street.",
   4: "Lights matter.",
   5: "Eight fares, eight cars.",
};
