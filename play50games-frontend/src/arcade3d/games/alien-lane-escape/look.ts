// Alien Lane Escape's look: one palette (deep violet ground, neon lilac and cyan glows, acid-green goo,
// the scanner's violet), the sky per level (dusk over the meadow, a crystal-blue route, an ember meteor
// sky, a bioluminescent night, the launch's starfield), the light. Pure.
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   background: "#1e1b4b",
   road: "#3b2a6b",
   roadEdge: "#a855f7",
   laneLine: "#e9d5ff",
   ground: "#2e1065",
   scan: "#a855f7",
   scanCore: "#f5d0fe",
   shadow: "#0b0420",
   shadowEdge: "#22d3ee",
   cave: "#4c1d95",
   ghost: "#c4b5fd",
   mesa: "#5b21b6",
   goo: "#84cc16",
   plantLit: "#67e8f9",
   unseen: "#22d3ee",
   caught: "#f472b6",
   miss: "#ef4444",
} as const;

export interface AlienLight {
   fog: { color: string; near: number; far: number };
   hemi: number;
   ambient: number;
   key: number;
   keyColor: string;
}

/** The light per level. */
export function alienLight(level: LevelId): AlienLight {
   if (level === 2) return { fog: { color: "#312e81", near: 40, far: 150 }, hemi: 0.75, ambient: 0.35, key: 1.05, keyColor: "#c7d2fe" };
   if (level === 3) return { fog: { color: "#431407", near: 38, far: 140 }, hemi: 0.65, ambient: 0.32, key: 1.0, keyColor: "#fed7aa" };
   if (level === 4) return { fog: { color: "#082f49", near: 36, far: 140 }, hemi: 0.6, ambient: 0.3, key: 0.85, keyColor: "#a5f3fc" };
   if (level === 5) return { fog: { color: "#170a2e", near: 40, far: 160 }, hemi: 0.6, ambient: 0.3, key: 0.95, keyColor: "#f5d0fe" };
   return { fog: { color: "#3b0764", near: 42, far: 160 }, hemi: 0.8, ambient: 0.38, key: 1.1, keyColor: "#fbcfe8" };
}

export function levelEnvironment(level: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "night" } {
   const l = alienLight(level);
   return { background: COLORS.background, fog: [l.fog.color, l.fog.near, l.fog.far], lighting: level === 4 || level === 5 ? "night" : "sunset" };
}

/** The sky's three colours per level (top, middle, horizon). */
export function skyColors(level: LevelId): [string, string, string] {
   if (level === 2) return ["#1e1b4b", "#4338ca", "#a5b4fc"];
   if (level === 3) return ["#1c1917", "#7c2d12", "#fb923c"];
   if (level === 4) return ["#020617", "#0c4a6e", "#22d3ee"];
   if (level === 5) return ["#05010f", "#2e1065", "#a21caf"];
   return ["#1e1b4b", "#6d28d9", "#f0abfc"];
}

/** The ground's colour per level. */
export function groundColor(level: LevelId): string {
   if (level === 3) return "#292524";
   if (level === 4) return "#042f2e";
   return COLORS.ground;
}
