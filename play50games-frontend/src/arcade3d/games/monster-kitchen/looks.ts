// Monster Kitchen's visual look: single COLORS palette, level lighting looks,
// play bounds, and instanced surroundings decor outside the play area.
// Pure data and math — no React.
import type { LightingPreset } from "@/arcade3d/core/types";
import type { CanvasDraw } from "@/arcade3d/core/render";
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   // --- environment & sky ---
   skyTop: "#1e1b4b",
   skyBottom: "#4c1d95",
   fog: "#291d24",
   nightWindowSky: "#0f172a",
   moon: "#fef08a",
   star: "#fef9c3",

   // --- architecture: walls, arches, floor ---
   floorTile: "#854d0e",
   floorTileAlt: "#9a3412",
   floorGrout: "#292524",
   wallBase: "#57534e",
   wallTrim: "#44403c",
   wallDark: "#1c1917",
   stoneArch: "#78716c",
   stoneKeystone: "#a8a29e",

   // --- woodwork: counter, shelves, beams ---
   woodBase: "#78350f",
   woodCounterTop: "#92400e",
   woodDark: "#451a03",
   woodLight: "#b45309",

   // --- stove, metals & fire ---
   stoveIron: "#27272a",
   stoveTrim: "#52525b",
   stoveGrate: "#18181b",
   fireGlow: "#ea580c",
   fireCore: "#fbbf24",
   copper: "#c2410c",
   copperHighlight: "#fb923c",
   copperDark: "#7c2d12",
   brass: "#eab308",
   brassHighlight: "#fde047",
   iron: "#3f3f46",

   // --- decor: crates, barrels, jars, herbs ---
   crateWood: "#a16207",
   cratePlank: "#b45309",
   crateBand: "#292524",
   barrelWood: "#78350f",
   barrelHoop: "#3f3f46",
   jarGlass: "#38bdf8",
   jarCork: "#d97706",
   potionGreen: "#84cc16",
   potionPurple: "#a855f7",
   potionOrange: "#f97316",
   garlic: "#fefce8",
   garlicStem: "#84cc16",
   herbGreen: "#4d7c0f",
   pumpkin: "#ea580c",
   pumpkinStem: "#65a30d",

   // --- wheel & turntable ---
   wheelWood: "#542004",
   wheelInlay: "#78350f",
   wheelBrass: "#f59e0b",
   wheelRim: "#3b1402",

   // --- procedural ingredients ---
   eyeballWhite: "#f8fafc",
   eyeballIris: "#0284c7",
   eyeballPupil: "#0f172a",
   eyeballVein: "#f43f5e",
   slimeBase: "#22c55e",
   slimeCore: "#4ade80",
   slimeDark: "#15803d",

   // --- stand-in chef & monster primitives ---
   chefTunic: "#f8fafc",
   chefApron: "#fef3c7",
   chefSkin: "#fcd34d",
   chefHat: "#f8fafc",
   chefHatBand: "#e2e8f0",
   monsterBelly: "#fef3c7",
   cauldronIron: "#334155",

   // --- monster headgear ---
   partyHat: "#ec4899",
   partyHatTrim: "#facc15",
   partyHatBall: "#06b6d4",
   topHat: "#18181b",
   topHatBand: "#be123c",
   topHatBuckle: "#fbbf24",
   hornBase: "#fef3c7",
   hornTip: "#d97706",
   hornRing: "#78350f",

   // --- HUD & indicators ---
   yes: "#4ade80",
   no: "#f87171",
   idle: "#cbd5e1",
   accent: "#f472b6",
} as const;

/**
 * Play area bounds: where monsters, order bubbles, chef, counter, wheel,
 * and cauldron live. Decor instances MUST stay strictly OUTSIDE this volume.
 */
export const PLAY_BOUNDS = {
   xMin: -3.1,
   xMax: 1.7,
   yMin: 0,
   yMax: 2.95,
   zMin: -2.85,
   zMax: 1.05,
} as const;

export function inPlayArea(x: number, z: number, y = 0): boolean {
   return (
      x >= PLAY_BOUNDS.xMin &&
      x <= PLAY_BOUNDS.xMax &&
      z >= PLAY_BOUNDS.zMin &&
      z <= PLAY_BOUNDS.zMax &&
      y <= PLAY_BOUNDS.yMax
   );
}

export interface LevelLook {
   lighting: LightingPreset;
   skyTop: string;
   skyBottom: string;
   fog: string;
   background: string;
   stoveGlow: number;
}

export const LEVEL_LOOKS: Record<LevelId, LevelLook> = {
   1: {
      lighting: "indoor",
      skyTop: COLORS.skyTop,
      skyBottom: COLORS.skyBottom,
      fog: COLORS.fog,
      background: "#1f1724",
      stoveGlow: 1.6,
   },
   2: {
      lighting: "day",
      skyTop: "#38bdf8",
      skyBottom: "#bae6fd",
      fog: "#78716c",
      background: "#57534e",
      stoveGlow: 1.3,
   },
   3: {
      lighting: "sunset",
      skyTop: "#4c1d95",
      skyBottom: "#f97316",
      fog: "#7c2d12",
      background: "#431407",
      stoveGlow: 1.8,
   },
   4: {
      lighting: "night",
      skyTop: "#0f172a",
      skyBottom: "#1e1b4b",
      fog: "#0c0a09",
      background: "#09090b",
      stoveGlow: 2.2,
   },
   5: {
      lighting: "sunset",
      skyTop: "#581c87",
      skyBottom: "#ea580c",
      fog: "#431407",
      background: "#2a0a03",
      stoveGlow: 2.4,
   },
};

