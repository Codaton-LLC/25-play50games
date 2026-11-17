// Switch Color Hero's look: a floating neon track over a sci-fi city of spires, the gates' energy fields
// in the five hero colours (each with its shape), and one light per level (the card's arc): bright and
// readable (L1), natural with more mood (L2), dramatic dusk (L3), high-contrast night (L4) and Chroma's
// cinematic overdrive (L5). Plain data (index.tsx reads the environment from here).
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   track: "#1e293b",
   trackEdge: "#e2e8f0",
   lane: "#38bdf8",
   gap: "#0f172a",
   beam: "#f43f5e",
   sweeper: "#fb923c",
   block: "#f472b6",
   pickup: "#fde047",
   checkpoint: "#4ade80",
   finish: "#ffffff",
   chroma: "#a5f3fc",
   shield: "#86efac",
   phase: "#c4b5fd",
} as const;

export interface LevelLook {
   mood: string;
   background: string;
   fog: [string, number, number];
   lighting: "day" | "sunset" | "night";
   skyTop: string;
   skyBottom: string;
   /** the lane strips' glow and the spires' window light */
   glow: string;
   /** the city's haze far below */
   city: string;
}

export const LEVEL_LOOK: Record<LevelId, LevelLook> = {
   1: { mood: "Bright and readable", background: "#bfe3ff", fog: ["#cfe9ff", 60, 220], lighting: "day", skyTop: "#5ab0ff", skyBottom: "#e6f4ff", glow: "#38bdf8", city: "#94a3b8" },
   2: { mood: "Natural, a little mood", background: "#a8d8c8", fog: ["#bfe3d6", 55, 200], lighting: "day", skyTop: "#3f9e8f", skyBottom: "#e2f5ea", glow: "#34d399", city: "#7c9a8f" },
   3: { mood: "Dramatic dusk", background: "#f2a46b", fog: ["#f0b27e", 50, 190], lighting: "sunset", skyTop: "#5b3b8c", skyBottom: "#ffb36b", glow: "#f472b6", city: "#7a5a7a" },
   4: { mood: "High-contrast night", background: "#0d1530", fog: ["#121c3d", 45, 170], lighting: "night", skyTop: "#050a1f", skyBottom: "#24306b", glow: "#22d3ee", city: "#1e2a55" },
   5: { mood: "Color overdrive", background: "#1a0b2e", fog: ["#22103c", 45, 170], lighting: "night", skyTop: "#12021f", skyBottom: "#5b1a7a", glow: "#e879f9", city: "#2d1650" },
};

export function levelLook(id: number): LevelLook {
   return LEVEL_LOOK[(id >= 1 && id <= 5 ? id : 1) as LevelId];
}

export function levelEnvironment(id: number): { background: string; fog: [string, number, number]; lighting: LevelLook["lighting"] } {
   const look = levelLook(id);
   return { background: look.background, fog: look.fog, lighting: look.lighting };
}
