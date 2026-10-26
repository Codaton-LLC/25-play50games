// Beach Lifeguard level configs (spec §34).
// 1 base environment + 5 level configurations. Plain data: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

export interface BeachLevel {
   width: number;
   water: number;
   rescues: number;
   alertS: number;
   jetSki: boolean;
   durationMs: number;
   lighting: "day" | "sunset";
   background: string;
   fogFar: number;
}

export const LEVELS: Record<LevelId, BeachLevel> = {
   1: { width: 24, water: 12, rescues: 2, alertS: 40, jetSki: false, durationMs: 120_000, lighting: "day", background: "#7dd3fc", fogFar: 80 },
   2: { width: 32, water: 16, rescues: 3, alertS: 34, jetSki: false, durationMs: 150_000, lighting: "day", background: "#38bdf8", fogFar: 80 },
   3: { width: 40, water: 18, rescues: 4, alertS: 30, jetSki: false, durationMs: 180_000, lighting: "day", background: "#0ea5e9", fogFar: 70 },
   4: { width: 44, water: 20, rescues: 5, alertS: 28, jetSki: true, durationMs: 180_000, lighting: "sunset", background: "#fb923c", fogFar: 55 },
   5: { width: 48, water: 22, rescues: 6, alertS: 24, jetSki: true, durationMs: 210_000, lighting: "sunset", background: "#44403c", fogFar: 42 },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Small Beach",
   2: "Busy Beach",
   3: "Resort",
   4: "Waterpark",
   5: "Stormy Beach",
};

/** Start-card line under the level tile. */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Two swimmers, a short swim.",
   2: "Farther out.",
   3: "Four alerts, more chairs to run around.",
   4: "The jet ski is in the water.",
   5: "Six alerts, short clocks, low fog.",
};
