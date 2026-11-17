// Taxi Rush 3D level configs (docs/menu1-new/specs-31-40.md §32). One street grid;
// district dressing is in looks.ts; counts, traffic, patience, clock and lighting stay pure data.
import type { LevelId } from "@/arcade3d/types";
import { U } from "./rules";

export interface TaxiLevel {
   blocksX: number;
   blocksZ: number;
   rides: number;
   lights: number;
   traffic: number;
   /** m/s (the design speed times the world scale U) */
   trafficSpeed: number;
   patienceDrain: number;
   durationMs: number;
   lighting: "day" | "sunset" | "night";
   background: string;
}

export const LEVELS: Record<LevelId, TaxiLevel> = {
   1: { blocksX: 2, blocksZ: 2, rides: 3, lights: 2, traffic: 2, trafficSpeed: 3.5 * U, patienceDrain: 0.012, durationMs: 120_000, lighting: "day", background: "#bae6fd" },
   2: { blocksX: 2, blocksZ: 3, rides: 4, lights: 3, traffic: 3, trafficSpeed: 4.0 * U, patienceDrain: 0.014, durationMs: 150_000, lighting: "day", background: "#bdd6df" },
   3: { blocksX: 3, blocksZ: 3, rides: 5, lights: 4, traffic: 5, trafficSpeed: 4.5 * U, patienceDrain: 0.016, durationMs: 180_000, lighting: "sunset", background: "#fdba74" },
   4: { blocksX: 3, blocksZ: 3, rides: 6, lights: 5, traffic: 6, trafficSpeed: 5.0 * U, patienceDrain: 0.018, durationMs: 210_000, lighting: "night", background: "#0f172a" },
   5: { blocksX: 3, blocksZ: 4, rides: 8, lights: 6, traffic: 8, trafficSpeed: 5.5 * U, patienceDrain: 0.020, durationMs: 250_000, lighting: "sunset", background: "#d8aa8e" },
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
   2: "Office plazas and home deliveries. Watch the intersections.",
   3: "Market rows, five fares. Keep the shoppers patient.",
   4: "Neon squares. Follow the headlights and signals.",
   5: "Commuter shelters, eight fares, eight cars. Plan ahead.",
};
