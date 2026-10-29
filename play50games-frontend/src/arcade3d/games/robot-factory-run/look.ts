// Robot Factory Run's look: one palette (a grey, powered-down factory whose furnaces and belts glow
// red again as the cells come in) and the per-level light. Plain data.
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   background: "#1d1a1c",
   floor: "#3a3836",
   floorLine: "#4a4643",
   steel: "#6b7078",
   dark: "#2a2826",
   red: "#ef4444",
   hot: "#ff7a45",
   gold: "#f6c453",
   plate: "#d6342c",
   plateRim: "#fbbf24",
   wire: "#ff6b4a",
   laser: "#ff2d2d",
   ghost: "#c4b5fd",
   jam: "#9ca3af",
   pad: "#facc15",
   charger: "#ff8a3d",
   arrow: "#ffd9b8",
   klaxon: "#fbbf24",
} as const;

export interface LevelLook {
   fog: string;
   fogNear: number;
   fogFar: number;
   background: string;
   hemi: number;
   ambient: number;
   key: number;
}

const LOOKS: Record<LevelId, LevelLook> = {
   1: { fog: "#2b2524", fogNear: 30, fogFar: 90, background: "#221d1d", hemi: 0.95, ambient: 0.45, key: 1.25 },
   2: { fog: "#2a2423", fogNear: 30, fogFar: 90, background: "#211c1c", hemi: 0.92, ambient: 0.42, key: 1.2 },
   3: { fog: "#282221", fogNear: 28, fogFar: 85, background: "#1f1a1a", hemi: 0.9, ambient: 0.4, key: 1.15 },
   4: { fog: "#251f20", fogNear: 28, fogFar: 85, background: "#1c1718", hemi: 0.85, ambient: 0.38, key: 1.1 },
   5: { fog: "#2a1a1a", fogNear: 26, fogFar: 80, background: "#211414", hemi: 0.85, ambient: 0.36, key: 1.05 },
};

export function levelLook(id: LevelId): LevelLook {
   return LOOKS[id] ?? LOOKS[1];
}

export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "indoor" } {
   const l = levelLook(id);
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: "indoor" };
}
