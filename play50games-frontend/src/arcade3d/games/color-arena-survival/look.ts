// Color Arena Survival's look: World 6 "Prism Fortress" (Shadow Plates' fortress of colour switches and
// arenas). A crystal arena floating over a glowing pit, the fortress gate beyond it, prism shards
// drifting round, the sky shifting from a bright morning (L1) to a cinematic dusk (L5). Gameplay reads by
// SHAPE as well as hue: every tile colour has its own symbol (circle, square, triangle, star, diamond),
// the HUD's call chip carries the same symbol, and the wrong tiles fade dark before they drop. Plain data.
import type { LevelId } from "@/arcade3d/types";

/** The five tile colours (the heroes' own) and the rainbow tile's base. */
export const TILE_COLORS = ["#ef4444", "#2563eb", "#22c55e", "#facc15", "#8b5cf6", "#ffffff"] as const;
/** A brighter twin of each colour (the called tiles' pulse, the beacon's halo, the HUD chip). */
export const TILE_GLOWS = ["#fca5a5", "#93c5fd", "#86efac", "#fde68a", "#c4b5fd", "#ffffff"] as const;
/** Each colour's symbol (look.ts SYMBOLS order), drawn on its tiles and on the HUD chip. */
export const SYMBOLS = ["circle", "square", "triangle", "star", "diamond"] as const;
export type SymbolId = (typeof SYMBOLS)[number];

export const COLORS = {
   stone: "#cbd5e1",
   stoneDark: "#475569",
   rim: "#e2e8f0",
   rimGlow: "#f0abfc",
   crack: "#1f2937",
   hole: "#0f172a",
   pit: "#7c3aed",
   orb: "#c084fc",
   gold: "#fde68a",
   safe: "#22d3ee",
   shock: "#f472b6",
   keeper: "#e879f9",
   keeperGlow: "#67e8f9",
   prism: "#f9a8d4",
} as const;

export interface LevelLook {
   lighting: "day" | "sunset" | "night";
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   /** the sky gradient (World.tsx) */
   skyTop: string;
   skyBottom: string;
   /** the pit's glow under the arena */
   pit: string;
   /** the arena rim's glow strip */
   rim: string;
   /** extra fill light (ambient) so the tiles read at a glance */
   fill: number;
}

const LOOKS: Record<LevelId, LevelLook> = {
   1: { lighting: "day", background: "#bfdbfe", fog: "#dbeafe", fogNear: 60, fogFar: 170, skyTop: "#60a5fa", skyBottom: "#fbcfe8", pit: "#a78bfa", rim: "#f0abfc", fill: 0.35 },
   2: { lighting: "day", background: "#c7d2fe", fog: "#e0e7ff", fogNear: 55, fogFar: 160, skyTop: "#6366f1", skyBottom: "#fde68a", pit: "#8b5cf6", rim: "#67e8f9", fill: 0.3 },
   3: { lighting: "sunset", background: "#fbcfe8", fog: "#f5d0fe", fogNear: 50, fogFar: 150, skyTop: "#7c3aed", skyBottom: "#fb923c", pit: "#c026d3", rim: "#fde68a", fill: 0.35 },
   4: { lighting: "night", background: "#1e1b4b", fog: "#2e1065", fogNear: 45, fogFar: 140, skyTop: "#0f0a2e", skyBottom: "#7e22ce", pit: "#e879f9", rim: "#22d3ee", fill: 0.6 },
   5: { lighting: "night", background: "#170b2e", fog: "#2a0e3f", fogNear: 45, fogFar: 140, skyTop: "#05010f", skyBottom: "#be185d", pit: "#f472b6", rim: "#f0abfc", fill: 0.65 },
};

export function levelLook(id: LevelId): LevelLook {
   return LOOKS[id] ?? LOOKS[1];
}

/** The shell's environment for a level (index.tsx). */
export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "night" } {
   const l = levelLook(id);
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
