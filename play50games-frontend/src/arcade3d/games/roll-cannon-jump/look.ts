// Roll Cannon Jump's look: one palette (a drained, ash-grey circus whose red comes back) and the
// per-level light under the big top. Plain data (index.tsx reads the environment from here).
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   background: "#2a2320",
   fog: "#3a302a",
   ash: "#6f6a66",
   cream: "#efe3cc",
   red: "#d8342c",
   gold: "#f6c453",
   brass: "#c99a3c",
   pole: "#8a8178",
   crowdGrey: "#5a5550",
   crowdRed: "#e0473b",
   stand: "#5a524b",
   standTop: "#d9cdb7",
   flame: "#ff8a2a",
   smoke: "#9aa0a6",
   ghost: "#c4b5fd",
   board: "#e9dcc2",
   aim: "#ffe9a8",
   ghostArc: "#a8b3c7",
} as const;

export interface LevelLook {
   fog: string;
   fogNear: number;
   fogFar: number;
   background: string;
   sky: string;
   ground: string;
   hemi: number;
   ambient: number;
   key: number;
   point: number;
   /** the canvas brightness */
   canvas: number;
}

const LOOKS: Record<LevelId, LevelLook> = {
   1: { fog: "#3d332c", fogNear: 40, fogFar: 150, background: "#2c2420", sky: "#ffe8c8", ground: "#5a4a3c", hemi: 1.05, ambient: 0.45, key: 1.2, point: 40, canvas: 1 },
   2: { fog: "#3a3029", fogNear: 40, fogFar: 150, background: "#2a221e", sky: "#ffe2c0", ground: "#584536", hemi: 1.0, ambient: 0.42, key: 1.15, point: 40, canvas: 0.97 },
   3: { fog: "#352c27", fogNear: 36, fogFar: 140, background: "#261f1b", sky: "#ffd9b5", ground: "#523f32", hemi: 0.95, ambient: 0.4, key: 1.1, point: 45, canvas: 0.92 },
   4: { fog: "#2f2724", fogNear: 40, fogFar: 160, background: "#221b18", sky: "#ffd0aa", ground: "#4a382d", hemi: 0.9, ambient: 0.38, key: 1.05, point: 50, canvas: 0.86 },
   5: { fog: "#2a2221", fogNear: 34, fogFar: 130, background: "#1e1817", sky: "#ffc9a0", ground: "#46352b", hemi: 0.88, ambient: 0.36, key: 1.0, point: 55, canvas: 0.8 },
};

export function levelLook(id: LevelId): LevelLook {
   return LOOKS[id] ?? LOOKS[1];
}

/** The shell's environment for a level (index.tsx). */
export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "indoor" } {
   const l = levelLook(id);
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: "indoor" };
}
