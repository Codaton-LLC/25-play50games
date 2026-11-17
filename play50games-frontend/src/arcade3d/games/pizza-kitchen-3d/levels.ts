// Pizza Kitchen 3D level configs (docs/menu1-new/specs-41-50.md §45): one kitchen; tickets, toppings,
// ovens, bake windows, patience and the box step change. Plain data: no three.js, no React.
import type { LevelId } from "@/arcade3d/types";

export type KitchenTheme = "cheese" | "trattoria" | "rush" | "diner" | "patio";

export interface PizzaLevel {
   orders: number;
   /** 0..5 from pepperoni, mushroom, olive, tomato, onion */
   toppingTypes: number;
   maxToppings: number;
   parallel: number;
   ovens: number;
   bakeS: number;
   goldenS: number;
   /** 0 = tickets wait */
   patienceS: number;
   boxStep: boolean;
   durationMs: number;
   lighting: "indoor" | "sunset" | "night";
   background: string;
   /** the room (looks.ts KITCHENS, Decor.tsx): floor, walls, counters and the props round the line */
   theme: KitchenTheme;
}

export const LEVELS: Record<LevelId, PizzaLevel> = {
   1: { orders: 3, toppingTypes: 0, maxToppings: 0, parallel: 1, ovens: 1, bakeS: 5, goldenS: 5, patienceS: 0, boxStep: false, durationMs: 120_000, lighting: "indoor", background: "#fef3c7", theme: "cheese" },
   2: { orders: 4, toppingTypes: 2, maxToppings: 2, parallel: 1, ovens: 1, bakeS: 5, goldenS: 4, patienceS: 0, boxStep: false, durationMs: 150_000, lighting: "indoor", background: "#fde68a", theme: "trattoria" },
   3: { orders: 6, toppingTypes: 3, maxToppings: 2, parallel: 2, ovens: 2, bakeS: 6, goldenS: 4, patienceS: 0, boxStep: false, durationMs: 180_000, lighting: "indoor", background: "#fdba74", theme: "rush" },
   4: { orders: 8, toppingTypes: 4, maxToppings: 2, parallel: 2, ovens: 2, bakeS: 6, goldenS: 3.5, patienceS: 45, boxStep: false, durationMs: 180_000, lighting: "sunset", background: "#fb923c", theme: "diner" },
   5: { orders: 10, toppingTypes: 5, maxToppings: 2, parallel: 2, ovens: 2, bakeS: 6, goldenS: 3, patienceS: 40, boxStep: true, durationMs: 210_000, lighting: "night", background: "#431407", theme: "patio" },
};

export const LEVEL_TITLES: Record<LevelId, string> = {
   1: "Cheese Pizza",
   2: "Two Toppings",
   3: "Restaurant Rush",
   4: "Multiple Orders",
   5: "Master Pizza Night",
};

export const LEVEL_LINES: Record<LevelId, string> = {
   1: "Sauce, cheese, oven, serve.",
   2: "A cosy trattoria: toppings in ticket order.",
   3: "The restaurant fills up: two ovens, two tickets, a full dining room.",
   4: "A sunset diner with a big wall clock: tickets do not wait forever.",
   5: "The night patio by the wood-fired ovens: box it before it goes out.",
};
