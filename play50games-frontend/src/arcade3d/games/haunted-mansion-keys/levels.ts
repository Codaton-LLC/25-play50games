// Haunted Mansion Keys level configs (spec §39).
// Plain data: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

export interface MansionLevel {
   cols: number;
   rows: number;
   keys: number;
   lever: boolean;
   armour: boolean;
   armourSpeed: number;
   durationMs: number;
   timeBaseMs: number;
   lives?: number;
   lighting: "indoor" | "night";
   background: string;
   fogFar: number;
}

export const LEVELS: Record<LevelId, MansionLevel> = {
   1: { cols: 3, rows: 1, keys: 2, lever: false, armour: false, armourSpeed: 0, durationMs: 180_000, timeBaseMs: 180_000, lighting: "indoor", background: "#44403c", fogFar: 40 },
   2: { cols: 3, rows: 2, keys: 3, lever: false, armour: false, armourSpeed: 0, durationMs: 210_000, timeBaseMs: 210_000, lighting: "indoor", background: "#3f3f46", fogFar: 36 },
   3: { cols: 4, rows: 2, keys: 3, lever: true, armour: false, armourSpeed: 0, durationMs: 240_000, timeBaseMs: 240_000, lighting: "night", background: "#1e1b2e", fogFar: 30 },
   4: { cols: 5, rows: 2, keys: 4, lever: true, armour: true, armourSpeed: 1.6, durationMs: 240_000, timeBaseMs: 240_000, lives: 3, lighting: "night", background: "#151325", fogFar: 22 },
   5: { cols: 4, rows: 3, keys: 5, lever: true, armour: true, armourSpeed: 1.9, durationMs: 300_000, timeBaseMs: 300_000, lives: 3, lighting: "night", background: "#181530", fogFar: 24 },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Entrance Hall",
   2: "Library",
   3: "Bedrooms",
   4: "Basement",
   5: "Grand Mansion Escape",
};

/** Start-card line under the level tile. */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Two keys in a straight line of rooms.",
   2: "A second row of rooms.",
   3: "A lever opens a shortcut.",
   4: "An armour walks the hall.",
   5: "Twelve rooms, five keys.",
};
