// Magnet Coin Lab's look per level (World 4, Sugarfrost Workshop): warm timber and brass under the
// drained winter light; the gold of the coins is the colour the player brings back. Pure data.
//   L1 Basic Magnet   honey timber, a window of soft snow light
//   L2 Two Poles      the red and blue poles painted on the beams, cooler
//   L3 Moving Metal   iron and soot, the rails' cold shine
//   L4 Drone Lab      the clean white lab, teal screens
//   L5 Scrap Magnus   the forge: dark iron, ember red
import type { LevelId } from "../../types";
import type { LightingPreset } from "../../core/types";

export interface LabLook {
   lighting: LightingPreset;
   background: string;
   fog: [string, number, number];
   wall: string;
   wallDark: string;
   trim: string;
   back: string;
   backLine: string;
   snow: string;
   window: string;
   light: string;
   ambient: number;
}

export const LOOKS: Record<LevelId, LabLook> = {
   1: { lighting: "day", background: "#2a1e16", fog: ["#2a1e16", 30, 80], wall: "#8a5a36", wallDark: "#5e3b22", trim: "#d4a24c", back: "#4a3324", backLine: "#3a271b", snow: "#eef3f8", window: "#bcd6ec", light: "#ffe2b8", ambient: 0.55 },
   2: { lighting: "day", background: "#1f1a1c", fog: ["#1f1a1c", 30, 80], wall: "#7a5236", wallDark: "#523522", trim: "#c99a48", back: "#3d2c2a", backLine: "#2f2120", snow: "#eaf0f6", window: "#b4cfe6", light: "#ffe6c4", ambient: 0.52 },
   3: { lighting: "day", background: "#1a1918", fog: ["#1a1918", 28, 78], wall: "#665448", wallDark: "#463a31", trim: "#b8925a", back: "#33302d", backLine: "#282523", snow: "#e6ebf0", window: "#a8c4dc", light: "#ffe0b0", ambient: 0.5 },
   4: { lighting: "day", background: "#1b2224", fog: ["#1b2224", 30, 80], wall: "#9a7a5c", wallDark: "#6b5440", trim: "#d8b25c", back: "#3c4a4c", backLine: "#2f3b3d", snow: "#f1f5f9", window: "#c4e2ec", light: "#f4fbff", ambient: 0.58 },
   5: { lighting: "night", background: "#140c0a", fog: ["#160d0b", 26, 70], wall: "#4e3a30", wallDark: "#33251e", trim: "#c0703a", back: "#2a1a14", backLine: "#1e120e", snow: "#d8dde2", window: "#ff8a4c", light: "#ffb27a", ambient: 0.42 },
};

export const lookFor = (id: LevelId | number): LabLook => LOOKS[(id >= 1 && id <= 5 ? id : 1) as LevelId];

/** The two poles: + is red, - is blue (the HUD, the halos, the pads, the gates). */
export const POLE = { plus: "#ef4444", minus: "#3b82f6", plusGlow: "#fca5a5", minusGlow: "#93c5fd" } as const;
export const poleColor = (sign: number) => (sign > 0 ? POLE.plus : POLE.minus);
