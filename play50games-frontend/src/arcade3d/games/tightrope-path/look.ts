// Tightrope Path's look: one palette (a misty green jungle gorge: mossy rock pillars, old wood, bronze
// pole caps, a jade river far below) and the per-level mood (morning mist, a windy noon, golden hour,
// night fog lit by lookout-tower torches, and a storm-grey dusk for Umbra). Plain data.
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   rope: "#c9a66b",
   ropeDash: "#c2410c",
   wood: "#8a6a42",
   rock: "#8d8a7a",
   rockTop: "#a39f8a",
   moss: "#4ade80",
   leaf: "#3fae5a",
   river: "#2f7f86",
   mist: "#e7f0ea",
   ghost: "#c4b5fd",
   gust: "#d9f99d",
   torch: "#ffb347",
   umbra: "#3b3355",
   needleOk: "#4ade80",
   needleWarn: "#facc15",
   needleBad: "#f87171",
} as const;

export interface LevelLook {
   lighting: "day" | "sunset" | "night";
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   skyTop: string;
   skyBottom: string;
   /** the mist layers' opacity under the walk */
   mist: number;
   torches: boolean;
}

const LOOKS: Record<LevelId, LevelLook> = {
   1: { lighting: "day", background: "#cfe3d6", fog: "#cfe3d6", fogNear: 30, fogFar: 110, skyTop: "#7fb8d8", skyBottom: "#e2efe6", mist: 0.5, torches: false },
   2: { lighting: "day", background: "#c3dccb", fog: "#c3dccb", fogNear: 28, fogFar: 100, skyTop: "#6fa9cf", skyBottom: "#d9ebdf", mist: 0.55, torches: false },
   3: { lighting: "sunset", background: "#f0c48a", fog: "#e9bb88", fogNear: 26, fogFar: 95, skyTop: "#e48b5a", skyBottom: "#f7d7a4", mist: 0.45, torches: false },
   4: { lighting: "night", background: "#101a2c", fog: "#16223a", fogNear: 4, fogFar: 17, skyTop: "#0b1424", skyBottom: "#1e2c48", mist: 0.35, torches: true },
   5: { lighting: "day", background: "#7d8790", fog: "#7d8790", fogNear: 24, fogFar: 90, skyTop: "#4f5967", skyBottom: "#a3abb2", mist: 0.6, torches: true },
};

export function levelLook(id: LevelId): LevelLook {
   return LOOKS[id] ?? LOOKS[1];
}

/** The shell's environment for a level (index.tsx). */
export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "night" } {
   const l = levelLook(id);
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
