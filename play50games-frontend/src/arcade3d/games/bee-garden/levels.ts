import type { LevelId } from "@/arcade3d/types";

export interface BeeLevel {
   width: number;
   depth: number;
   units: number;
   webs: number;
   branches: number;
   breeze: boolean;
   tint: string;
   durationMs: number;
   lighting: "day" | "sunset";
   background: string;
}

export const LEVELS: Record<LevelId, BeeLevel> = {
   1: { width: 18, depth: 14, units: 10, webs: 0, branches: 2, breeze: false, tint: "#fbbf24", durationMs: 120_000, lighting: "day", background: "#7dd3fc" },
   2: { width: 22, depth: 16, units: 15, webs: 2, branches: 4, breeze: false, tint: "#93c5fd", durationMs: 150_000, lighting: "day", background: "#86efac" },
   3: { width: 24, depth: 18, units: 20, webs: 4, branches: 6, breeze: false, tint: "#f8fafc", durationMs: 180_000, lighting: "day", background: "#bbf7d0" },
   4: { width: 28, depth: 20, units: 25, webs: 6, branches: 8, breeze: false, tint: "#a3e635", durationMs: 180_000, lighting: "sunset", background: "#166534" },
   5: { width: 32, depth: 22, units: 30, webs: 8, branches: 8, breeze: true, tint: "#fcd34d", durationMs: 210_000, lighting: "day", background: "#14532d" },
};

export const LEVEL_DESCRIPTIONS: Record<LevelId, string> = {
   1: "Flower Garden: ten nectar, no webs — learn the hive.",
   2: "Vegetable Garden: planter beds and the first spider webs.",
   3: "Greenhouse: milky glass walls, more flowers and webs.",
   4: "Forest Flowers: sunset tree line, denser webs and branches.",
   5: "Giant Garden: a giant bloom, a sideways breeze and thirty nectar.",
};
