// Toy Store Night Shift level configs (docs/menu1-new/specs-41-50.md §48). One store; only the
// departments change shelf spacing, row placement, scenery, palette and lighting.
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
   lighting: "indoor" | "night" | "day" | "sunset";
   department?: "retail" | "warehouse" | "mega" | "chaos";
   shelfGap?: number;
   rowPitch?: number;
   rowOffsets?: readonly number[];
   background: string;
}

export const LEVELS: Record<LevelId, ToyLevel> = {
   1: { aisles: 2, categories: 3, shelvesPerCategory: 1, toys: 5, carry: 1, windups: 0, windupSpeed: 0, durationMs: 120_000, lighting: "indoor", background: "#fce7f3" },
   2: { department: "retail", shelfGap: 2.0, rowOffsets: [0.8, -0.8, 0.8], aisles: 3, categories: 4, shelvesPerCategory: 1, toys: 8, carry: 1, windups: 1, windupSpeed: 1.4, durationMs: 150_000, lighting: "day", background: "#b8dbd8" },
   3: { department: "warehouse", shelfGap: 1.8, rowPitch: 4.2, rowOffsets: [-0.7, -0.7, 0.7, 0.7], aisles: 4, categories: 5, shelvesPerCategory: 2, toys: 10, carry: 1, windups: 2, windupSpeed: 1.6, durationMs: 180_000, lighting: "night", background: "#253345" },
   4: { department: "mega", shelfGap: 2.8, rowPitch: 4.6, rowOffsets: [-1, 1, -1, 1], aisles: 4, categories: 6, shelvesPerCategory: 2, toys: 14, carry: 2, windups: 3, windupSpeed: 1.8, durationMs: 180_000, lighting: "sunset", background: "#6e4265" },
   5: { department: "chaos", shelfGap: 2.2, rowPitch: 4.0, rowOffsets: [1, -0.6, 0.9, -1, 0.4], aisles: 5, categories: 7, shelvesPerCategory: 2, toys: 18, carry: 2, windups: 4, windupSpeed: 2.0, durationMs: 210_000, lighting: "night", background: "#17132f" },
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
