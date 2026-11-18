// Color Door Sprint's look per level (pure data, no three.js): World 1 Ember Heights, red. The Hall of
// Doors is a warm stone hall under an ember sky; it starts drained of colour and warms up as the true
// doors are taken (the World 1 restore). Level 1 a warm evening, 2 a red dusk, 3 a smoky late dusk
// with the cracked doors' glow, 4 a hot dusk (speed lines), 5 Flicker's furnace red.
import type { LevelId } from "@/arcade3d/types";

export interface HallLook {
   skyTop: string;
   skyBottom: string;
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   floor: string;
   floorLine: string;
   stone: string;
   trim: string;
   ember: string;
   lighting: "day" | "sunset" | "night";
}

export const LOOKS: Record<LevelId, HallLook> = {
   1: { skyTop: "#3b1d4a", skyBottom: "#f59e6b", background: "#c9735a", fog: "#d48466", fogNear: 40, fogFar: 170, floor: "#5b4a44", floorLine: "#f6c18b", stone: "#b9a08c", trim: "#7f1d1d", ember: "#fb923c", lighting: "sunset" },
   2: { skyTop: "#2a1238", skyBottom: "#e2674a", background: "#a8503f", fog: "#b85a44", fogNear: 38, fogFar: 160, floor: "#4d3c38", floorLine: "#fca5a5", stone: "#a98f7c", trim: "#991b1b", ember: "#f97316", lighting: "sunset" },
   3: { skyTop: "#160d22", skyBottom: "#7c2d2a", background: "#4a2026", fog: "#55252a", fogNear: 34, fogFar: 150, floor: "#4a3a36", floorLine: "#fdba74", stone: "#a08a7a", trim: "#b91c1c", ember: "#fb923c", lighting: "sunset" },
   4: { skyTop: "#1a0b1c", skyBottom: "#9a2c1f", background: "#5a1e1a", fog: "#6a2620", fogNear: 40, fogFar: 175, floor: "#463430", floorLine: "#fed7aa", stone: "#a88d78", trim: "#dc2626", ember: "#fdba74", lighting: "sunset" },
   5: { skyTop: "#2a0606", skyBottom: "#e2401c", background: "#7a1d12", fog: "#8a2414", fogNear: 36, fogFar: 160, floor: "#3b2522", floorLine: "#fb923c", stone: "#8c6a5a", trim: "#ef4444", ember: "#fde047", lighting: "sunset" },
};

/** The drained look before the hall warms up (mixed by restoreAmount). */
export const GREY = { stone: "#8a8580", floor: "#4a4846", trim: "#575250" } as const;

export const COLORS = {
   background: LOOKS[1].background,
   gold: "#ffd257",
   ember: "#fb923c",
   wrong: "#94a3b8",
   ghost: "#c4b5fd",
   shield: "#86efac",
} as const;

export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "night" } {
   const l = LOOKS[id];
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}

/** How much of the colour has come back (0..1): a third at the start, all of it by the last wall. */
export function restoreAmount(trueDoors: number, walls: number): number {
   if (!(walls > 0)) return 1;
   return 0.35 + 0.65 * Math.min(1, trueDoors / walls);
}
