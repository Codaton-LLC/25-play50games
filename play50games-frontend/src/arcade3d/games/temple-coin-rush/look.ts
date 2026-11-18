// Temple Coin Rush's look per level (pure data, no three.js): World 3 Wild Temples, green. A carved
// sandstone temple corridor with jade inlays and moss in a jungle drained grey by Shadow Plates; the
// colour comes back as the gates are cleared (the World 3 restore). The card's light per level: misty
// morning (L1), green noon (L2), golden hour (L3), blue night with torches (L4), and a storm-grey sky
// for Coilstone (L5).
import type { LevelId } from "@/arcade3d/types";

export interface TempleLook {
   skyTop: string;
   skyBottom: string;
   /** the horizon's glow */
   glow: string;
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   floor: string;
   floorLine: string;
   stone: string;
   trim: string;
   jade: string;
   moss: string;
   ground: string;
   canopy: string;
   canopyGrey: string;
   flame: string;
   lighting: "day" | "sunset" | "night";
}

export const LOOKS: Record<LevelId, TempleLook> = {
   1: { skyTop: "#8fb3c4", skyBottom: "#e3e7dc", glow: "#fff7e0", background: "#c9d3cc", fog: "#c9d3cc", fogNear: 30, fogFar: 150, floor: "#b8a17e", floorLine: "#5fae8b", stone: "#c4ad88", trim: "#9c8665", jade: "#4f9a7c", moss: "#5d7a4c", ground: "#6f7a64", canopy: "#2f8f4e", canopyGrey: "#8a928a", flame: "#ffb347", lighting: "day" },
   2: { skyTop: "#4f9fd6", skyBottom: "#d6efe4", glow: "#ffffff", background: "#b9dccb", fog: "#b9dccb", fogNear: 40, fogFar: 175, floor: "#c2a77f", floorLine: "#3fb37f", stone: "#ccb38c", trim: "#a38a66", jade: "#36a374", moss: "#4f8a3e", ground: "#5d7f55", canopy: "#2aa14e", canopyGrey: "#8c948b", flame: "#ffc061", lighting: "day" },
   3: { skyTop: "#5b6fa8", skyBottom: "#f5b06a", glow: "#ffcf80", background: "#d79a69", fog: "#d9a274", fogNear: 36, fogFar: 160, floor: "#b8915f", floorLine: "#e6c25a", stone: "#c69d6c", trim: "#946f45", jade: "#3e9a72", moss: "#6a7a3c", ground: "#6b6a45", canopy: "#4c9a3c", canopyGrey: "#8f8a7c", flame: "#ffb03a", lighting: "sunset" },
   4: { skyTop: "#0d1633", skyBottom: "#2b4370", glow: "#6f8fd0", background: "#1c2a4a", fog: "#1f2d4f", fogNear: 28, fogFar: 135, floor: "#7a7060", floorLine: "#52d0a0", stone: "#8e8470", trim: "#6a6252", jade: "#3fbf8f", moss: "#3c5a3a", ground: "#28343a", canopy: "#2a7a4a", canopyGrey: "#4a5258", flame: "#ffa040", lighting: "night" },
   5: { skyTop: "#3e4650", skyBottom: "#9aa3a8", glow: "#d8e0e0", background: "#7c868b", fog: "#808a8f", fogNear: 30, fogFar: 150, floor: "#8f856f", floorLine: "#4fc493", stone: "#a39a82", trim: "#7a7262", jade: "#2fb07a", moss: "#4a6440", ground: "#4c564e", canopy: "#2f9a52", canopyGrey: "#7c827c", flame: "#ffb045", lighting: "day" },
};

export const COLORS = {
   background: LOOKS[1].background,
   gold: "#ffd257",
   coin: "#f5c542",
   jade: "#34d399",
   slow: "#a8a29e",
   shut: "#94a3b8",
   ghost: "#c4b5fd",
   shield: "#86efac",
   danger: "#ef4444",
} as const;

export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "night" } {
   const l = LOOKS[id];
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}

/** How much of the colour has come back (0..1): a quarter at the start, all of it after the last gate. */
export function restoreAmount(gatesCleared: number, gates: number): number {
   if (!(gates > 0)) return 1;
   return 0.25 + 0.75 * Math.min(1, gatesCleared / gates);
}
