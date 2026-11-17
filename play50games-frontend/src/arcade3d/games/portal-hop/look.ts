// Portal Hop's look: World 5 "Neon Cosmos" (the card): a deep violet void with a faint cyan grid on the
// horizon, floating ruins, a ringed planet; grey glass with dead edge strips that light up purple, then
// cyan, then magenta as the colour returns. Gameplay states read by SHAPE and FILL, never by hue alone:
// the selected exit is a filled frame with a ring, an unselected anchor a hollow outline; a closed
// (moving) exit is drawn as a wireframe. Plain data.
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   violet: "#7c3aed",
   violetDeep: "#2e1065",
   purple: "#a855f7",
   cyan: "#22d3ee",
   magenta: "#e879f9",
   glass: "#94a3b8",
   glassDark: "#334155",
   entry: "#a855f7",
   exit: "#22d3ee",
   arc: "#67e8f9",
   orb: "#c084fc",
   beacon: "#f0abfc",
   laser: "#fb7185",
   gold: "#fde68a",
   plate: "#facc15",
   wyrm: "#6d28d9",
   wyrmGlow: "#22d3ee",
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
   /** the horizon grid's colour and the stars' density 0..1 */
   grid: string;
   stars: number;
   /** the edge strips' colour (the colour returning, level by level) */
   edge: string;
}

const LOOKS: Record<LevelId, LevelLook> = {
   1: { lighting: "night", background: "#1e1b4b", fog: "#231d55", fogNear: 40, fogFar: 140, skyTop: "#0b0726", skyBottom: "#3b2a7a", grid: "#22d3ee", stars: 0.6, edge: "#a855f7" },
   2: { lighting: "night", background: "#1a1446", fog: "#20184f", fogNear: 40, fogFar: 150, skyTop: "#090522", skyBottom: "#46307f", grid: "#22d3ee", stars: 0.7, edge: "#a855f7" },
   3: { lighting: "night", background: "#14123d", fog: "#1b1748", fogNear: 40, fogFar: 140, skyTop: "#05031a", skyBottom: "#2c3a85", grid: "#67e8f9", stars: 0.85, edge: "#22d3ee" },
   4: { lighting: "night", background: "#1b1040", fog: "#24154e", fogNear: 36, fogFar: 130, skyTop: "#0a0420", skyBottom: "#5b2a7e", grid: "#e879f9", stars: 0.7, edge: "#22d3ee" },
   5: { lighting: "night", background: "#120a2e", fog: "#1a0f3a", fogNear: 34, fogFar: 120, skyTop: "#05010f", skyBottom: "#3d1660", grid: "#e879f9", stars: 1, edge: "#e879f9" },
};

export function levelLook(id: LevelId): LevelLook {
   return LOOKS[id] ?? LOOKS[1];
}

/** The shell's environment for a level (index.tsx). */
export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "night" } {
   const l = levelLook(id);
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
