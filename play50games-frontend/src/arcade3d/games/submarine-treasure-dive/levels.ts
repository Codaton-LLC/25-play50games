// Submarine Treasure Dive level configs. Each level is its own reef (theme → looks.ts palette
// + apron scenery; rules.ts landmarks on L3–L5). Counts, drain, clock and light still ramp.
// Plain data: no three.js, no React. Level 4 drain is 0.38 rather than the spec's 0.6 so a fair
// route still finishes with at least 15% battery. Drain is the tuning knob; the limits are not.
import type { LevelId } from "@/arcade3d/types";

/** One place per level name: shallow reef, coral garden, sunken ship, deep cave, ancient ruins. */
export type ReefTheme = "shallow" | "coral" | "wreck" | "cave" | "ruins";

export interface SubLevel {
   width: number;
   depth: number;
   treasures: number;
   rocks: number;
   coral: number;
   jellies: number;
   jellySpeed: number;
   current: number;
   drain: number;
   durationMs: number;
   lighting: "day" | "sunset" | "night";
   background: string;
   fogFar: number;
   /** looks.ts LOOKS + Scene apron scenery; rules.ts landmarks on wreck/cave/ruins */
   theme: ReefTheme;
}

export const LEVELS: Record<LevelId, SubLevel> = {
   // Shallow Reef: today's game (bright cyan water, open floor, no wrecks or columns).
   1: { width: 30, depth: 26, treasures: 3, rocks: 4, coral: 4, jellies: 0, jellySpeed: 0, current: 0, drain: 0.55, durationMs: 120_000, lighting: "day", background: "#0891b2", fogFar: 40, theme: "shallow" },
   // Coral Reef: denser coral, teal water, coral-garden apron outside the play box.
   2: { width: 36, depth: 30, treasures: 4, rocks: 6, coral: 8, jellies: 0, jellySpeed: 0, current: 0, drain: 0.55, durationMs: 150_000, lighting: "day", background: "#0f766e", fogFar: 36, theme: "coral" },
   // Sunken Ship: one landmark wreck mid-reef, amber dusk water, jellyfish.
   3: { width: 40, depth: 34, treasures: 5, rocks: 6, coral: 8, jellies: 3, jellySpeed: 1.2, current: 0, drain: 0.5, durationMs: 180_000, lighting: "sunset", background: "#9a3412", fogFar: 32, theme: "wreck" },
   // Deep Cave: cave-mouth pillars north, dark teal, current from the east.
   4: { width: 44, depth: 36, treasures: 6, rocks: 8, coral: 10, jellies: 4, jellySpeed: 1.4, current: 0.5, drain: 0.38, durationMs: 180_000, lighting: "night", background: "#0c4a6e", fogFar: 26, theme: "cave" },
   // Ancient Ruins: colonnade + fallen slabs, deep indigo, densest haul.
   5: { width: 48, depth: 40, treasures: 8, rocks: 10, coral: 12, jellies: 6, jellySpeed: 1.6, current: 0.6, drain: 0.36, durationMs: 240_000, lighting: "night", background: "#1e1b4b", fogFar: 24, theme: "ruins" },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Shallow Reef",
   2: "Coral Reef",
   3: "Sunken Ship",
   4: "Deep Cave",
   5: "Ancient Ruins",
};

/** Start-card line under the level tile. */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Three treasures, a full battery.",
   2: "Coral everywhere: steer around it.",
   3: "Jellyfish drift between the wrecks.",
   4: "Dark water and a current.",
   5: "Eight treasures, one battery.",
};
