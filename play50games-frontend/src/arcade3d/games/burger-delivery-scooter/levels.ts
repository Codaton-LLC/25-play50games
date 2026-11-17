import type { LevelId } from "../../types";
export interface BurgerLevel {
   blocksX: number; blocksZ: number; orders: number; barriers: number; traffic: number;
   wet: boolean; wetDrain: number; qualityMin: number; durationMs: number;
   lighting: "day" | "sunset" | "night"; background: string;
}
export const LEVELS: Record<LevelId, BurgerLevel> = {
   1: { blocksX: 2, blocksZ: 2, orders: 3, barriers: 2, traffic: 0, wet: false, wetDrain: 0, qualityMin: 80, durationMs: 120000, lighting: "day", background: "#bae6fd" },
   2: { blocksX: 2, blocksZ: 3, orders: 4, barriers: 4, traffic: 2, wet: false, wetDrain: 0, qualityMin: 80, durationMs: 150000, lighting: "day", background: "#7dd3fc" },
   3: { blocksX: 3, blocksZ: 2, orders: 5, barriers: 6, traffic: 3, wet: false, wetDrain: 0, qualityMin: 75, durationMs: 180000, lighting: "sunset", background: "#fdba74" },
   4: { blocksX: 3, blocksZ: 3, orders: 6, barriers: 6, traffic: 4, wet: true, wetDrain: 4, qualityMin: 70, durationMs: 180000, lighting: "sunset", background: "#57534e" },
   5: { blocksX: 3, blocksZ: 3, orders: 8, barriers: 8, traffic: 6, wet: true, wetDrain: 5, qualityMin: 70, durationMs: 210000, lighting: "night", background: "#0f172a" },
};
export const TITLES = ["Neighborhood", "City Center", "Park District", "Rainy City", "Night Delivery"];
export const LEVEL_LINES = ["Three drops, wide streets, keep quality at 80.", "Tighter corners and two cars.", "Hop the barriers.", "Wet streets pull quality down.", "Eight orders, quality still 70."];
