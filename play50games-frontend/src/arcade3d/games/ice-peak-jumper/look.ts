// Ice Peak Jumper's look: one palette (snow white, glacier blue, deep ice, a warm lantern gold), the sky
// per level (level 4 is night), and the light. Pure.
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   background: "#cfe8ff",
   skyTop: "#5aa2e6",
   skyMid: "#a9d4f7",
   skyBottom: "#eef7ff",
   nightTop: "#0b1430",
   nightMid: "#1c2b55",
   nightBottom: "#3b4a7a",
   ice: "#bfe9ff",
   iceDeep: "#5fb4e8",
   snow: "#f8fbff",
   ghost: "#c4b5fd",
   trail: "#7dd3fc",
   cracked: "#93c5fd",
   lantern: "#fbbf24",
   danger: "#ef4444",
   arc: "#fde68a",
   core: "#facc15",
} as const;

export interface PeakLight {
   fog: { color: string; near: number; far: number };
   hemi: number;
   ambient: number;
   key: number;
}

/** The light per level: bright alpine day; level 4 a moonlit night; level 5 a storm-grey summit. */
export function peakLight(level: LevelId, night: boolean): PeakLight {
   if (night) return { fog: { color: "#1c2b55", near: 25, far: 110 }, hemi: 0.35, ambient: 0.18, key: 0.35 };
   if (level === 5) return { fog: { color: "#c9d6e6", near: 35, far: 150 }, hemi: 0.75, ambient: 0.35, key: 1.0 };
   return { fog: { color: "#dcefff", near: 40, far: 170 }, hemi: 0.85, ambient: 0.4, key: 1.15 };
}

export function levelEnvironment(level: LevelId, night: boolean): { background: string; fog: [string, number, number]; lighting: "day" | "night" | "snow" } {
   const l = peakLight(level, night);
   return { background: night ? COLORS.nightMid : COLORS.background, fog: [l.fog.color, l.fog.near, l.fog.far], lighting: night ? "night" : "snow" };
}

/** A small deterministic hash noise in 0..1. */
export function hash2(a: number, b: number): number {
   const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
   return s - Math.floor(s);
}
