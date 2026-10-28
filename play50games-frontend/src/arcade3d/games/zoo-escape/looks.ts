// Zoo Escape's look. Pure data: palette, atmosphere, terrain geometry, decor spots,
// and safety bounding checks. No React, no Three.js runtime logic.
import type { AABB } from "@/arcade3d/core/collision";
import type { LightingPreset } from "@/arcade3d/core/types";
import { STAGES } from "./level";

export const COLORS = {
   // Sky & atmosphere
   skyTop: "#0284c7",
   skyBottom: "#bae6fd",
   skyDuskTop: "#311042",
   skyDuskBottom: "#f97316",
   fogDay: "#bae6fd",
   fogDusk: "#f4a582",

   // Ground & Zoo terrain
   grass: "#368f4c",
   grassSun: "#52be6b",
   grassShade: "#2d7a40",
   grassDeep: "#246e38",
   earth: "#855938",
   earthDark: "#57351c",
   outer: "#65a30d",

   // Paths & Plazas
   path: "#f5ebe0",
   paving: "#e6ccb2",
   curb: "#a89f91",
   asphalt: "#334155",
   lines: "#f8fafc",
   crosswalk: "#fbbf24",

   // Water & Moat
   water: "#22d3ee",
   deep: "#0891b2",
   foam: "#ecfeff",

   // Woods & Fences
   wood: "#b45309",
   woodDark: "#78350f",
   woodLight: "#d97706",
   post: "#713f12",
   rail: "#9a3412",

   // Stone & Architecture
   rock: "#d6cfc7",
   rockDark: "#8c827a",
   rockDeep: "#5c534c",
   kiosk: "#fef3c7",
   kioskTrim: "#0f766e",
   kioskRoof: "#b91c1c",
   metal: "#94a3b8",
   metalDark: "#334155",
   lampGlow: "#fde68a",

   // Foliage & Plants
   bamboo: "#65a30d",
   bambooLight: "#a3e635",
   leaf: "#22c55e",
   leafDark: "#15803d",
   hedge: "#166534",
   hedgeSun: "#22c55e",

   // Characters
   white: "#f8fafc",
   black: "#1e293b",
   khaki: "#d6c29a",
   khakiDark: "#a68a5b",
   skin: "#f2c6a0",
   boot: "#451a03",

   // UI & gameplay signals
   cone: "#ffea00",
   alert: "#f87171",
   accent: "#34d399",
   cloud: "#ffffff",
   hill: "#4a9354",
   hillFar: "#3d7e59",

   // Cars
   car: ["#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6"] as const,
} as const;

/** Linear fog range: starts well past the fitted camera focus so play stays crisp. */
export const FOG = {
   day: { near: 45, far: 95, color: COLORS.fogDay },
   dusk: { near: 40, far: 85, color: COLORS.fogDusk },
} as const;

export interface LevelLook {
   lighting: LightingPreset;
   skyTop: string;
   skyBottom: string;
   fog: string;
}

export const LEVEL_LOOKS = {
   day: { lighting: "day" as LightingPreset, skyTop: COLORS.skyTop, skyBottom: COLORS.skyBottom, fog: COLORS.fogDay },
   dusk: { lighting: "sunset" as LightingPreset, skyTop: COLORS.skyDuskTop, skyBottom: COLORS.skyDuskBottom, fog: COLORS.fogDusk },
};

/**
 * Checks if a world position falls inside the playable zoo area (the 3 stages).
 * Any decor instance must be strictly outside this area.
 */
export function inPlayArea(x: number, z: number, margin = 0): boolean {
   // Stage 0: Enclosure
   if (x >= -7 - margin && x <= 7 + margin && z >= 0 - margin && z <= 18 + margin) return true;
   // Stage 1: Visitor Plaza
   if (x >= -9 - margin && x <= 9 + margin && z >= -20 - margin && z <= 0 + margin) return true;
   // Stage 2: Parking Lot
   if (x >= -10 - margin && x <= 10 + margin && z >= -42 - margin && z <= -20 + margin) return true;
   // Exit corridor just past gate 3 (z -42 to -45, x 4 to 9)
   if (x >= 4 - margin && x <= 9 + margin && z >= -45 - margin && z <= -42) return true;
   return false;
}

export type DecorKind = "hedge" | "tree" | "pine" | "signpost" | "hill" | "cloud" | "fencePost";

