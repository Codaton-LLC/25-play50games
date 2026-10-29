// Hotel Bellboy Rush level configs (docs/menu1-new/specs-31-40.md §37). Each level is its own
// lobby (theme → looks.ts palette + set pieces + rules.decorFor layout); doors / floors / bags /
// clock / light ramp. Level 1 is today's Lobby Floor and must not change. Plain data: no three.js.
import type { LevelId } from "@/arcade3d/types";

/** Visual identity: palette, carpet pattern, lobby prop layout and set pieces (looks.ts / decorFor). */
export type HotelTheme = "lobby" | "floors3" | "luxury" | "business" | "grand";

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
   /** looks.ts LOOKS + Scene set pieces; rules.ts decorFor layout */
   theme: HotelTheme;
}

export const LEVELS: Record<LevelId, HotelLevel> = {
   // Lobby Floor: today's warm stone hall, dark pad, three bags.
   1: { doors: 4, floors: 1, bags: 3, durationMs: 120_000, lighting: "indoor", background: "#44403c", theme: "lobby" },
   // 3-Floor Hotel: cooler taupe + navy runner; the elevator changes the numbers.
   2: { doors: 4, floors: 3, bags: 5, durationMs: 150_000, lighting: "indoor", background: "#4b5563", theme: "floors3" },
   // Luxury Hotel: cream marble, rose carpet, gold brass, chandelier.
   3: { doors: 5, floors: 3, bags: 7, durationMs: 180_000, lighting: "indoor", background: "#3f3a32", theme: "luxury" },
   // Business Hotel: slate glass lobby under sunset light.
   4: { doors: 5, floors: 3, bags: 9, durationMs: 180_000, lighting: "sunset", background: "#1e293b", theme: "business" },
   // Grand Hotel: night hall, chandelier and columns, twelve bags.
   5: { doors: 6, floors: 4, bags: 12, durationMs: 210_000, lighting: "night", background: "#0c0a09", theme: "grand" },
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
   2: "Three floors — ride the elevator between bags.",
   3: "Marble lobby, gold trim, seven bags.",
   4: "Glass and slate — nine bags before dusk.",
   5: "Chandelier hall, twelve bags, four floors.",
};
