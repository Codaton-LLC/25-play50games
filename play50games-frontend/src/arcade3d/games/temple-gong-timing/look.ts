// Temple Gong Timing's look: one palette (ashen ruin stone, bronze gongs, jade inlays, the moss and
// flowers that grow back with every Perfect) and the per-level mood of the World 3 card: misty morning,
// green noon, golden hour, blue night with torches, and level 5's storm sky that breaks into sun on the
// finish. Plain data.
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   stone: "#b7a98a",
   stoneDark: "#6f6550",
   ash: "#9b9a92",
   bronze: "#c08a3c",
   jade: "#34d399",
   jadeDark: "#0f766e",
   moss: "#4ade80",
   flower: "#f9a8d4",
   flowerGold: "#fde68a",
   ring: "#fef3c7",
   perfect: "#4ade80",
   good: "#fde68a",
   miss: "#f87171",
   echo: "#86efac",
   shock: "#a78bfa",
   ghost: "#c4b5fd",
   call: "#ffb347",
   torch: "#ffb347",
} as const;

export interface LevelLook {
   lighting: "day" | "sunset" | "night";
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   skyTop: string;
   skyBottom: string;
   torches: boolean;
}

const LOOKS: Record<LevelId, LevelLook> = {
   1: { lighting: "day", background: "#b9c7c0", fog: "#c4d0c8", fogNear: 24, fogFar: 70, skyTop: "#9fb8b0", skyBottom: "#dfe7df", torches: false },
   2: { lighting: "day", background: "#8fc7a2", fog: "#a7d3b1", fogNear: 26, fogFar: 78, skyTop: "#5fa98a", skyBottom: "#d6f0c8", torches: false },
   3: { lighting: "sunset", background: "#e2a86a", fog: "#e8b880", fogNear: 24, fogFar: 74, skyTop: "#d8875a", skyBottom: "#fbe0a6", torches: false },
   4: { lighting: "night", background: "#0e1a33", fog: "#13223f", fogNear: 22, fogFar: 66, skyTop: "#0a1430", skyBottom: "#2a3d63", torches: true },
   5: { lighting: "sunset", background: "#5b6470", fog: "#6c7480", fogNear: 22, fogFar: 70, skyTop: "#3d4552", skyBottom: "#9aa3ad", torches: true },
};

export function levelLook(id: LevelId): LevelLook {
   return LOOKS[id] ?? LOOKS[1];
}

export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "night" } {
   const l = levelLook(id);
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
