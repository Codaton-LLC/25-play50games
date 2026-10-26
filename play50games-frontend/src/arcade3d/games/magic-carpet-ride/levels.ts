// Magic Carpet Ride level configs. One route; length, speed, quotas and light change.
// Plain data: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

export interface CarpetLevel {
   length: number;
   speed: number;
   rings: number;
   ringQuota: number;
   stars: number;
   starQuota: number;
   rocks: number;
   movers: number;
   durationMs: number;
   lighting: "day" | "sunset" | "night";
   background: string;
   fogFar: number;
}

export const LEVELS: Record<LevelId, CarpetLevel> = {
   1: { length: 420, speed: 9, rings: 8, ringQuota: 6, stars: 8, starQuota: 5, rocks: 3, movers: 0, durationMs: 120_000, lighting: "day", background: "#fde68a", fogFar: 120 },
   2: { length: 600, speed: 10, rings: 12, ringQuota: 9, stars: 12, starQuota: 8, rocks: 6, movers: 0, durationMs: 150_000, lighting: "sunset", background: "#fb923c", fogFar: 110 },
   3: { length: 780, speed: 10.5, rings: 16, ringQuota: 12, stars: 15, starQuota: 10, rocks: 8, movers: 4, durationMs: 180_000, lighting: "day", background: "#e0f2fe", fogFar: 70 },
   4: { length: 880, speed: 11, rings: 20, ringQuota: 15, stars: 18, starQuota: 12, rocks: 10, movers: 6, durationMs: 180_000, lighting: "night", background: "#1e1b4b", fogFar: 80 },
   5: { length: 1100, speed: 11.5, rings: 25, ringQuota: 19, stars: 22, starQuota: 15, rocks: 14, movers: 8, durationMs: 240_000, lighting: "sunset", background: "#7c2d12", fogFar: 100 },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Desert Village",
   2: "Canyon",
   3: "Cloud Kingdom",
   4: "Night City",
   5: "Floating Palace",
};

/** Start-card line under the level tile. */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Eight rings over the rooftops.",
   2: "Tighter turns between the walls.",
   3: "Rocks drift up and down.",
   4: "Lanterns light the way.",
   5: "Twenty-five rings to the palace.",
};

export type CarpetTheme = "town" | "canyon" | "cloud" | "night" | "palace";

/** Which dressing and which obstacle mesh this level draws. */
export function themeOf(level: CarpetLevel): CarpetTheme {
   if (level.background === "#e0f2fe") return "cloud";
   if (level.background === "#1e1b4b") return "night";
   if (level.background === "#7c2d12") return "palace";
   if (level.background === "#fb923c") return "canyon";
   return "town";
}
