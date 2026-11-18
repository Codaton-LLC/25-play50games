// Temple Lantern Jump's look: one palette (a dark jungle-temple shaft, warm lantern gold and ember
// orange, moss green where the light has been) and the per-level mood. Plain data (index.tsx reads the
// environment from here). The phone quality tier lifts the ambient light by 20 % (README "Phones"):
// timings stay identical (fairness).
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   background: "#0a1410",
   fog: "#0f1c17",
   wall: "#12231c",
   wallStripe: "#1a3228",
   stone: "#b6a779",
   stoneDark: "#6d6347",
   rim: "#8f8a6a",
   gold: "#f6c453",
   glyph: "#ffd36a",
   ember: "#ff9a3c",
   emberHot: "#ffd9a0",
   lantern: "#ffb347",
   moss: "#4ade80",
   wood: "#8a5a2b",
   ghost: "#c4b5fd",
   jet: "#ff6a2a",
   leaf: "#7ccf6a",
   queen: "#8d8498",
   eye: "#ff4d4d",
} as const;

export interface LevelLook {
   fog: string;
   fogNear: number;
   fogFar: number;
   background: string;
   /** the always-on ambient light (very dark: the light is the game) */
   ambient: number;
   /** the cold fill from above */
   hemi: number;
   /** the wall's brightness */
   wall: number;
}

const LOOKS: Record<LevelId, LevelLook> = {
   1: { fog: "#10201a", fogNear: 14, fogFar: 46, background: "#0b1612", ambient: 0.32, hemi: 0.4, wall: 1 },
   2: { fog: "#101e1d", fogNear: 13, fogFar: 44, background: "#0a1514", ambient: 0.3, hemi: 0.38, wall: 0.95 },
   3: { fog: "#17201a", fogNear: 13, fogFar: 42, background: "#0d140f", ambient: 0.3, hemi: 0.36, wall: 0.95 },
   4: { fog: "#0c1424", fogNear: 12, fogFar: 40, background: "#080e1b", ambient: 0.27, hemi: 0.34, wall: 0.85 },
   5: { fog: "#1e1a12", fogNear: 14, fogFar: 46, background: "#120e08", ambient: 0.3, hemi: 0.36, wall: 0.9 },
};

export function levelLook(id: LevelId): LevelLook {
   return LOOKS[id] ?? LOOKS[1];
}

/** The shell's environment for a level (index.tsx). */
export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "night" } {
   const l = levelLook(id);
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: "night" };
}