export interface DecorSpot {
   kind: DecorKind;
   x: number;
   y: number;
   z: number;
   sx: number;
   sy: number;
   sz: number;
   rotY: number;
}

/** Drifting clouds hold still when the player prefers reduced motion. */
export const CLOUD_DRIFT = 2.0;

function createDecorSpots(): DecorSpot[] {
   const spots: DecorSpot[] = [];

   // --- East Perimeter Hedges (x >= 11.2) ---
   for (let z = 18; z >= -42; z -= 3.2) {
      spots.push({ kind: "hedge", x: 11.4, y: 0, z, sx: 1.1, sy: 1.2, sz: 3.1, rotY: 0 });
   }

   // --- West Perimeter Hedges (x <= -11.2) ---
   for (let z = 18; z >= -42; z -= 3.2) {
      spots.push({ kind: "hedge", x: -11.4, y: 0, z, sx: 1.1, sy: 1.2, sz: 3.1, rotY: 0 });
   }

   // --- North Perimeter Hedges (z <= -45) ---
   for (let x = -14; x <= 14; x += 3.2) {
      if (x >= 4 && x <= 9) continue; // Leave the exit path clear
      spots.push({ kind: "hedge", x, y: 0, z: -45.5, sx: 3.1, sy: 1.2, sz: 1.1, rotY: Math.PI / 2 });
   }

   // --- East Parkland Trees (x in [13.5, 23]) ---
   const eastTrees: [number, number, number, DecorKind][] = [
      [14.2, 16.5, 1.2, "tree"],
      [16.8, 12.0, 1.4, "pine"],
      [14.5, 6.2, 1.1, "tree"],
      [17.5, 0.5, 1.3, "pine"],
      [15.2, -6.5, 1.2, "tree"],
      [18.0, -12.5, 1.4, "pine"],
      [14.8, -18.2, 1.1, "tree"],
      [17.2, -25.5, 1.3, "pine"],
      [14.5, -32.0, 1.2, "tree"],
      [18.2, -38.5, 1.4, "pine"],
      [21.5, 10.0, 1.5, "tree"],
      [22.0, -15.0, 1.6, "tree"],
      [21.0, -30.0, 1.5, "pine"],
   ];
   for (const [x, z, s, kind] of eastTrees) {
      spots.push({ kind, x, y: 0, z, sx: s, sy: s, sz: s, rotY: (x * 3.7 + z * 1.9) % (Math.PI * 2) });
   }

   // --- West Parkland Trees (x in [-23, -13.5]) ---
   const westTrees: [number, number, number, DecorKind][] = [
      [-14.5, 15.0, 1.3, "pine"],
      [-16.8, 9.5, 1.2, "tree"],
      [-14.2, 3.0, 1.4, "pine"],
      [-17.5, -3.5, 1.1, "tree"],
      [-14.8, -10.5, 1.3, "pine"],
      [-17.8, -16.8, 1.2, "tree"],
      [-14.5, -23.5, 1.4, "pine"],
      [-17.2, -30.5, 1.1, "tree"],
      [-15.0, -37.5, 1.3, "pine"],
      [-21.5, 6.0, 1.5, "tree"],
      [-22.0, -18.0, 1.5, "pine"],
      [-21.0, -34.0, 1.6, "tree"],
   ];
   for (const [x, z, s, kind] of westTrees) {
      spots.push({ kind, x, y: 0, z, sx: s, sy: s, sz: s, rotY: (x * 4.3 + z * 2.1) % (Math.PI * 2) });
   }

   // --- North Far Trees & Pines (z in [-56, -48]) ---
   const northTrees: [number, number, number, DecorKind][] = [
      [-15.0, -50.0, 1.4, "pine"],
      [-9.0, -52.0, 1.2, "tree"],
      [-2.5, -53.5, 1.3, "pine"],
      [3.0, -54.0, 1.2, "tree"],
      [11.5, -51.5, 1.4, "pine"],
      [16.0, -49.0, 1.3, "tree"],
      [-20.0, -55.0, 1.6, "tree"],
      [0.0, -58.0, 1.5, "pine"],
      [20.0, -56.0, 1.6, "pine"],
   ];
   for (const [x, z, s, kind] of northTrees) {
      spots.push({ kind, x, y: 0, z, sx: s, sy: s, sz: s, rotY: (x * 5.1 + z * 3.3) % (Math.PI * 2) });
   }

   // --- Zoo Signposts outside the gates and edges ---
   spots.push({ kind: "signpost", x: 11.0, y: 0, z: 16.5, sx: 0.8, sy: 1.0, sz: 0.8, rotY: -Math.PI / 4 });
   spots.push({ kind: "signpost", x: -11.0, y: 0, z: -18.5, sx: 0.8, sy: 1.0, sz: 0.8, rotY: Math.PI / 4 });
   spots.push({ kind: "signpost", x: 10.6, y: 0, z: -43.0, sx: 0.8, sy: 1.0, sz: 0.8, rotY: -Math.PI / 3 });

   // --- Distant Rolling Hills ---
   const hills: [number, number, number, number][] = [
      // Far East
      [32, 8, 4.5, 18],
      [34, -20, 5.2, 22],
      [30, -45, 4.8, 20],
      // Far West
      [-32, 6, 4.6, 19],
      [-35, -22, 5.0, 21],
      [-31, -48, 4.7, 20],
      // Far North
      [-18, -68, 6.5, 26],
      [5, -72, 7.2, 28],
      [22, -66, 6.0, 24],
   ];
   for (const [x, z, h, r] of hills) {
      spots.push({ kind: "hill", x, y: 0, z, sx: r, sy: h, sz: r, rotY: (x * 1.3 + z) % Math.PI });
   }

   // --- Clouds in the upper sky ---
   const clouds: [number, number, number, number, number, number][] = [
      [-16, 28, -10, 4.5, 2.2, 3.5],
      [14, 30, -25, 5.2, 2.4, 4.0],
      [-6, 27, -42, 4.8, 2.1, 3.6],
      [18, 31, 5, 4.2, 2.0, 3.2],
      [-22, 29, -55, 5.6, 2.5, 4.2],
      [6, 32, -62, 5.0, 2.3, 3.8],
   ];
   for (const [x, y, z, sx, sy, sz] of clouds) {
      spots.push({ kind: "cloud", x, y, z, sx, sy, sz, rotY: 0 });
   }

   return spots;
}

