// Disc Target Throw's look: one palette (a sunlit ruin courtyard of carved sandstone and jade in a grey
// jungle that turns green as targets break: World 3's colour return) and the per-level mood (the world
// intro's lighting arc: misty morning, green noon, golden hour, blue evening with torches, and a storm
// sky over Mother Snapper). Plain data (index.tsx reads the environment from here).
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   sand: "#cdbb8c",
   sandDark: "#a8966a",
   flag: "#bba876",
   grout: "#8d7c55",
   jade: "#2e9a7a",
   jadeGlow: "#7af0c8",
   moss: "#4ade80",
   mossGrey: "#8a9a86",
   wood: "#7a5532",
   ghost: "#c4b5fd",
   thorn: "#7c2d12",
   thornHot: "#f97316",
   gold: "#f6c453",
   water: "#2f7f86",
   ring: "#ffffff",
   catchRing: "#fde68a",
   idol: ["#4ade80", "#facc15", "#2dd4bf"],
   plate: "#2b2534",
} as const;

export interface LevelLook {
   lighting: "day" | "sunset" | "night";
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   /** the jungle's leaf tint before the colour comes back, and after */
   leafGrey: string;
   leafGreen: string;
   /** torches lit round the walls */
   torches: boolean;
}

const LOOKS: Record<LevelId, LevelLook> = {
   1: { lighting: "day", background: "#c9d6cf", fog: "#c9d6cf", fogNear: 30, fogFar: 85, leafGrey: "#9aa59a", leafGreen: "#3fae5a", torches: false },
   2: { lighting: "day", background: "#b8d8c0", fog: "#b8d8c0", fogNear: 32, fogFar: 90, leafGrey: "#93a194", leafGreen: "#2f9e4e", torches: false },
   3: { lighting: "sunset", background: "#f0c48a", fog: "#e7b884", fogNear: 30, fogFar: 85, leafGrey: "#a39b86", leafGreen: "#5aa83c", torches: false },
   4: { lighting: "night", background: "#1c2a44", fog: "#1f2c45", fogNear: 26, fogFar: 70, leafGrey: "#56606e", leafGreen: "#2f8a52", torches: true },
   5: { lighting: "day", background: "#7d8790", fog: "#7d8790", fogNear: 28, fogFar: 80, leafGrey: "#7e8780", leafGreen: "#36a95c", torches: true },
};

export function levelLook(id: LevelId): LevelLook {
   return LOOKS[id] ?? LOOKS[1];
}

/** The shell's environment for a level (index.tsx). */
export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "night" } {
   const l = levelLook(id);
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
