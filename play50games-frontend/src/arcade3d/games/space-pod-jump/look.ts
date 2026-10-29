// Space Pod Jump's look per level (pure data, no three.js): World 5 Neon Cosmos, purple. A deep violet
// void with a faint cyan grid on the horizon, a ringed planet far behind, the Hollow Prism watching from
// the sky. Shadow Plates drained the colour: a body's halo is grey glass until the hero first lands on it,
// then it lights purple, then cyan, then magenta (the World 5 restore). Gameplay states read by shape
// and fill (solid vs dashed), never by hue alone.
import type { LevelId } from "@/arcade3d/types";

export interface CosmosLook {
   skyTop: string;
   skyBottom: string;
   grid: string;
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   halo: string;
   haloLit: string;
   stars: string;
   lighting: "day" | "sunset" | "night";
}

export const LOOKS: Record<LevelId, CosmosLook> = {
   1: { skyTop: "#0b0420", skyBottom: "#2a1250", grid: "#38e8ff", background: "#140829", fog: "#1a0c33", fogNear: 70, fogFar: 260, halo: "#6b6880", haloLit: "#b26bff", stars: "#e9ddff", lighting: "night" },
   2: { skyTop: "#090322", skyBottom: "#24104a", grid: "#4ff0ff", background: "#120726", fog: "#170a30", fogNear: 70, fogFar: 260, halo: "#686478", haloLit: "#9c5cff", stars: "#e0e8ff", lighting: "night" },
   3: { skyTop: "#08061e", skyBottom: "#1c1550", grid: "#5cf5d0", background: "#100a28", fog: "#140d32", fogNear: 70, fogFar: 260, halo: "#626274", haloLit: "#4fd8ff", stars: "#d8f4ff", lighting: "night" },
   4: { skyTop: "#05031a", skyBottom: "#160b3a", grid: "#ff5cd8", background: "#0c0620", fog: "#100828", fogNear: 60, fogFar: 240, halo: "#5c5a6c", haloLit: "#ff6ad5", stars: "#ffe0f6", lighting: "night" },
   5: { skyTop: "#100218", skyBottom: "#3a0f4a", grid: "#ff7ae6", background: "#16061f", fog: "#1c0828", fogNear: 70, fogFar: 260, halo: "#605870", haloLit: "#e05cff", stars: "#ffe8ff", lighting: "night" },
};

export const COLORS = {
   background: LOOKS[1].background,
   arc: "#7ee8ff",
   arcLock: "#7dff9b",
   arcBad: "#ff6a7a",
   capture: "#c4b5fd",
   fuel: "#38e8ff",
   charge: "#f5c542",
   shield: "#86efac",
} as const;

export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "night" } {
   const l = LOOKS[id];
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
