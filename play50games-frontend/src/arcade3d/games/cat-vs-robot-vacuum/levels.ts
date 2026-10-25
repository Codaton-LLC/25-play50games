// Cat vs Robot Vacuum level configs (docs/menu1-new/specs-31-40.md §36). One hall, one floor;
// rooms, treats, vacuums, sight and lighting change. Plain data: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

export interface CatLevel {
   rooms: number;
   treats: number;
   toys: number;
   vacuums: number;
   patrolSpeed: number;
   chaseSpeed: number;
   chaseRange: number;
   clutter: number;
   tint: string;
   durationMs: number;
   lighting: "day" | "indoor" | "night";
   background: string;
}

export const LEVELS: Record<LevelId, CatLevel> = {
   1: { rooms: 2, treats: 8, toys: 1, vacuums: 1, patrolSpeed: 1.4, chaseSpeed: 0, chaseRange: 0, clutter: 0, tint: "#fb923c", durationMs: 90_000, lighting: "day", background: "#fde68a" },
   2: { rooms: 3, treats: 12, toys: 1, vacuums: 1, patrolSpeed: 1.8, chaseSpeed: 2.4, chaseRange: 6, clutter: 0, tint: "#9ca3af", durationMs: 120_000, lighting: "indoor", background: "#e7e5e4" },
   3: { rooms: 4, treats: 16, toys: 2, vacuums: 2, patrolSpeed: 1.8, chaseSpeed: 2.6, chaseRange: 7, clutter: 0, tint: "#57534e", durationMs: 150_000, lighting: "indoor", background: "#d6d3d1" },
   4: { rooms: 5, treats: 20, toys: 2, vacuums: 2, patrolSpeed: 2.1, chaseSpeed: 3.0, chaseRange: 8, clutter: 4, tint: "#fde68a", durationMs: 150_000, lighting: "day", background: "#fbcfe8" },
   5: { rooms: 6, treats: 25, toys: 3, vacuums: 3, patrolSpeed: 2.2, chaseSpeed: 3.2, chaseRange: 8, clutter: 6, tint: "#c4b5fd", durationMs: 180_000, lighting: "night", background: "#1e1b4b" },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Living Room",
   2: "Kitchen",
   3: "Bedroom",
   4: "Kids Room",
   5: "Whole House",
};

/** Start-card line under the level tile. */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Eight treats, one vacuum on a path.",
   2: "It can see you.",
   3: "Two vacuums.",
   4: "Boxes block you too.",
   5: "Three vacuums, one floor.",
};
