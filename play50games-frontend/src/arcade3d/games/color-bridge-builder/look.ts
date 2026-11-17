// Color Bridge Builder's look (World 6, Prism Fortress): a slate canyon under a pale sky, the light
// bridges the only strong colour; deeper and duskier level by level. Pure data.
import type { LevelId } from "../../types";
import type { LightingPreset } from "../../core/types";

export interface BridgeLook {
   lighting: LightingPreset;
   background: string;
   fog: [string, number, number];
   rock: string;
   rockTop: string;
   abyss: string;
   ambient: number;
}

export const LOOKS: Record<LevelId, BridgeLook> = {
   1: { lighting: "day", background: "#9fb4c8", fog: ["#9fb4c8", 40, 120], rock: "#6b6f7a", rockTop: "#a7aab3", abyss: "#1e293b", ambient: 0.75 },
   2: { lighting: "day", background: "#a5b2c9", fog: ["#a5b2c9", 40, 120], rock: "#686b78", rockTop: "#a3a6b2", abyss: "#1e2438", ambient: 0.72 },
   3: { lighting: "sunset", background: "#c9a99a", fog: ["#c9a99a", 38, 115], rock: "#6e6672", rockTop: "#aca2ab", abyss: "#251c2e", ambient: 0.66 },
   4: { lighting: "sunset", background: "#8f8aa8", fog: ["#8f8aa8", 36, 110], rock: "#5f5f70", rockTop: "#9b9bab", abyss: "#181a2c", ambient: 0.62 },
   5: { lighting: "night", background: "#2c2f4a", fog: ["#2c2f4a", 34, 105], rock: "#4f5263", rockTop: "#8a8da0", abyss: "#0d0f1e", ambient: 0.55 },
};

export const lookFor = (id: LevelId | number): BridgeLook => LOOKS[(id >= 1 && id <= 5 ? id : 1) as LevelId];

/** a colour mask's light colour */
export const MASK_COLOR: Record<number, string> = { 0: "#64748b", 1: "#ef4444", 2: "#3b82f6", 4: "#facc15", 3: "#a855f7", 6: "#22c55e", 5: "#f97316", 7: "#f8fafc" };
