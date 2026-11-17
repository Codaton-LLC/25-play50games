// Laser Maze Run's look: one palette (graphite vault, the red of a live beam, an amber low beam to
// jump, magenta gates, violet cages, green safe pads and opened switches, cyan accents) and the light
// per level, brighter and plainer on level 1, harder and darker towards the finale. Pure.
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   background: "#0b1020",
   floor: "#1e2433",
   grid: "#38bdf8",
   wallTrim: "#22d3ee",
   beam: "#ff2d55",
   low: "#ffb020",
   gate: "#ff3df2",
   cage: "#a855f7",
   off: "#334155",
   live: "#ff3b30",
   safe: "#22c55e",
   sweep: "#ff5e3a",
   core: "#c084fc",
} as const;

export interface LaserLight {
   fog: { color: string; near: number; far: number };
   hemi: number;
   ambient: number;
   key: number;
}

/** The light per level (the card: bright and readable, clean, atmospheric, high contrast, cinematic). */
export function laserLight(level: LevelId): LaserLight {
   if (level === 1) return { fog: { color: "#1e293b", near: 30, far: 110 }, hemi: 1.0, ambient: 0.5, key: 1.2 };
   if (level === 2) return { fog: { color: "#172033", near: 28, far: 100 }, hemi: 0.85, ambient: 0.42, key: 1.05 };
   if (level === 3) return { fog: { color: "#140f2e", near: 24, far: 90 }, hemi: 0.7, ambient: 0.34, key: 0.95 };
   if (level === 4) return { fog: { color: "#0c0a1c", near: 22, far: 85 }, hemi: 0.6, ambient: 0.28, key: 0.9 };
   return { fog: { color: "#1a0b2e", near: 24, far: 95 }, hemi: 0.65, ambient: 0.3, key: 1.0 };
}

export function levelEnvironment(level: LevelId): { background: string; fog: [string, number, number]; lighting: "indoor" | "night" } {
   const l = laserLight(level);
   return { background: COLORS.background, fog: [l.fog.color, l.fog.near, l.fog.far], lighting: level <= 2 ? "indoor" : "night" };
}

/** The accent per level (the wall trims and the floor grid). */
export function accentFor(level: LevelId): string {
   return ["#38bdf8", "#22d3ee", "#a78bfa", "#f472b6", "#e879f9"][level - 1];
}
