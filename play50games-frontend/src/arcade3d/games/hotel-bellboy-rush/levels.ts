// Hotel Bellboy Rush level configs (docs/menu1-new/specs-31-40.md §37). One lobby corridor; only
// the door count, the floors the elevator serves, the bags, the clock and the light change.
// Plain data: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

export interface HotelLevel {
   /** room doors on the corridor's door wall */
   doors: number;
   /** floors the elevator serves; 1 = the pad is dark (level 1) */
   floors: number;
   /** correct deliveries that win the level */
   bags: number;
   durationMs: number;
   lighting: "indoor" | "sunset" | "night";
   background: string;
}

export const LEVELS: Record<LevelId, HotelLevel> = {
   1: { doors: 4, floors: 1, bags: 3, durationMs: 120_000, lighting: "indoor", background: "#44403c" },
   2: { doors: 4, floors: 3, bags: 5, durationMs: 150_000, lighting: "indoor", background: "#44403c" },
   3: { doors: 5, floors: 3, bags: 7, durationMs: 180_000, lighting: "indoor", background: "#3f3f46" },
   4: { doors: 5, floors: 3, bags: 9, durationMs: 180_000, lighting: "sunset", background: "#292524" },
   5: { doors: 6, floors: 4, bags: 12, durationMs: 210_000, lighting: "night", background: "#1c1917" },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Lobby Floor",
   2: "3-Floor Hotel",
   3: "Luxury Hotel",
   4: "Business Hotel",
   5: "Grand Hotel",
};

/** Start-card line under the level tile. */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Three bags, the doors you can already see.",
   2: "The elevator changes the numbers.",
   3: "Three floors, seven bags.",
   4: "Same hall, a shorter clock.",
   5: "Twelve bags, four floors, one corridor.",
};
