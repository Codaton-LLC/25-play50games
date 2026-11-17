// Crystal Cave Switch's look (World 5 Neon Cosmos, its crystal caves): dark violet stone, glowing
// crystals, a chasm of mist below. The four crystal colours are read by shape too: ruby triangle,
// sapphire square, emerald diamond, topaz circle. Per-level moods (the card: bright and readable, clean,
// atmospheric, high contrast, cinematic finale).
import type { LevelId } from "@/arcade3d/types";
import type { ColorId } from "./course";

export const COLORS = {
   stone: "#4b4458",
   stoneTop: "#6b6280",
   wall: "#3a3446",
   chasm: "#0d0a1a",
   mist: "#a78bfa",
   gem: ["#ef4444", "#3b82f6", "#22c55e", "#facc15"] as readonly string[],
   ghost: "#c4b5fd",
   high: "#93c5fd",
   lane: "#f472b6",
} as const;

/** The polygon side count of each colour's glyph: triangle, square, diamond (a square on its point), circle. */
export const GLYPH_SIDES: Record<ColorId, number> = { 0: 3, 1: 4, 2: 4, 3: 32 };
export const GLYPH_TURN: Record<ColorId, number> = { 0: Math.PI / 2, 1: Math.PI / 4, 2: 0, 3: 0 };

export interface LevelLook {
   lighting: "day" | "sunset" | "night";
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   skyTop: string;
   skyBottom: string;
}

const LOOKS: Record<LevelId, LevelLook> = {
   1: { lighting: "day", background: "#2a2240", fog: "#2a2240", fogNear: 30, fogFar: 110, skyTop: "#1a1430", skyBottom: "#4c3b78" },
   2: { lighting: "day", background: "#231f3d", fog: "#231f3d", fogNear: 28, fogFar: 100, skyTop: "#14112a", skyBottom: "#3f3870" },
   3: { lighting: "sunset", background: "#1e1530", fog: "#1e1530", fogNear: 22, fogFar: 85, skyTop: "#0f0a1c", skyBottom: "#5b2d6e" },
   4: { lighting: "night", background: "#140f22", fog: "#140f22", fogNear: 20, fogFar: 80, skyTop: "#090612", skyBottom: "#3b1d5e" },
   5: { lighting: "night", background: "#1a0b26", fog: "#1a0b26", fogNear: 26, fogFar: 95, skyTop: "#0b0414", skyBottom: "#6b1d8a" },
};

export function levelLook(id: LevelId): LevelLook {
   return LOOKS[id] ?? LOOKS[1];
}

export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "night" } {
   const l = levelLook(id);
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}
