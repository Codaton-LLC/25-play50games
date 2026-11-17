// Farm Tractor Challenge level configs. One yard rules; each level has its own theme (looks.ts)
// plus trips, cargo, mud, trees, clock and light. Plain data: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

/** Visual identity: palette, fog, apron scenery and set pieces (looks.ts). */
export type FarmTheme = "yard" | "wheat" | "orchard" | "mud" | "mega";

export interface FarmLevel {
   width: number;
   depth: number;
   trips: number;
   balesPerTrip: number;
   mud: number;
   trees: number;
   cargo: "hay" | "crate";
   durationMs: number;
   lives: number;
   lighting: "day" | "sunset";
   background: string;
   theme: FarmTheme;
}

export const LEVELS: Record<LevelId, FarmLevel> = {
   1: { width: 28, depth: 22, trips: 2, balesPerTrip: 1, mud: 0, trees: 0, cargo: "hay", durationMs: 120_000, lives: 6, lighting: "day", background: "#bae6fd", theme: "yard" },
   2: { width: 34, depth: 26, trips: 3, balesPerTrip: 2, mud: 0, trees: 0, cargo: "hay", durationMs: 150_000, lives: 6, lighting: "day", background: "#86efac", theme: "wheat" },
   3: { width: 36, depth: 28, trips: 4, balesPerTrip: 2, mud: 0, trees: 6, cargo: "crate", durationMs: 180_000, lives: 5, lighting: "sunset", background: "#fdba74", theme: "orchard" },
   4: { width: 40, depth: 30, trips: 5, balesPerTrip: 2, mud: 3, trees: 0, cargo: "hay", durationMs: 180_000, lives: 4, lighting: "day", background: "#a8a29e", theme: "mud" },
   5: { width: 44, depth: 32, trips: 6, balesPerTrip: 2, mud: 4, trees: 8, cargo: "hay", durationMs: 210_000, lives: 4, lighting: "sunset", background: "#b45309", theme: "mega" },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Farm Yard",
   2: "Wheat Field",
   3: "Orchard",
   4: "Mud Farm",
   5: "Mega Farm",
};

/** Start-card line under the level tile. */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Two bales, a wide yard.",
   2: "Wheat rows outside; two bales on the trailer.",
   3: "Orchard crates; the trees are solid.",
   4: "Mud pits cut speed; fewer bumps allowed.",
   5: "Mega yard: six trips, mud and trees.",
};
