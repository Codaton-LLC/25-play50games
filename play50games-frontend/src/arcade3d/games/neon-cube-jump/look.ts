// Neon Cube Jump's look (World 5 Neon Cosmos): a deep violet void over a faint cyan grid, neon city
// silhouettes on the horizon and a ringed planet in the sky. Set A glows purple with a square glyph,
// set B cyan with a triangle, rogue cubes magenta with a ring, neutral cubes pale glass. Readability:
// a state is shown by shape and fill (a solid cube vs a wireframe hologram, a filled vs an outlined
// glyph), never by hue alone. Per-level moods brighten as the colour returns.
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   a: "#a855f7",
   aDeep: "#6d28d9",
   b: "#22d3ee",
   bDeep: "#0e7490",
   rogue: "#f472b6",
   neutral: "#e2e8f0",
   holo: "#c4b5fd",
   grid: "#22d3ee",
   void: "#0b0620",
   laserA: "#c084fc",
   laserB: "#67e8f9",
   ghost: "#c4b5fd",
   shard: "#fde68a",
   preview: "#ffffff",
} as const;

export interface LevelLook {
   lighting: "day" | "sunset" | "night";
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   skyTop: string;
   skyBottom: string;
   /** the horizon grid's glow 0..1 */
   grid: number;
   planet: string;
}

const LOOKS: Record<LevelId, LevelLook> = {
   1: { lighting: "night", background: "#140a2e", fog: "#1a0f3a", fogNear: 40, fogFar: 140, skyTop: "#0b0620", skyBottom: "#3b1d6e", grid: 0.55, planet: "#a78bfa" },
   2: { lighting: "night", background: "#0f1030", fog: "#141a40", fogNear: 40, fogFar: 140, skyTop: "#080a22", skyBottom: "#1e3a6e", grid: 0.65, planet: "#67e8f9" },
   3: { lighting: "night", background: "#1d0a2a", fog: "#26103a", fogNear: 38, fogFar: 130, skyTop: "#0d0418", skyBottom: "#5b1a5e", grid: 0.7, planet: "#f0abfc" },
   4: { lighting: "night", background: "#0a0618", fog: "#120a28", fogNear: 34, fogFar: 120, skyTop: "#05030f", skyBottom: "#2a0f4a", grid: 0.8, planet: "#c084fc" },
   5: { lighting: "night", background: "#180826", fog: "#200a33", fogNear: 36, fogFar: 130, skyTop: "#0a0314", skyBottom: "#6b1d8a", grid: 1, planet: "#f472b6" },
};

export function levelLook(id: LevelId): LevelLook {
   return LOOKS[id] ?? LOOKS[1];
}

/** The shell's environment for a level (index.tsx). */
export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "night" } {
   const l = levelLook(id);
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}

/** The colour of a set (glyph, glow, tint). */
export function setColor(set: "A" | "B" | "N" | "R"): string {
   return set === "A" ? COLORS.a : set === "B" ? COLORS.b : set === "R" ? COLORS.rogue : COLORS.neutral;
}
