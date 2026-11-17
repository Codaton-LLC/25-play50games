// Color Orb Defense's look: a floating castle arena over a sea of clouds, the dome beacon glowing at its
// heart, colour zones that ring in their colour and raise a shield when the hero stands on them, and one
// light per level: a clear morning (L1), a golden afternoon (L2), sunset (L3), a stormy dusk for the fast
// waves (L4) and the Mortar's violet night (L5). Plain data (index.tsx reads the environment from here).
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   floor: "#e7e2d6",
   floorDark: "#b9b2a1",
   rim: "#f8fafc",
   lane: "#cbd5e1",
   core: "#38bdf8",
   coreHurt: "#ef4444",
   drone: "#f97316",
   golden: "#fde047",
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
   clouds: string;
   glow: string;
}

export const LEVEL_LOOK: Record<LevelId, LevelLook> = {
   1: { mood: "Clear morning", background: "#bfe3ff", fog: ["#d6ecff", 50, 160], lighting: "day", skyTop: "#5ab0ff", skyBottom: "#eaf6ff", clouds: "#ffffff", glow: "#38bdf8" },
   2: { mood: "Golden afternoon", background: "#f6dfb0", fog: ["#f6e3bd", 50, 160], lighting: "day", skyTop: "#79b6e8", skyBottom: "#fbe6bb", clouds: "#fff3dc", glow: "#fbbf24" },
   3: { mood: "Sunset", background: "#f2a46b", fog: ["#f0b27e", 45, 150], lighting: "sunset", skyTop: "#5b3b8c", skyBottom: "#ffb36b", clouds: "#ffd2b0", glow: "#f472b6" },
   4: { mood: "Stormy dusk", background: "#5b6478", fog: ["#626b80", 40, 140], lighting: "night", skyTop: "#232a3d", skyBottom: "#6b7590", clouds: "#9aa3b8", glow: "#22d3ee" },
   5: { mood: "The Mortar's violet night", background: "#1a0b2e", fog: ["#22103c", 40, 140], lighting: "night", skyTop: "#12021f", skyBottom: "#4b1a6a", clouds: "#4c2f6b", glow: "#e879f9" },
};

export function levelLook(id: number): LevelLook {
   return LEVEL_LOOK[(id >= 1 && id <= 5 ? id : 1) as LevelId];
}

export function levelEnvironment(id: number): { background: string; fog: [string, number, number]; lighting: LevelLook["lighting"] } {
   const look = levelLook(id);
   return { background: look.background, fog: look.fog, lighting: look.lighting };
}