export interface DecorSpot {
   kind: "crate" | "pan" | "pot" | "jar" | "barrel" | "garlic" | "pumpkin" | "window";
   tone?: number;
   x: number;
   y: number;
   z: number;
   rotX?: number;
   rotY?: number;
   rotZ?: number;
   sx: number;
   sy: number;
   sz: number;
}

/**
 * Surrounding decor spots strictly outside PLAY_BOUNDS (left x <= -3.2,
 * right x >= 1.8, or back z <= -3.0).
 */
export const DECOR: readonly DecorSpot[] = [
   // --- Left kitchen area: crates stacked on floor ---
   { kind: "crate", x: -3.65, y: 0.22, z: 0.45, rotY: 0.18, sx: 1, sy: 1, sz: 1 },
   { kind: "crate", x: -4.25, y: 0.22, z: 0.65, rotY: -0.25, sx: 1.1, sy: 1, sz: 1.1 },
   { kind: "crate", x: -3.85, y: 0.68, z: 0.55, rotY: 0.42, sx: 0.85, sy: 0.85, sz: 0.85 },
   { kind: "crate", x: -3.6, y: 0.22, z: 1.25, rotY: 0.08, sx: 0.95, sy: 0.95, sz: 0.95 },
   { kind: "crate", x: -4.3, y: 0.22, z: 1.35, rotY: -0.15, sx: 1.05, sy: 1.05, sz: 1.05 },

   // --- Left kitchen area: barrel in corner ---
   { kind: "barrel", x: -4.35, y: 0.48, z: -0.95, rotY: 0.35, sx: 1, sy: 1, sz: 1 },
   { kind: "barrel", x: -4.55, y: 0.42, z: -0.2, rotY: -0.6, sx: 0.9, sy: 0.9, sz: 0.9 },

   // --- Left wall: hanging copper pans ---
   { kind: "pan", x: -3.32, y: 2.3, z: 0.3, rotY: Math.PI / 2, rotZ: 0.08, sx: 1, sy: 1, sz: 1 },
   { kind: "pan", x: -3.32, y: 2.15, z: 0.85, rotY: Math.PI / 2, rotZ: -0.05, sx: 0.85, sy: 0.85, sz: 0.85 },
   { kind: "pan", x: -3.32, y: 2.45, z: -0.4, rotY: Math.PI / 2, rotZ: 0.04, sx: 1.15, sy: 1.15, sz: 1.15 },

   // --- Left wall: potion jars on side shelves ---
   { kind: "jar", tone: 0, x: -3.55, y: 1.38, z: -0.4, rotY: 0.4, sx: 1, sy: 1, sz: 1 },
   { kind: "jar", tone: 1, x: -3.55, y: 1.38, z: -0.15, rotY: 1.2, sx: 0.9, sy: 1.1, sz: 0.9 },
   { kind: "jar", tone: 2, x: -3.55, y: 1.38, z: 0.1, rotY: 2.3, sx: 1.05, sy: 0.9, sz: 1.05 },
   { kind: "jar", tone: 0, x: -3.55, y: 1.98, z: -0.3, rotY: 0.7, sx: 0.95, sy: 0.95, sz: 0.95 },
   { kind: "jar", tone: 1, x: -3.55, y: 1.98, z: 0.0, rotY: 1.8, sx: 1.1, sy: 1.05, sz: 1.1 },

   // --- Right kitchen area: crates stacked on floor ---
   { kind: "crate", x: 2.35, y: 0.22, z: 0.35, rotY: -0.12, sx: 1.05, sy: 1, sz: 1.05 },
   { kind: "crate", x: 2.95, y: 0.22, z: 0.5, rotY: 0.25, sx: 0.95, sy: 1, sz: 0.95 },
   { kind: "crate", x: 2.55, y: 0.68, z: 0.42, rotY: -0.32, sx: 0.9, sy: 0.85, sz: 0.9 },
   { kind: "crate", x: 2.4, y: 0.22, z: 1.2, rotY: 0.15, sx: 1.1, sy: 1.05, sz: 1.1 },
   { kind: "crate", x: 3.1, y: 0.22, z: 1.3, rotY: -0.22, sx: 1, sy: 1, sz: 1 },

   // --- Right kitchen area: barrel & pumpkins ---
   { kind: "barrel", x: 3.65, y: 0.48, z: -0.7, rotY: 0.5, sx: 1.05, sy: 1.05, sz: 1.05 },
   { kind: "pumpkin", x: 2.2, y: 0.18, z: 0.85, rotY: 0.6, sx: 1.1, sy: 0.9, sz: 1.1 },
   { kind: "pumpkin", x: 2.65, y: 0.14, z: 0.88, rotY: -0.8, sx: 0.85, sy: 0.75, sz: 0.85 },
   { kind: "pumpkin", x: 3.5, y: 0.2, z: 0.35, rotY: 1.4, sx: 1.25, sy: 1.05, sz: 1.25 },

   // --- Right wall: copper pots on shelves ---
   { kind: "pot", tone: 0, x: 2.4, y: 1.38, z: -0.4, rotY: 0.3, sx: 1, sy: 1, sz: 1 },
   { kind: "pot", tone: 1, x: 2.4, y: 1.38, z: 0.05, rotY: 1.5, sx: 1.15, sy: 1.1, sz: 1.15 },
   { kind: "pot", tone: 0, x: 2.4, y: 1.98, z: -0.25, rotY: 2.1, sx: 0.9, sy: 0.85, sz: 0.9 },
   { kind: "pot", tone: 1, x: 2.4, y: 1.98, z: 0.15, rotY: -0.4, sx: 1.05, sy: 1, sz: 1.05 },

   // --- Right wall: hanging copper pans ---
   { kind: "pan", x: 2.05, y: 2.25, z: 0.55, rotY: -Math.PI / 2, rotZ: 0.06, sx: 1, sy: 1, sz: 1 },
   { kind: "pan", x: 2.05, y: 2.4, z: -0.1, rotY: -Math.PI / 2, rotZ: -0.04, sx: 1.2, sy: 1.2, sz: 1.2 },

   // --- Hanging garlic & herbs ---
   { kind: "garlic", x: 2.15, y: 2.35, z: 0.9, rotY: 0.2, sx: 1, sy: 1, sz: 1 },
   { kind: "garlic", x: -3.35, y: 2.38, z: 1.1, rotY: -0.4, sx: 1, sy: 1, sz: 1 },

   // --- Back wall: spooky-cute night windows (z <= -3.3) ---
   { kind: "window", x: -4.1, y: 2.45, z: -3.35, rotY: 0, sx: 1.3, sy: 1.7, sz: 0.25 },
   { kind: "window", x: 3.6, y: 2.45, z: -3.35, rotY: 0, sx: 1.3, sy: 1.7, sz: 0.25 },
];

