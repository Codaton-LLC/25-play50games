// Aquarium Cleaner level configs (docs/menu1-new/specs-41-50.md §49). Each level is its own map:
// the size, the task counts, the air drain, the sharks, the current, the clock, the light and the
// layout flavour (where the castle sits, how the rocks spread) change per level name.
// Plain data: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

/** The map flavour: drives prop placement in rules.ts and the look in looks.ts. "small" is level 1. */
export type AquariumLayout = "small" | "garden" | "tunnel" | "expanse" | "abyss";

export interface AquariumLevel {
   width: number;
   depth: number;
   algae: number;
   /** of the algae patches, how many sit at 2 m and need a float */
   highAlgae: number;
   trash: number;
   filters: number;
   /** air per second while idle or walking (x1.5 while working) */
   airDrain: number;
   sharks: number;
   sharkSpeed: number;
   /** a constant (0.5, 0) m/s² current in world x */
   current: boolean;
   durationMs: number;
   lighting: "day" | "indoor" | "night";
   background: string;
   /** the level's map flavour: castle/rock placement and the decor set pieces */
   layout: AquariumLayout;
}

export const LEVELS: Record<LevelId, AquariumLevel> = {
   1: { width: 16, depth: 12, algae: 1, highAlgae: 0, trash: 1, filters: 1, airDrain: 1.2, sharks: 0, sharkSpeed: 0, current: false, durationMs: 120_000, lighting: "day", background: "#5eead4", layout: "small" },
   2: { width: 20, depth: 14, algae: 2, highAlgae: 1, trash: 1, filters: 1, airDrain: 1.3, sharks: 0, sharkSpeed: 0, current: false, durationMs: 150_000, lighting: "day", background: "#2dd4bf", layout: "garden" },
   3: { width: 24, depth: 14, algae: 2, highAlgae: 1, trash: 2, filters: 1, airDrain: 1.4, sharks: 1, sharkSpeed: 1.6, current: false, durationMs: 180_000, lighting: "indoor", background: "#115e59", layout: "tunnel" },
   4: { width: 26, depth: 18, algae: 2, highAlgae: 1, trash: 2, filters: 2, airDrain: 1.5, sharks: 1, sharkSpeed: 1.9, current: false, durationMs: 180_000, lighting: "day", background: "#0d9488", layout: "expanse" },
   5: { width: 30, depth: 20, algae: 3, highAlgae: 2, trash: 3, filters: 2, airDrain: 1.5, sharks: 2, sharkSpeed: 2.0, current: true, durationMs: 210_000, lighting: "night", background: "#042f2e", layout: "abyss" },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Small Tank",
   2: "Tropical Tank",
   3: "Shark Tunnel",
   4: "Giant Aquarium",
   5: "Deep Sea Exhibit",
};

/** Start-card line under the level tile. */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Scrub, pick up, check the filter.",
   2: "One patch is high: float up.",
   3: "Keep clear of the shark.",
   4: "Two filters to check.",
   5: "Eight tasks, a current, two sharks.",
};

export const tasksOf = (level: AquariumLevel): number => level.algae + level.trash + level.filters;