export const DECOR = createDecorSpots();

export function decorOf(kind: DecorKind): DecorSpot[] {
   return DECOR.filter((d) => d.kind === kind);
}

function channel(c: number): number {
   const s = c / 255;
   return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG contrast of two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
   const lum = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
   };
   const hi = Math.max(lum(a), lum(b));
   const lo = Math.min(lum(a), lum(b));
   return (hi + 0.05) / (lo + 0.05);
}

// ---------- per-level themes (drawing only; level.ts / maps.ts pick one per map) ----------

export interface Theme {
   /** the lighting preset per stage (null = the definition's day light) and the sky / fog colour while it is on */
   lighting: readonly (LightingPreset | null)[];
   sky: string;
   skyTop: readonly string[];
   skyBottom: readonly string[];
   /** ground per stage: base colour and the canvas mottling tones */
   ground: readonly { base: string; tones: readonly string[]; paved?: boolean }[];
   /** outer ground beyond the stages */
   outer: string;
   path: string;
   /** fence look: wooden rails, savanna poles, aviary nets, iron railings */
   fence: { post: string; rail: string; style: "rail" | "net" | "iron" };
   /** the stage toasts (stages 2 and 3) */
   stageNames: readonly [string, string, string];
   /** lamp heads / halos glow from this stage on (99 = never) */
   lampsFrom: number;
}

const DAY_SKY = [COLORS.skyTop, COLORS.skyTop, COLORS.skyTop] as const;
const DAY_HORIZON = [COLORS.skyBottom, COLORS.skyBottom, COLORS.skyBottom] as const;

