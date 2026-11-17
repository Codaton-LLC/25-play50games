// Magic Carpet Ride level configs: one flight (a winding sky lane), five biomes. Plain data: no
// three.js, no React. The route's length and speed, the rings and their quota, the coin arcs, gems,
// boosts, the flying obstacles and their kinds, the clock and the light change per level.
import type { LevelId } from "@/arcade3d/types";

/** The world the lane flies through (decor, ground, which flyers live there). */
export type Biome = "desert" | "canyon" | "clouds" | "night" | "palace";

/** A flying obstacle (rules.ts OBSTACLE_SPEC gives its size and motion). */
export type ObstacleKind = "gull" | "balloon" | "rock" | "hotAir" | "bat" | "lantern" | "hawk" | "blimp";

export interface CarpetLevel {
   biome: Biome;
   /** route length, m */
   length: number;
   /** forward speed, m/s (a boost multiplies it) */
   speed: number;
   rings: number;
   /** rings needed at the finish to clear the level */
   ringQuota: number;
   /** coins in each arc between two rings */
   coinsPerArc: number;
   gems: number;
   boosts: number;
   obstacles: number;
   kinds: readonly ObstacleKind[];
   durationMs: number;
   lighting: "day" | "sunset" | "night";
   background: string;
   fogFar: number;
}

export const LEVELS: Record<LevelId, CarpetLevel> = {
   1: { biome: "desert", length: 540, speed: 13, rings: 10, ringQuota: 7, coinsPerArc: 5, gems: 4, boosts: 2, obstacles: 4, kinds: ["gull", "balloon"], durationMs: 75_000, lighting: "day", background: "#fcd9a0", fogFar: 150 },
   2: { biome: "canyon", length: 680, speed: 14, rings: 13, ringQuota: 9, coinsPerArc: 5, gems: 5, boosts: 3, obstacles: 7, kinds: ["gull", "rock"], durationMs: 85_000, lighting: "sunset", background: "#f59e5b", fogFar: 140 },
   3: { biome: "clouds", length: 820, speed: 15, rings: 16, ringQuota: 12, coinsPerArc: 6, gems: 6, boosts: 3, obstacles: 9, kinds: ["balloon", "hotAir", "gull"], durationMs: 95_000, lighting: "day", background: "#bfe3fb", fogFar: 150 },
   4: { biome: "night", length: 900, speed: 15.5, rings: 18, ringQuota: 13, coinsPerArc: 6, gems: 7, boosts: 4, obstacles: 11, kinds: ["bat", "lantern"], durationMs: 100_000, lighting: "night", background: "#1e1b4b", fogFar: 120 },
   5: { biome: "palace", length: 1080, speed: 16, rings: 22, ringQuota: 16, coinsPerArc: 6, gems: 8, boosts: 4, obstacles: 14, kinds: ["hawk", "rock", "blimp"], durationMs: 115_000, lighting: "sunset", background: "#c2603a", fogFar: 140 },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Desert Dawn",
   2: "Red Canyon",
   3: "Cloud Kingdom",
   4: "Lantern Night",
   5: "Sky Palace",
};

/** Start-card line under the level tile. */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Over the rooftops: 7 of 10 rings, gulls and balloons.",
   2: "Down the canyon: drifting rocks between the walls.",
   3: "Above the clouds: hot-air balloons and sky islands.",
   4: "Through the lanterns: bats in the dark.",
   5: "To the floating palace: hawks, rocks and a blimp.",
};
