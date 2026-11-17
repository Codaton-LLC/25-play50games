// Firefighter Rescue level configs (docs/menu1-new/specs-31-40.md §31). Each level is its own
// floor plan: which side each room opens on, how deep the wing runs, where the doorway sits and
// the furniture theme (levels.ts plan), on top of the counts, drain, clock and lighting. Level 1
// is today's game: its plan is the old fixed geometry. Plain data: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

/** The furniture theme of a level's rooms (rules.ts placeRoom). */
export type FurnTheme = "apartment" | "house" | "office" | "hotel" | "warehouse";

/**
 * The per-level floor plan. Level 1's values reproduce the original fixed geometry exactly
 * (rooms alternate from the left, 5 m deep wings, doorways centred).
 */
export interface LevelPlan {
   /** which side each room opens on: -1 left of the hall, +1 right (one entry per room) */
   sides: readonly (-1 | 1)[];
   /** room depth (m): the wing's width from the hall wall to its outer wall */
   deep: number;
   /** each doorway's offset along z from its room's middle (m); negative is toward the exit */
   doorShift: readonly number[];
   /** the furniture layout theme */
   furn: FurnTheme;
}

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
   /** fog [near, far] in m, both fog planes on the level's background */
   fog: readonly [number, number];
   /** the level's own floor plan */
   plan: LevelPlan;
}

export const LEVELS: Record<LevelId, FireLevel> = {
   // Small Apartment: today's corridor, unchanged.
   1: { rooms: 2, fires: 2, civilians: 1, smoke: 1, blockedDoors: 0, debris: 0, breathDrain: 0.15, durationMs: 120_000, lighting: "indoor", background: "#292524", fog: [90, 260], plan: { sides: [-1, 1], deep: 5, doorShift: [0, 0], furn: "apartment" } },
   // Family House: an L-shaped home — two rooms share the right wing — and every doorway nearer the porch.
   2: { rooms: 3, fires: 4, civilians: 2, smoke: 2, blockedDoors: 1, debris: 0, breathDrain: 0.18, durationMs: 150_000, lighting: "day", background: "#44403c", fog: [110, 300], plan: { sides: [-1, 1, 1], deep: 5, doorShift: [0, -1.1, -1.1], furn: "house" } },
   // Office: alternating cubicle rows, doorways staggered ±0.8 m off centre.
   3: { rooms: 4, fires: 6, civilians: 3, smoke: 3, blockedDoors: 1, debris: 0, breathDrain: 0.22, durationMs: 180_000, lighting: "indoor", background: "#1c1917", fog: [70, 200], plan: { sides: [-1, 1, -1, 1], deep: 5, doorShift: [0.8, -0.8, 0.8, -0.8], furn: "office" } },
   // Hotel: five identical rooms, every door pulled 1.2 m toward the exit (shorter, faster rescues).
   4: { rooms: 5, fires: 8, civilians: 4, smoke: 4, blockedDoors: 2, debris: 1, breathDrain: 0.28, durationMs: 180_000, lighting: "night", background: "#0c0a09", fog: [50, 160], plan: { sides: [-1, 1, -1, 1, -1], deep: 5, doorShift: [-1.2, -1.2, -1.2, -1.2, -1.2], furn: "hotel" } },
   // Warehouse: wide 6.5 m storage bays; routes stay the same length, the hall runs between tall racks.
   5: { rooms: 6, fires: 10, civilians: 5, smoke: 5, blockedDoors: 2, debris: 2, breathDrain: 0.32, durationMs: 210_000, lighting: "sunset", background: "#291c14", fog: [80, 220], plan: { sides: [-1, 1, -1, 1, -1, 1], deep: 6.5, doorShift: [0, 0, 0, 0, 0, 0], furn: "warehouse" } },
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
   2: "An L-shaped family home: one doorway stays shut until that fire is out.",
   3: "Staggered office doorways. Six fires, three people, one locked door.",
   4: "Hotel rooms at night. Debris crosses the hall. Doors near the exit.",
   5: "Wide warehouse bays, thick smoke, two debris paths.",
};
