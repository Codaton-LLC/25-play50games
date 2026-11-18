// Wall Run Temple's look: one palette (carved sandstone, jade inlays, moss, the ashen grey Shadow Plates
// left behind) and a sky and light per level, the world's arc: misty morning (L1), green noon (L2),
// golden hour (L3), blue night with torches (L4), storm grey that breaks into sun on Umbra's fall (L5).
// Plain data (index.tsx reads the environment from here).
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   stone: "#d6b98a",
   stoneDark: "#8a6f4c",
   jade: "#34d399",
   jadeDark: "#047857",
   moss: "#4ade80",
   mossDark: "#166534",
   ash: "#9ca3af",
   orb: "#fbbf24",
   bonus: "#fde68a",
   magnet: "#2dd4bf",
   hazard: "#a855f7",
   dart: "#f97316",
   ghost: "#c4b5fd",
   glyph: "#fde047",
   torch: "#ff9a3c",
   umbra: "#7c3aed",
   plate: "#312e81",
   kick: "#bbf7d0",
} as const;

export interface LevelLook {
   mood: string;
   skyTop: string;
   skyMid: string;
   skyBottom: string;
   sun: string;
   sunAzimuth: number;
   sunElevation: number;
   background: string;
   fog: [string, number, number];
   lighting: "day" | "sunset" | "night";
   hemiSky: string;
   hemiGround: string;
   hemi: number;
   key: string;
   keyIntensity: number;
   /** the jungle canopy far below and the haze colour */
   canopy: string;
   /** torches on the pads (L4) */
   torches: boolean;
   /** storm flashes (L5) */
   lightning: boolean;
}

export const LEVEL_LOOK: Record<LevelId, LevelLook> = {
   1: {
      mood: "Misty morning", skyTop: "#9cc4d8", skyMid: "#d9e6e3", skyBottom: "#eef0e4", sun: "#fff4dc", sunAzimuth: 0.4, sunElevation: 0.28,
      background: "#cfdcd8", fog: ["#d4e0da", 30, 150], lighting: "day", hemiSky: "#f3f6ee", hemiGround: "#7f9b84", hemi: 0.95,
      key: "#fff1d6", keyIntensity: 1.05, canopy: "#5d8a62", torches: false, lightning: false,
   },
   2: {
      mood: "Green noon", skyTop: "#4f9fe0", skyMid: "#b6dcf2", skyBottom: "#e3f4e4", sun: "#ffffff", sunAzimuth: 1.1, sunElevation: 0.95,
      background: "#b7d9e8", fog: ["#cde8de", 45, 190], lighting: "day", hemiSky: "#ffffff", hemiGround: "#4f8a55", hemi: 1.0,
      key: "#ffffff", keyIntensity: 1.3, canopy: "#2f8a43", torches: false, lightning: false,
   },
   3: {
      mood: "Golden hour", skyTop: "#5a8fcf", skyMid: "#f2c58a", skyBottom: "#ffd99c", sun: "#ffc06b", sunAzimuth: 2.6, sunElevation: 0.18,
      background: "#e8c48f", fog: ["#efcf9a", 40, 170], lighting: "sunset", hemiSky: "#ffe2b8", hemiGround: "#6d6a3c", hemi: 0.95,
      key: "#ffc78a", keyIntensity: 1.25, canopy: "#4c7a34", torches: false, lightning: false,
   },
   4: {
      mood: "Blue night, torches", skyTop: "#0c1631", skyMid: "#1d3360", skyBottom: "#33507e", sun: "#c9d8ff", sunAzimuth: 2.2, sunElevation: 0.6,
      background: "#14223f", fog: ["#1b2b4c", 26, 120], lighting: "night", hemiSky: "#9fb4e8", hemiGround: "#1b2a3d", hemi: 0.75,
      key: "#bcccf5", keyIntensity: 0.7, canopy: "#1d3a3a", torches: true, lightning: false,
   },
   5: {
      mood: "Storm over the shaft", skyTop: "#3b4252", skyMid: "#6b7280", skyBottom: "#9aa1a8", sun: "#e5e7eb", sunAzimuth: 0.9, sunElevation: 0.55,
      background: "#5b626d", fog: ["#6f767f", 30, 140], lighting: "day", hemiSky: "#d4d8de", hemiGround: "#3f4a40", hemi: 0.85,
      key: "#e8ebef", keyIntensity: 0.9, canopy: "#3f5a45", torches: true, lightning: true,
   },
};

export function levelLook(id: number): LevelLook {
   return LEVEL_LOOK[(id >= 1 && id <= 5 ? id : 1) as LevelId];
}

/** The shell's environment for a level (background, fog band, lighting preset). */
export function levelEnvironment(id: number): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" | "night" } {
   const look = levelLook(id);
   return { background: look.background, fog: look.fog, lighting: look.lighting };
}

/** Occasional storm flash, 0..1 (level 5). Visual only. */
export function lightningFlash(timeS: number): number {
   if (!(timeS > 0)) return 0;
   const period = 6.1;
   const n = Math.floor(timeS / period);
   if (n % 3 === 2) return 0;
   const t = timeS - n * period;
   const spike = (at: number, half: number) => {
      const d = Math.abs(t - at);
      if (d >= half) return 0;
      const u = 1 - d / half;
      return u * u;
   };
   return Math.min(1, spike(0.12, 0.09) + spike(0.32, 0.055) * 0.55);
}
