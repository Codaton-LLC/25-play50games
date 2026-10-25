// Firefighter Rescue level configs (docs/menu1-new/specs-31-40.md §31). One corridor; only
// counts, drain, clock and lighting change. Plain data: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

export interface FireLevel {
   rooms: number;
   fires: number;
   civilians: number;
   smoke: number;
   blockedDoors: number;
   debris: number;
   breathDrain: number;
   durationMs: number;
   lighting: "indoor" | "day" | "sunset" | "night";
   background: string;
}

export const LEVELS: Record<LevelId, FireLevel> = {
   1: { rooms: 2, fires: 2, civilians: 1, smoke: 1, blockedDoors: 0, debris: 0, breathDrain: 0.15, durationMs: 120_000, lighting: "indoor", background: "#292524" },
   2: { rooms: 3, fires: 4, civilians: 2, smoke: 2, blockedDoors: 1, debris: 0, breathDrain: 0.18, durationMs: 150_000, lighting: "day", background: "#44403c" },
   3: { rooms: 4, fires: 6, civilians: 3, smoke: 3, blockedDoors: 1, debris: 0, breathDrain: 0.22, durationMs: 180_000, lighting: "indoor", background: "#1c1917" },
   4: { rooms: 5, fires: 8, civilians: 4, smoke: 4, blockedDoors: 2, debris: 1, breathDrain: 0.28, durationMs: 180_000, lighting: "night", background: "#0c0a09" },
   5: { rooms: 6, fires: 10, civilians: 5, smoke: 5, blockedDoors: 2, debris: 2, breathDrain: 0.32, durationMs: 210_000, lighting: "sunset", background: "#291c14" },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Small Apartment",
   2: "Family House",
   3: "Office",
   4: "Hotel",
   5: "Warehouse",
};

/** Start-card line under the level tile. */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Two fires and one neighbour.",
   2: "A doorway stays shut until that fire is out.",
   3: "Six fires, three people, one locked door.",
   4: "Debris crosses the hall.",
   5: "Ten fires, two debris paths, thick smoke.",
};
