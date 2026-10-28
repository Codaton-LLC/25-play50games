// Plate Surf's look per level (pure data, no three.js): the sky, the fog, the sea and the wave's
// colours. World 2 starts chalk-grey and gets its colour back as you collect orbs (the World intro):
// the wave shader mixes from the grey palette to the level's colours by the share of orbs taken
// (Wave.tsx `restore`). Level 1 a bright morning, 2 midday blue, 3 golden afternoon, 4 the shaded
// canyon, 5 a violet storm dusk for King Breaker. Hazards are always storm-violet with a white rim.
import type { LevelId } from "@/arcade3d/types";

export interface SurfLook {
   skyTop: string;
   skyMid: string;
   skyBottom: string;
   background: string;
   fog: string;
   fogNear: number;
   fogFar: number;
   /** the wave: deep at the trough, bright and see-through-looking near the lip */
   deep: string;
   face: string;
   lip: string;
   foam: string;
   /** the open sea in front of the wave */
   sea: string;
   sun: string;
   lighting: "day" | "sunset";
   /** the sweet band's glow */
   band: string;
}

export const LOOKS: Record<LevelId, SurfLook> = {
   1: {
      skyTop: "#5fb4f0",
      skyMid: "#bfe6ff",
      skyBottom: "#fff4e0",
      background: "#a9d8f5",
      fog: "#cfeaf7",
      fogNear: 70,
      fogFar: 260,
      deep: "#0b5d7a",
      face: "#1aa6b7",
      lip: "#7ff0e6",
      foam: "#f4fdff",
      sea: "#167c99",
      sun: "#fff3d6",
      lighting: "day",
      band: "#fde68a",
   },
   2: {
      skyTop: "#3d8fe0",
      skyMid: "#a8d6ff",
      skyBottom: "#e8f6ff",
      background: "#95c8f2",
      fog: "#bfdcf3",
      fogNear: 65,
      fogFar: 250,
      deep: "#083f6b",
      face: "#1478b8",
      lip: "#6ee0f0",
      foam: "#f2fbff",
      sea: "#0f5f8f",
      sun: "#fff7e6",
      lighting: "day",
      band: "#fde68a",
   },
   3: {
      skyTop: "#5a9fe0",
      skyMid: "#ffd9a8",
      skyBottom: "#ffe9c9",
      background: "#f5cfa1",
      fog: "#f7dcbc",
      fogNear: 60,
      fogFar: 240,
      deep: "#0b4f69",
      face: "#178f9e",
      lip: "#8ff0d8",
      foam: "#fffaf0",
      sea: "#15708a",
      sun: "#ffd89a",
      lighting: "sunset",
      band: "#fff1b0",
   },
   4: {
      skyTop: "#4f86b8",
      skyMid: "#a9c7dc",
      skyBottom: "#dfe8ec",
      background: "#9fbcd0",
      fog: "#a9c2d2",
      fogNear: 45,
      fogFar: 190,
      deep: "#06384f",
      face: "#11708a",
      lip: "#5fd8d8",
      foam: "#eef8fa",
      sea: "#0d566e",
      sun: "#eaf4ff",
      lighting: "day",
      band: "#fde68a",
   },
   5: {
      skyTop: "#3b2a6b",
      skyMid: "#9b6aa8",
      skyBottom: "#f2a98c",
      background: "#8f6a9e",
      fog: "#a98bb0",
      fogNear: 50,
      fogFar: 210,
      deep: "#1b2050",
      face: "#2b6e93",
      lip: "#72d6e6",
      foam: "#f1ecff",
      sea: "#23426b",
      sun: "#ffc7a3",
      lighting: "sunset",
      band: "#fcd34d",
   },
};

/** The chalk-grey world before the colour comes back (mixed by the share of orbs taken). */
export const GREY = {
   deep: "#3c4a52",
   face: "#6b7a82",
   lip: "#a7b3b8",
   sea: "#56646b",
} as const;

/** Hazards: storm-violet with a white rim (the World intro). */
export const HAZARD = { violet: "#7c3aed", glow: "#c4b5fd", rim: "#ffffff" } as const;

export const COLORS = {
   background: LOOKS[1].background,
   orb: "#38bdf8",
   orbGlow: "#a5f3fc",
   gold: "#ffd257",
   jelly: "#7dd3fc",
   beacon: "#fbbf24",
   reef: "#5b6b73",
   sand: "#f1dfb8",
} as const;

/** The level's environment for the shell (background, fog, lighting preset). */
export function levelEnvironment(id: LevelId): { background: string; fog: [string, number, number]; lighting: "day" | "sunset" } {
   const l = LOOKS[id];
   return { background: l.background, fog: [l.fog, l.fogNear, l.fogFar], lighting: l.lighting };
}

/** How much of the colour has come back (0..1): a third at the start, all of it with every main orb. */
export function restoreAmount(mainOrbs: number, mainTotal: number): number {
   if (!(mainTotal > 0)) return 1;
   return 0.35 + 0.65 * Math.min(1, mainOrbs / mainTotal);
}
