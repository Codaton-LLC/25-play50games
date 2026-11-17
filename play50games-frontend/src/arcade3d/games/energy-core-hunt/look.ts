// Energy Core Hunt's look: the five core colours (the heroes' own: red, blue, green, yellow, purple, each
// strong and distinct), a dark teal reactor floor, the gate's open green, the light per level (bright and
// readable on level 1, more dramatic towards the finale, the cores always the brightest thing). Pure.
import type { LevelId } from "@/arcade3d/types";

/** The cores' colours, by colour index (course.ts COLOR_NAMES). */
export const CORE_COLORS = ["#ff3b4e", "#3b82f6", "#22c55e", "#facc15", "#a855f7"] as const;

export const COLORS = {
   background: "#0b1220",
   floor: "#18212f",
   open: "#4ade80",
   sealed: "#ef4444",
} as const;

export interface CoreLight {
   fog: { color: string; near: number; far: number };
   hemi: number;
   ambient: number;
   key: number;
}

export function coreLight(level: LevelId): CoreLight {
   if (level === 1) return { fog: { color: "#1e293b", near: 30, far: 90 }, hemi: 1.0, ambient: 0.5, key: 1.25 };
   if (level === 2) return { fog: { color: "#172033", near: 30, far: 90 }, hemi: 0.9, ambient: 0.45, key: 1.1 };
   if (level === 3) return { fog: { color: "#13132b", near: 28, far: 85 }, hemi: 0.75, ambient: 0.36, key: 1.0 };
   if (level === 4) return { fog: { color: "#0d0c1f", near: 26, far: 80 }, hemi: 0.65, ambient: 0.3, key: 0.95 };
   return { fog: { color: "#1a0b2e", near: 28, far: 90 }, hemi: 0.7, ambient: 0.32, key: 1.0 };
}

export function levelEnvironment(level: LevelId): { background: string; fog: [string, number, number]; lighting: "indoor" | "night" } {
   const l = coreLight(level);
   return { background: COLORS.background, fog: [l.fog.color, l.fog.near, l.fog.far], lighting: level <= 2 ? "indoor" : "night" };
}

/** The accent per level (the arena's rim and the floor seams). */
export function accentFor(level: LevelId): string {
   return ["#2dd4bf", "#38bdf8", "#818cf8", "#f472b6", "#e879f9"][level - 1];
}
