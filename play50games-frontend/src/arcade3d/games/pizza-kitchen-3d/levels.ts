import type { LevelId } from "@/arcade3d/types";
export interface PizzaLevel {
   orders: number; toppingTypes: number; maxToppings: number; parallel: number; ovens: number;
   bakeS: number; goldenS: number; patienceS: number; boxStep: boolean; durationMs: number;
   lighting: "indoor" | "sunset" | "night"; background: string;
}
export const LEVELS: Record<LevelId, PizzaLevel> = {
   1: { orders: 3, toppingTypes: 0, maxToppings: 0, parallel: 1, ovens: 1, bakeS: 5, goldenS: 5, patienceS: 0, boxStep: false, durationMs: 120000, lighting: "indoor", background: "#fef3c7" },
   2: { orders: 4, toppingTypes: 2, maxToppings: 2, parallel: 1, ovens: 1, bakeS: 5, goldenS: 4, patienceS: 0, boxStep: false, durationMs: 150000, lighting: "indoor", background: "#fde68a" },
   3: { orders: 6, toppingTypes: 3, maxToppings: 2, parallel: 2, ovens: 2, bakeS: 6, goldenS: 4, patienceS: 0, boxStep: false, durationMs: 180000, lighting: "indoor", background: "#fdba74" },
   4: { orders: 8, toppingTypes: 4, maxToppings: 2, parallel: 2, ovens: 2, bakeS: 6, goldenS: 3.5, patienceS: 45, boxStep: false, durationMs: 180000, lighting: "sunset", background: "#fb923c" },
   5: { orders: 10, toppingTypes: 5, maxToppings: 2, parallel: 2, ovens: 2, bakeS: 6, goldenS: 3, patienceS: 40, boxStep: true, durationMs: 210000, lighting: "night", background: "#431407" },
};
export const TITLES = ["Cheese Pizza", "Two Toppings", "Restaurant Rush", "Multiple Orders", "Master Pizza Night"];
export const LINES = ["Sauce, cheese, oven, serve.", "Toppings in ticket order.", "Two ovens, two tickets.", "Tickets do not wait forever.", "Box it before it goes out."];