export const THEMES: Record<"enclosure" | "safari" | "garden" | "central" | "night", Theme> = {
   // level 1: today's look (stage 3 at dusk)
   enclosure: {
      lighting: [null, null, "sunset"],
      sky: COLORS.fogDusk,
      skyTop: [COLORS.skyTop, COLORS.skyTop, COLORS.skyDuskTop],
      skyBottom: [COLORS.skyBottom, COLORS.skyBottom, COLORS.skyDuskBottom],
      ground: [
         { base: COLORS.grass, tones: [COLORS.grassSun, COLORS.grassShade, COLORS.grassDeep, COLORS.earth] },
         { base: COLORS.paving, tones: [COLORS.path], paved: true },
         { base: COLORS.asphalt, tones: [], paved: true },
      ],
      outer: COLORS.grass,
      path: COLORS.path,
      fence: { post: COLORS.post, rail: COLORS.rail, style: "rail" },
      stageNames: ["The enclosure", "Stage 2: the visitor plaza", "Stage 3: the parking lot at dusk"],
      lampsFrom: 2,
   },
   // level 2: golden savanna under a hot afternoon sky, dusty tracks
   safari: {
      lighting: [null, null, null],
      sky: "#fde68a",
      skyTop: ["#38bdf8", "#38bdf8", "#38bdf8"],
      skyBottom: ["#fde68a", "#fde68a", "#fde68a"],
      ground: [
         { base: "#c9a94a", tones: ["#e0c068", "#a88a36", "#b8963e", "#8a6a2c"] },
         { base: "#bf9c45", tones: ["#d8b65e", "#9c7e33", "#a8873a"] },
         { base: "#b59547", tones: ["#cdaa58", "#8f7434", "#a1843d"] },
      ],
      outer: "#b8963e",
      path: "#c08a52",
      fence: { post: "#6b4423", rail: "#8b5a2b", style: "rail" },
      stageNames: ["The savanna paddock", "Stage 2: the safari track", "Stage 3: the ranger camp"],
      lampsFrom: 99,
   },
   // level 3: lush lawns, gravel walks, aviary nets, ponds
   garden: {
      lighting: [null, null, null],
      sky: "#bbf7d0",
      skyTop: ["#0ea5e9", "#0ea5e9", "#0ea5e9"],
      skyBottom: ["#d9f99d", "#d9f99d", "#d9f99d"],
      ground: [
         { base: "#3f9d4f", tones: ["#5cc46b", "#2f7d3e", "#78d07f", "#a3e635"] },
         { base: "#3a9449", tones: ["#57bd66", "#2b7339", "#86efac"] },
         { base: "#35904a", tones: ["#4fb563", "#286e37", "#6ee7b7"] },
      ],
      outer: "#3a9449",
      path: "#e7dcc8",
      fence: { post: "#334155", rail: "#cbd5e1", style: "net" },
      stageNames: ["The aviary walk", "Stage 2: the flamingo ponds", "Stage 3: swan lake"],
      lampsFrom: 99,
   },
   // level 4: paved plazas and the main gate; the last stage at dusk
   central: {
      lighting: [null, null, "sunset"],
      sky: COLORS.fogDusk,
      skyTop: [COLORS.skyTop, COLORS.skyTop, COLORS.skyDuskTop],
      skyBottom: [COLORS.skyBottom, COLORS.skyBottom, COLORS.skyDuskBottom],
      ground: [
         { base: "#d6c4a8", tones: ["#e9dcc5", "#c2ad8d"], paved: true },
         { base: "#e2d3bb", tones: ["#cdb796", "#f1e6d2"], paved: true },
         { base: "#c9b79a", tones: ["#b7a283", "#ddd0b8"], paved: true },
      ],
      outer: COLORS.grass,
      path: "#b45309",
      fence: { post: "#1f2937", rail: "#374151", style: "iron" },
      stageNames: ["The panda house terrace", "Stage 2: the central plaza", "Stage 3: the main gate at dusk"],
      lampsFrom: 2,
   },
   // level 5: night on every stage, lamps lit, searchlights sweeping
   night: {
      lighting: ["night", "night", "night"],
      sky: "#0b1020",
      skyTop: ["#020617", "#020617", "#020617"],
      skyBottom: ["#1e1b4b", "#1e1b4b", "#1e1b4b"],
      ground: [
         { base: "#1f4d33", tones: ["#2a6142", "#173d29", "#30573a"] },
         { base: "#3b4252", tones: ["#4a5263"], paved: true },
         { base: "#1e2533", tones: [], paved: true },
      ],
      outer: "#173d29",
      path: "#64748b",
      fence: { post: "#1f2937", rail: "#475569", style: "iron" },
      stageNames: ["The panda house at night", "Stage 2: the moonlit plaza", "Stage 3: the back gate"],
      lampsFrom: 0,
   },
};

/** The sky dome colours and the lighting preset of a theme's stage. */
export const themeStage = (theme: Theme, stage: number) => ({
   lighting: theme.lighting[stage] ?? null,
   top: theme.skyTop[stage] ?? DAY_SKY[0],
   bottom: theme.skyBottom[stage] ?? DAY_HORIZON[0],
});
