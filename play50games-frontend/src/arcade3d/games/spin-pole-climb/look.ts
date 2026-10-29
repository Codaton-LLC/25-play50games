// Spin Pole Climb's look: one palette (ashen jungle stone, jade inlays, moss that turns green where you
// have climbed, warm torch gold) and the per-level mood the World 3 card asks for: misty morning, green
// noon, golden hour, blue night with torches, and a storm-grey sky for Coilstone. Plain data.
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   stone: "#b7a98a",
   stoneDark: "#7d7158",
   stoneAsh: "#8f8b80",
   jade: "#34d399",
   jadeDark: "#0f766e",
   moss: "#4ade80",
   mossGrey: "#9aa59a",
   gold: "#f6c453",
   torch: "#ffb347",
   step: "#c9b88f",
   stepEdge: "#6b5b3a",
   spike: "#d9d4c7",
   spore: "#a3e635",
   veil: "#bef264",
   sweeper: "#8a6a3a",
   ghost: "#c4b5fd",
   urn: "#a8784a",
   orb: "#4ade80",
   coil: "#2f6f55",
   coilSand: "#c9a76a",
   plate: "#2b2238",
   plateGlow: "#a78bfa",
   with: "#4ade80",
   against: "#f87171",
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
   /** torches burn on the poles (night, storm) */
   torches: boolean;
   /** mist drifting between the poles, 0..1 */
   mist: number;
}

const LOOKS: Record<LevelId, LevelLook> = {
   1: { lighting: "day", background: "#b9c7c0", fog: "#c4d0c8", fogNear: 22, fogFar: 70, skyTop: "#9fb8b0", skyBottom: "#dfe7df", torches: false, mist: 0.6 },
   2: { lighting: "day", background: "#8fc7a2", fog: "#a7d3b1", fogNear: 26, fogFar: 80, skyTop: "#5fa98a", skyBottom: "#d6f0c8", torches: false, mist: 0.2 },
   3: { lighting: "sunset", background: "#e2a86a", fog: "#e8b880", fogNear: 24, fogFar: 78, skyTop: "#d8875a", skyBottom: "#fbe0a6", torches: false, mist: 0.25 },
   4: { lighting: "night", background: "#0e1a33", fog: "#13223f", fogNear: 20, fogFar: 70, skyTop: "#0a1430", skyBottom: "#2a3d63", torches: true, mist: 0.3 },
   5: { lighting: "sunset", background: "#5b6470", fog: "#6c7480", fogNear: 20, fogFar: 72, skyTop: "#3d4552", skyBottom: "#9aa3ad", torches: true, mist: 0.45 },
};

export function levelLook(id: LevelId): LevelLook {
   return LOOKS[id] ?? LOOKS[1];
}

/** The shell's environment for a level (index.tsx). */
export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "night" } {
   const l = levelLook(id);
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
