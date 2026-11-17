// Paint the Platforms' look (World 6 Prism Fortress, its mural courtyard): the fortress is smoked grey
// glass and slate (#64748B to #1F2937); the five hero colours are the only saturated tones, so a painted
// tile reads at a glance. A set row glows. Per-level moods (the card: bright and readable, natural,
// dramatic, high contrast, cinematic finale).
import type { LevelId } from "@/arcade3d/types";
import { HEROES } from "./heroes";

export const COLORS = {
   grey: "#c3cad6",
   greyDark: "#475163",
   base: "#5b6577",
   baseEdge: "#94a3b8",
   rim: "#64748b",
   blot: "#a3aab8",
   blob: "#b0b7c3",
   roller: "#4b5563",
   rollerBand: "#e2e8f0",
   lane: "#f87171",
   ring: "#1f2937",
   ghost: "#c4b5fd",
   gold: "#facc15",
   paint: HEROES.map((h) => h.color) as readonly string[],
} as const;

export interface LevelLook {
   lighting: "day" | "sunset" | "night";
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   skyTop: string;
   skyBottom: string;
   /** the platforms' glowing edge */
   accent: string;
   /** the arena's own fill light (night levels need more to keep the floor readable) */
   fill: number;
}

const LOOKS: Record<LevelId, LevelLook> = {
   1: { lighting: "day", background: "#a9b6c9", fog: "#a9b6c9", fogNear: 45, fogFar: 140, skyTop: "#6f86a8", skyBottom: "#d6deea", accent: "#f8fafc", fill: 0.35 },
   2: { lighting: "day", background: "#9aa8bd", fog: "#9aa8bd", fogNear: 40, fogFar: 130, skyTop: "#5d7194", skyBottom: "#cbd5e1", accent: "#93c5fd", fill: 0.4 },
   3: { lighting: "sunset", background: "#8c7f9a", fog: "#8c7f9a", fogNear: 38, fogFar: 120, skyTop: "#3f3a63", skyBottom: "#f0a97a", accent: "#fbbf24", fill: 0.55 },
   4: { lighting: "night", background: "#2a3042", fog: "#2a3042", fogNear: 32, fogFar: 110, skyTop: "#0f1424", skyBottom: "#46506b", accent: "#f87171", fill: 1.1 },
   5: { lighting: "night", background: "#221c33", fog: "#221c33", fogNear: 34, fogFar: 115, skyTop: "#0b0816", skyBottom: "#5b3a7a", accent: "#e879f9", fill: 1.1 },
};

export function levelLook(id: LevelId): LevelLook {
   return LOOKS[id] ?? LOOKS[1];
}

export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "night" } {
   const l = levelLook(id);
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
