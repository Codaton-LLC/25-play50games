// Toy Store Night Shift level configs (docs/menu1-new/specs-41-50.md §48). One store; only the
// aisles, the categories, the toy count, the carry cap, the wind-ups, the clock and the light change.
// Plain data: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

export interface ToyLevel {
   aisles: number;
   categories: number;
   shelvesPerCategory: number;
   toys: number;
   carry: 1 | 2;
   windups: number;
   windupSpeed: number;
   durationMs: number;
   lighting: "indoor" | "night";
   background: string;
}

export const LEVELS: Record<LevelId, ToyLevel> = {
   1: { aisles: 2, categories: 3, shelvesPerCategory: 1, toys: 5, carry: 1, windups: 0, windupSpeed: 0, durationMs: 120_000, lighting: "indoor", background: "#fce7f3" },
   2: { aisles: 3, categories: 4, shelvesPerCategory: 1, toys: 8, carry: 1, windups: 1, windupSpeed: 1.4, durationMs: 150_000, lighting: "indoor", background: "#fbcfe8" },
   3: { aisles: 4, categories: 5, shelvesPerCategory: 2, toys: 10, carry: 1, windups: 2, windupSpeed: 1.6, durationMs: 180_000, lighting: "night", background: "#1e293b" },
   4: { aisles: 4, categories: 6, shelvesPerCategory: 2, toys: 14, carry: 2, windups: 3, windupSpeed: 1.8, durationMs: 180_000, lighting: "indoor", background: "#f9a8d4" },
   5: { aisles: 5, categories: 7, shelvesPerCategory: 2, toys: 18, carry: 2, windups: 4, windupSpeed: 2.0, durationMs: 210_000, lighting: "night", background: "#0f172a" },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Toy Shelf",
   2: "Store Floor",
   3: "Warehouse",
   4: "Mega Toy Store",
   5: "Toy Chaos",
};

/** Start-card line under the level tile. */
export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Five toys, three shelves.",
   2: "A wind-up robot is loose.",
   3: "Two shelves for each kind.",
   4: "Carry two at once.",
   5: "Eighteen toys, four wind-ups, lights out.",
};

/** The seven toy kinds in the order the levels add them. */
export const CATEGORIES = ["teddy", "car", "airplane", "ball", "blocks", "train", "robot"] as const;
export type Category = (typeof CATEGORIES)[number];

export const shelvesOf = (level: ToyLevel): number => level.categories * level.shelvesPerCategory;
