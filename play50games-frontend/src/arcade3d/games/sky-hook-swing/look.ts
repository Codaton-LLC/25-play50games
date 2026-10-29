// Sky Hook Swing's look: one palette for the docks, and a sky and light per level (the flight runs
// from a gold morning through noon and a hazy afternoon to a windy dusk and the galleon's storm).
// Hazards are storm-violet with a white rim on every level (the world's rule). Pure data: no three.
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   skyTop: "#7ec8ff",
   skyMid: "#d7ecff",
   skyBottom: "#fff6ea",
   fog: "#d5e8f8",
   background: "#b9d7f5",
   sun: "#fff7e8",
   rope: "#f1e4c8",
   ropeDark: "#8a6a3f",
   ring: "#e8b04a",
   ringDark: "#7c5a26",
   cracked: "#c2410c",
   peak: "#4ade80",
   aim: "#ffffff",
   orb: "#fbbf24",
   bonus: "#fde68a",
   magnet: "#38bdf8",
   pad: "#fde68a",
   bell: "#f5c542",
   hull: "#6b4a2e",
   hullDark: "#3f2a19",
   hullTrim: "#d6a756",
   sail: "#eef2ff",
   hazard: "#a855f7",
   hazardRim: "#f5f3ff",
   ghost: "#c4b5fd",
   shard: "#a5f3fc",
   sticker: "#f0abfc",
   net: "#f5e9cf",
   cloud: "#ffffff",
   cloudShade: "#c7d6ea",
} as const;

export interface LevelLook {
   /** the name on the intro card's sky */
   mood: string;
   skyTop: string;
   skyMid: string;
   skyBottom: string;
   /** the sun disc's colour and where it sits (azimuth from +x round +y, elevation), radians */
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
   /** the cloud sea's tint under the docks */
   cloud: string;
   cloudShade: string;
   /** storm flashes over the galleon */
   lightning: boolean;
}

export const LEVEL_LOOK: Record<LevelId, LevelLook> = {
   1: {
      mood: "Gold morning",
      skyTop: "#5aa9f2",
      skyMid: "#bfe0ff",
      skyBottom: "#ffe7c2",
      sun: "#fff1c9",
      sunAzimuth: 0.35,
      sunElevation: 0.32,
      background: "#bcdcf8",
      fog: ["#d6e9fb", 55, 210],
      lighting: "day",
      hemiSky: "#fff6e5",
      hemiGround: "#9cc9ee",
      hemi: 0.95,
      key: "#fff0d6",
      keyIntensity: 1.25,
      cloud: "#ffffff",
      cloudShade: "#c9d9ee",
      lightning: false,
   },
   2: {
      mood: "High noon",
      skyTop: "#3d8ff0",
      skyMid: "#a9d6ff",
      skyBottom: "#eef8ff",
      sun: "#ffffff",
      sunAzimuth: 0.9,
      sunElevation: 0.95,
      background: "#a9d3fa",
      fog: ["#cfe6fb", 60, 230],
      lighting: "day",
      hemiSky: "#ffffff",
      hemiGround: "#8fc3ef",
      hemi: 1.0,
      key: "#ffffff",
      keyIntensity: 1.35,
      cloud: "#ffffff",
      cloudShade: "#bfd4ee",
      lightning: false,
   },
   3: {
      mood: "Hazy afternoon",
      skyTop: "#4f8fdb",
      skyMid: "#cfe0f2",
      skyBottom: "#ffe1b0",
      sun: "#ffe0a8",
      sunAzimuth: 2.4,
      sunElevation: 0.42,
      background: "#c9daf0",
      fog: ["#e3e3ea", 50, 200],
      lighting: "day",
      hemiSky: "#fff0d8",
      hemiGround: "#b5c9e6",
      hemi: 0.95,
      key: "#ffe3b8",
      keyIntensity: 1.2,
      cloud: "#fff8ee",
      cloudShade: "#d3cfe0",
      lightning: false,
   },
   4: {
      mood: "Windy dusk",
      skyTop: "#4a5bb8",
      skyMid: "#e99a8c",
      skyBottom: "#ffcf96",
      sun: "#ffb46b",
      sunAzimuth: 0.15,
      sunElevation: 0.12,
      background: "#d9a3a1",
      fog: ["#e7b8a6", 40, 170],
      lighting: "sunset",
      hemiSky: "#ffd9b8",
      hemiGround: "#8a7fb8",
      hemi: 0.9,
      key: "#ffb98a",
      keyIntensity: 1.15,
      cloud: "#ffe3cf",
      cloudShade: "#b9a3c9",
      lightning: false,
   },
   5: {
      mood: "The storm ring",
      skyTop: "#24264f",
      skyMid: "#5c4f93",
      skyBottom: "#9f86c4",
      sun: "#d9ccff",
      sunAzimuth: 2.9,
      sunElevation: 0.5,
      background: "#4b4378",
      fog: ["#6d5f9c", 35, 150],
      lighting: "night",
      hemiSky: "#c9bdf5",
      hemiGround: "#3b2f6b",
      hemi: 0.85,
      key: "#e6dcff",
      keyIntensity: 1.05,
      cloud: "#b9add9",
      cloudShade: "#5b4d8a",
      lightning: true,
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

/**
 * Occasional storm flash, 0..1 (level 5). Quiet most of the time: a double flicker near the start of a
 * 5.4 s cycle, every third cycle skipped. Visual only.
 */
export function lightningFlash(timeS: number): number {
   if (!(timeS > 0)) return 0;
   const period = 5.4;
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
