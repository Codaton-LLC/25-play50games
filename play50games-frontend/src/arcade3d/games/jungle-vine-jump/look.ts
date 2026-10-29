// Jungle Vine Jump's look: one palette (a giant jungle tree in green light, warm bark, live green vines,
// dry brown ones, emerald glints) and the per-level mood: L1 a bright morning, L2 noon through the
// leaves, L3 a dry gold afternoon, L4 green mist over the ruins, L5 sunset in the canopy. Plain data
// (index.tsx reads the environment from here).
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   bark: "#6b4a2b",
   barkDark: "#3f2b18",
   barkLight: "#8b6440",
   moss: "#4f8a3c",
   vine: "#3f9a3a",
   vineDark: "#2d6e2a",
   dry: "#9a7a46",
   dryDark: "#6e5430",
   glow: "#5eead4",
   leaf: "#5cb85c",
   orb: "#4ade80",
   emerald: "#34d399",
   pod: "#f59e0b",
   ghost: "#c4b5fd",
   arc: "#fef3c7",
   king: "#8f8a94",
   plates: "#2b2633",
   eye: "#ffcf4d",
} as const;

export interface LevelLook {
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   lighting: "day" | "sunset";
   /** the sky gradient behind the leaves */
   skyTop: string;
   skyBottom: string;
   /** the sun's warmth and strength (World.tsx) */
   sun: string;
   sunIntensity: number;
   ambient: number;
   /** falling leaves per second (World.tsx) */
   leaves: number;
}

const LOOKS: Record<LevelId, LevelLook> = {
   1: { background: "#a7d8b0", fog: "#b5dfbd", fogNear: 30, fogFar: 95, lighting: "day", skyTop: "#7cc7e8", skyBottom: "#d9f2d4", sun: "#fff4d6", sunIntensity: 1.6, ambient: 0.55, leaves: 6 },
   2: { background: "#9ccf8e", fog: "#a9d79b", fogNear: 28, fogFar: 90, lighting: "day", skyTop: "#5fb6e0", skyBottom: "#cdeec0", sun: "#fffbe8", sunIntensity: 1.8, ambient: 0.5, leaves: 10 },
   3: { background: "#d6c58a", fog: "#dccb94", fogNear: 26, fogFar: 85, lighting: "sunset", skyTop: "#e7b866", skyBottom: "#f2e2b0", sun: "#ffd28a", sunIntensity: 1.5, ambient: 0.5, leaves: 14 },
   4: { background: "#7fa08a", fog: "#8fb09a", fogNear: 18, fogFar: 70, lighting: "day", skyTop: "#6e8f86", skyBottom: "#b8cdbb", sun: "#e8f1e0", sunIntensity: 1.2, ambient: 0.62, leaves: 8 },
   5: { background: "#e19a6a", fog: "#d99a74", fogNear: 26, fogFar: 88, lighting: "sunset", skyTop: "#7a4b8f", skyBottom: "#f4a96a", sun: "#ffb27a", sunIntensity: 1.5, ambient: 0.48, leaves: 12 },
};

export function levelLook(id: LevelId): LevelLook {
   return LOOKS[id] ?? LOOKS[1];
}

/** The shell's environment for a level (index.tsx). */
export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" } {
   const l = levelLook(id);
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
