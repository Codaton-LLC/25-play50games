// Color Match Jump's look (World 6, Prism Fortress): smoked grey glass and void, the five hero colours
// the only saturated tones, so a hex's colour reads at a glance; each colour also carries its glyph.
import type { LevelId } from "../../types";

/** Index = colour index (0..4 heroes, 5 grey, 6 ice). */
export const HEX_COLORS = ["#ef4444", "#2563eb", "#22c55e", "#facc15", "#8b5cf6", "#64748b", "#bae6fd"] as const;
export const GLYPH_TEXT = ["❯", "≈", "⬡", "∩", "@", "", "❄"] as const;
export const COLOR_NAMES = ["Red", "Blue", "Green", "Yellow", "Purple", "Grey", "Ice"] as const;

interface LevelLook {
   lighting: "day" | "sunset" | "night";
   background: string;
   fog: [string, number, number];
}

const LOOKS: Record<LevelId, LevelLook> = {
   1: { lighting: "day", background: "#9fb4c8", fog: ["#9fb4c8", 45, 140] },
   2: { lighting: "day", background: "#8aa3bb", fog: ["#8aa3bb", 45, 130] },
   3: { lighting: "sunset", background: "#5b4a6e", fog: ["#5b4a6e", 40, 120] },
   4: { lighting: "night", background: "#1b2333", fog: ["#1b2333", 38, 115] },
   5: { lighting: "night", background: "#1e293b", fog: ["#1e293b", 40, 120] },
};

export function levelEnvironment(id: LevelId): LevelLook {
   return LOOKS[id] ?? LOOKS[1];
}
