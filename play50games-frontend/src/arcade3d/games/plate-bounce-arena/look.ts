// Plate Bounce Arena's look: World 4's sugarfrost workshop (mint and strawberry plastic, vanilla rails,
// candy glass, frosty blue) in the Pinball Hall, and one light per table: a warm morning hall (L1), the
// pink-and-green glow of the mushroom garden (L2), the frozen blue ice table (L3), neon night for the
// multiball (L4) and Rollo's violet stage (L5). Plain data (index.tsx reads the environment from here).
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   mint: "#7ee0c3",
   mintDark: "#2fa58a",
   strawberry: "#ff6b8b",
   vanilla: "#fff4d6",
   rail: "#f4f1ea",
   railDark: "#c9c2b4",
   cabinet: "#5b3fa8",
   cabinetDark: "#3a2672",
   orb: "#fbbf24",
   coin: "#facc15",
   lantern: "#ffd257",
   lanternOff: "#8f7f5a",
   ramp: "#9be7ff",
   orbit: "#c4f1a0",
   ghost: "#c4b5fd",
   crack: "#c9925a",
   deck: "#a5f3fc",
   hole: "#1e1b4b",
   holeOpen: "#4ade80",
   golden: "#fde047",
   rollo: "#7c3aed",
   jam: "#ef4444",
   ice: "#bfe9ff",
   glass: "#e0f2fe",
} as const;

export interface LevelLook {
   mood: string;
   background: string;
   fog: [string, number, number];
   lighting: "indoor" | "day" | "night" | "snow";
   /** the playfield paint: base, stripes, the accent art */
   field: string;
   stripe: string;
   accent: string;
   /** hall walls, the lamps over the table, the neon tubes */
   hall: string;
   lamp: string;
   lampIntensity: number;
   neon: string;
}

export const LEVEL_LOOK: Record<LevelId, LevelLook> = {
   1: { mood: "Warm morning hall", background: "#f3d9c4", fog: ["#f3d9c4", 45, 130], lighting: "indoor", field: "#ffe9f2", stripe: "#ffd1e1", accent: "#ff6b8b", hall: "#e8c7b0", lamp: "#ffe7c2", lampIntensity: 1.2, neon: "#ff8fab" },
   2: { mood: "Mushroom garden glow", background: "#d9f2d0", fog: ["#d9f2d0", 45, 130], lighting: "day", field: "#e9fbe3", stripe: "#c9f1bb", accent: "#e8457a", hall: "#bfe3b4", lamp: "#fff2d0", lampIntensity: 1.1, neon: "#7ee0c3" },
   3: { mood: "Frozen ice table", background: "#d5ecfb", fog: ["#d5ecfb", 42, 120], lighting: "snow", field: "#eaf7ff", stripe: "#cfe9fb", accent: "#38bdf8", hall: "#b9d9ef", lamp: "#eaf6ff", lampIntensity: 1.0, neon: "#7dd3fc" },
   4: { mood: "Neon multiball night", background: "#1d1640", fog: ["#1d1640", 40, 115], lighting: "night", field: "#3a2d80", stripe: "#4a3a99", accent: "#f472b6", hall: "#241a52", lamp: "#f0abfc", lampIntensity: 1.6, neon: "#22d3ee" },
   5: { mood: "Rollo's violet stage", background: "#2a1a3f", fog: ["#2a1a3f", 40, 115], lighting: "night", field: "#4a2f73", stripe: "#5b3a8a", accent: "#fde047", hall: "#2f1f4a", lamp: "#e9d5ff", lampIntensity: 1.5, neon: "#a855f7" },
};

export function levelLook(id: number): LevelLook {
   return LEVEL_LOOK[(id >= 1 && id <= 5 ? id : 1) as LevelId];
}

/** The shell's environment for a level (background, fog band, lighting preset). */
export function levelEnvironment(id: number): { background: string; fog: [string, number, number]; lighting: LevelLook["lighting"] } {
   const look = levelLook(id);
   return { background: look.background, fog: look.fog, lighting: look.lighting };
}

/** The chase lights: 0..1 brightness of light k of n at time t (s), faster with the combo multiplier. */
export function chase(k: number, n: number, t: number, mult: number): number {
   const speed = 0.8 + mult * 0.5;
   const p = (((t * speed - k / n) % 1) + 1) % 1;
   return p < 0.25 ? 1 - p * 4 : 0;
}