export function decorOf(kind: DecorSpot["kind"]): DecorSpot[] {
   return DECOR.filter((s) => s.kind === kind);
}

export interface CakeSpot {
   x: number;
   z: number;
   rotY: number;
}

/**
 * Slime-cake display copies (the slimeCake GLB), drawn only on levels 4 and 5 (Dinner Rush /
 * Grand Feast). Floor spots strictly outside PLAY_BOUNDS, among the other floor decor.
 */
export const SLIME_CAKE_SPOTS: readonly CakeSpot[] = [
   { x: -3.6, z: -2.2, rotY: 0.35 },
   { x: -4.15, z: -2.35, rotY: -0.8 },
   { x: 2.7, z: -1.65, rotY: 1.2 },
   { x: 3.6, z: 1.7, rotY: 2.4 },
];

// ---------- WCAG Contrast Ratio ----------

function channel(c: number): number {
   const s = c / 255;
   return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(a: string, b: string): number {
   const lum = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      return (
         0.2126 * channel((n >> 16) & 255) +
         0.7152 * channel((n >> 8) & 255) +
         0.0722 * channel(n & 255)
      );
   };
   const hi = Math.max(lum(a), lum(b));
   const lo = Math.min(lum(a), lum(b));
   return (hi + 0.05) / (lo + 0.05);
}

// ---------- Tiled Kitchen Floor Texture ----------

export const drawKitchenTiles: CanvasDraw = (ctx, width, height) => {
   // Warm mortar grout background
   ctx.fillStyle = COLORS.floorGrout;
   ctx.fillRect(0, 0, width, height);

   const cols = 8;
   const rows = 8;
   const tileW = width / cols;
   const tileH = height / rows;
   const gap = 3;

   const tones = [
      COLORS.floorTile,
      COLORS.floorTileAlt,
      "#8d4c14",
      "#7b3d11",
      "#944d18",
   ];

   for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
         const x = c * tileW + gap / 2;
         const y = r * tileH + gap / 2;
         const w = tileW - gap;
         const h = tileH - gap;

         const toneIdx = (c * 3 + r * 5 + ((c + r) % 2)) % tones.length;
         ctx.fillStyle = tones[toneIdx];
         ctx.fillRect(x, y, w, h);

         // Soft top-left bevel highlight
         ctx.fillStyle = "rgba(255, 230, 200, 0.16)";
         ctx.fillRect(x, y, w, 2);
         ctx.fillRect(x, y, 2, h);

         // Soft bottom-right bevel shadow
         ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
         ctx.fillRect(x, y + h - 2, w, 2);
         ctx.fillRect(x + w - 2, y, 2, h);

         // Subtle tile surface texture flecks
         ctx.fillStyle = "rgba(255, 220, 180, 0.06)";
         ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
      }
   }
};
