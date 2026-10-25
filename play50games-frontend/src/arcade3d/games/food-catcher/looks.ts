// Food Catcher modern look: central COLORS palette, lighting presets per level,
// play bounds, and decor spots strictly outside the play area.
// No React, no three.js — pure data used by Scene, Primitives, Decor, and tests.
import type { LightingPreset } from "@/arcade3d/core/types";
import type { LevelId } from "@/arcade3d/types";

/**
 * The active play box that falling items and the chef occupy.
 * Matches Scene.tsx PLAY area: x in [-4.2, 4.2], y in [0, 6.5], z in [-0.9, 1.05].
 */
export const PLAY_AREA = {
   x0: -4.2,
   x1: 4.2,
   y0: 0,
   y1: 6.5,
   z0: -0.9,
   z1: 1.05,
} as const;

/** Checks whether a 3D coordinate sits inside the active play volume. */
export function inPlayArea(x: number, y: number, z: number, margin = 0): boolean {
   return (
      x >= PLAY_AREA.x0 - margin &&
      x <= PLAY_AREA.x1 + margin &&
      y >= PLAY_AREA.y0 - margin &&
      y <= PLAY_AREA.y1 + margin &&
      z >= PLAY_AREA.z0 - margin &&
      z <= PLAY_AREA.z1 + margin
   );
}

/** One central, unified color palette for Food Catcher. */
export const COLORS = {
   // Kitchen architecture & tiles
   wall: "#e2e8f0",
   wallTile: "#f8fafc",
   wallGrout: "#94a3b8",
   tileAccent: "#0284c7",
   tileHighlight: "#ffffff",
   counter: "#94a3b8",
   counterEdge: "#475569",
   worktop: "#b45309",
   worktopBevel: "#d97706",
   cabinet: "#1e293b",
   cabinetTrim: "#334155",
   cabinetHandle: "#e2e8f0",
   floor: "#78350f",
   floorGrout: "#1c1917",
   floorTileAlt: "#9a3412",
   ceiling: "#0f172a",
   exhaustHood: "#64748b",
   exhaustTrim: "#94a3b8",

   // Wall decor & chalkboard (WallDecor)
   slate: "#1e293b",
   chalk: "#f8fafc",
   chalkFaint: "rgba(241, 245, 249, 0.45)",
   frame: "#78350f",
   shelfWood: "#854d0e",
   ironBracket: "#334155",
   copperPot: "#b45309",
   copperDark: "#78350f",
   steelPot: "#94a3b8",
   steelDark: "#475569",
   potKnob: "#1e293b",

   // Instanced surroundings (shelves, jars, window, street, lamps)
   shelfMetal: "#475569",
   shelfPlank: "#854d0e",
   jarGlass: "#7dd3fc",
   jarCork: "#d97706",
   jarSpiceRed: "#ef4444",
   jarSpiceYellow: "#f59e0b",
   jarSpiceGreen: "#10b981",
   jarSpicePurple: "#8b5cf6",
   jarSpiceOrange: "#f97316",
   bottleGlass: "#0284c7",
   bottleOil: "#eab308",
   bottleVinegar: "#831843",
   plateCeramic: "#f8fafc",
   plateRim: "#0284c7",
   canisterCeramic: "#f1f5f9",
   canisterWood: "#b45309",
   utensilRail: "#64748b",
   utensilSteel: "#cbd5e1",
   utensilHandle: "#78350f",
   windowFrame: "#1e293b",
   windowMullion: "#334155",
   windowGlass: "#bae6fd",
   buildingA: "#1e293b",
   buildingB: "#334155",
   buildingRoof: "#78350f",
   streetWarmth: "#fed7aa",
   lampBrass: "#d97706",
   lampGlow: "#fef08a",
   lampCord: "#1e293b",

   // Food and junk items (deliberate 2-3 tone shapes)
   apple: "#dc2626",
   appleShade: "#991b1b",
   appleHighlight: "#f87171",
   leaf: "#16a34a",
   stem: "#78350f",
   bun: "#d97706",
   bunTop: "#f59e0b",
   patty: "#54321d",
   cheese: "#facc15",
   lettuce: "#22c55e",
   tomato: "#ef4444",
   sesame: "#fef3c7",
   banana: "#eab308",
   bananaTip: "#65a30d",
   bananaStem: "#78350f",
   sock: "#9ca3af",
   sockStripe: "#64748b",
   sockPatch: "#78350f",
   sockHole: "#374151",
   tin: "#94a3b8",
   tinBand: "#0369a1",
   tinRim: "#cbd5e1",
   tinLid: "#64748b",
   ring: "#9f1239",
   ringRim: "#f43f5e",
   bonusRing: "#fbbf24",

   // Chef stand-in
   hat: "#f8fafc",
   hatBand: "#e2e8f0",
   apron: "#f1f5f9",
   skin: "#f6c7a1",
   skinCheek: "#fda4af",
   scarf: "#ef4444",
   buttons: "#1e293b",
} as const;

/**
 * Lighting preset, background, fog, and sky dome settings per level.
 * Level 1 matches today's indoor kitchen; levels 2-5 apply the planned atmospheres.
 */
export interface LevelLook {
   lighting: LightingPreset;
   background: string;
   fog: string;
   skyTop: string;
   skyBottom: string;
}

export const LEVEL_LOOKS: Record<LevelId, LevelLook> = {
   1: {
      lighting: "indoor",
      background: "#1c1410",
      fog: "#f1f5f9",
      skyTop: "#1e293b",
      skyBottom: "#38bdf8",
   },
   2: {
      lighting: "day",
      background: "#21170f",
      fog: "#e2e8f0",
      skyTop: "#0284c7",
      skyBottom: "#7dd3fc",
   },
   3: {
      lighting: "sunset",
      background: "#302016",
      fog: "#fed7aa",
      skyTop: "#312e81",
      skyBottom: "#fb923c",
   },
   4: {
      lighting: "night",
      background: "#101018",
      fog: "#1e1b4b",
      skyTop: "#030712",
      skyBottom: "#1e1b4b",
   },
   5: {
      lighting: "sunset",
      background: "#2a0f14",
      fog: "#fecdd3",
      skyTop: "#4c0519",
      skyBottom: "#f43f5e",
   },
};

/** Linear color channel expansion for sRGB -> linear luminances. */
function channel(c: number): number {
   const s = c / 255;
   return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG contrast ratio of two #rrggbb hex strings. */
export function contrastRatio(a: string, b: string): number {
   const lum = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
   };
   const hi = Math.max(lum(a), lum(b));
   const lo = Math.min(lum(a), lum(b));
   return (hi + 0.05) / (lo + 0.05);
}

// ---------------- Decor spots outside the play area ----------------

export interface DecorSpot {
   kind:
      | "shelfPost"
      | "shelfPlank"
      | "jar"
      | "bottle"
      | "ceramic"
      | "canister"
      | "utensilRail"
      | "utensil"
      | "window"
      | "building"
      | "streetLamp"
      | "exhaustHood"
      | "overheadPan"
      | "pendantLamp";
   x: number;
   y: number;
   z: number;
   sx: number;
   sy: number;
   sz: number;
   rotY?: number;
   rotZ?: number;
   color?: string;
}

// Left shelving unit: x <= -4.8 (posts, planks, jars, bottles, bowls, canisters)
export const SHELF_POST_SPOTS: readonly DecorSpot[] = [
   { kind: "shelfPost", x: -7.4, y: 3.5, z: -0.35, sx: 0.07, sy: 7.0, sz: 0.07 },
   { kind: "shelfPost", x: -7.4, y: 3.5, z: 0.15, sx: 0.07, sy: 7.0, sz: 0.07 },
   { kind: "shelfPost", x: -4.95, y: 3.5, z: -0.35, sx: 0.07, sy: 7.0, sz: 0.07 },
   { kind: "shelfPost", x: -4.95, y: 3.5, z: 0.15, sx: 0.07, sy: 7.0, sz: 0.07 },
];

export const SHELF_PLANK_SPOTS: readonly DecorSpot[] = [
   { kind: "shelfPlank", x: -6.18, y: 1.3, z: -0.1, sx: 2.5, sy: 0.06, sz: 0.58 },
   { kind: "shelfPlank", x: -6.18, y: 2.8, z: -0.1, sx: 2.5, sy: 0.06, sz: 0.58 },
   { kind: "shelfPlank", x: -6.18, y: 4.3, z: -0.1, sx: 2.5, sy: 0.06, sz: 0.58 },
   { kind: "shelfPlank", x: -6.18, y: 5.8, z: -0.1, sx: 2.5, sy: 0.06, sz: 0.58 },
];

export const JAR_SPOTS: readonly DecorSpot[] = [
   { kind: "jar", x: -7.0, y: 1.48, z: -0.1, sx: 0.22, sy: 0.32, sz: 0.22, color: COLORS.jarSpiceRed },
   { kind: "jar", x: -6.5, y: 1.48, z: -0.1, sx: 0.22, sy: 0.32, sz: 0.22, color: COLORS.jarSpiceYellow },
   { kind: "jar", x: -6.0, y: 1.48, z: -0.1, sx: 0.22, sy: 0.32, sz: 0.22, color: COLORS.jarSpiceGreen },
   { kind: "jar", x: -5.5, y: 1.48, z: -0.1, sx: 0.22, sy: 0.32, sz: 0.22, color: COLORS.jarSpiceOrange },
   { kind: "jar", x: -5.1, y: 1.48, z: -0.1, sx: 0.22, sy: 0.32, sz: 0.22, color: COLORS.jarSpicePurple },
];

export const BOTTLE_SPOTS: readonly DecorSpot[] = [
   { kind: "bottle", x: -7.0, y: 3.12, z: -0.1, sx: 0.18, sy: 0.58, sz: 0.18, color: COLORS.bottleOil },
   { kind: "bottle", x: -6.5, y: 3.12, z: -0.1, sx: 0.18, sy: 0.58, sz: 0.18, color: COLORS.bottleVinegar },
   { kind: "bottle", x: -6.0, y: 3.12, z: -0.1, sx: 0.18, sy: 0.58, sz: 0.18, color: COLORS.bottleOil },
   { kind: "bottle", x: -5.5, y: 3.12, z: -0.1, sx: 0.18, sy: 0.58, sz: 0.18, color: COLORS.bottleVinegar },
   { kind: "bottle", x: -5.1, y: 3.12, z: -0.1, sx: 0.18, sy: 0.58, sz: 0.18, color: COLORS.bottleOil },
];

export const CERAMIC_SPOTS: readonly DecorSpot[] = [
   { kind: "ceramic", x: -6.9, y: 4.52, z: -0.1, sx: 0.36, sy: 0.26, sz: 0.36 },
   { kind: "ceramic", x: -6.3, y: 4.46, z: -0.1, sx: 0.44, sy: 0.18, sz: 0.44 },
   { kind: "ceramic", x: -5.7, y: 4.46, z: -0.1, sx: 0.44, sy: 0.18, sz: 0.44 },
   { kind: "ceramic", x: -5.2, y: 4.52, z: -0.1, sx: 0.36, sy: 0.26, sz: 0.36 },
];

export const CANISTER_SPOTS: readonly DecorSpot[] = [
   { kind: "canister", x: -6.9, y: 6.05, z: -0.1, sx: 0.3, sy: 0.44, sz: 0.3 },
   { kind: "canister", x: -6.2, y: 6.05, z: -0.1, sx: 0.3, sy: 0.44, sz: 0.3 },
   { kind: "canister", x: -5.5, y: 6.05, z: -0.1, sx: 0.3, sy: 0.44, sz: 0.3 },
   { kind: "canister", x: -4.95, y: 6.05, z: -0.1, sx: 0.26, sy: 0.38, sz: 0.26 },
];

// Right prep station & street window: x >= 4.8
export const UTENSIL_RAIL_SPOT: DecorSpot = {
   kind: "utensilRail",
   x: 6.2,
   y: 2.2,
   z: -0.72,
   sx: 2.4,
   sy: 0.05,
   sz: 0.05,
};

export const UTENSIL_SPOTS: readonly DecorSpot[] = [
   { kind: "utensil", x: 5.3, y: 1.75, z: -0.7, sx: 0.16, sy: 0.62, sz: 0.08 },
   { kind: "utensil", x: 5.8, y: 1.75, z: -0.7, sx: 0.16, sy: 0.62, sz: 0.08 },
   { kind: "utensil", x: 6.3, y: 1.75, z: -0.7, sx: 0.16, sy: 0.62, sz: 0.08 },
   { kind: "utensil", x: 6.8, y: 1.75, z: -0.7, sx: 0.16, sy: 0.62, sz: 0.08 },
   { kind: "utensil", x: 7.3, y: 1.75, z: -0.7, sx: 0.16, sy: 0.62, sz: 0.08 },
];

export const WINDOW_SPOT: DecorSpot = {
   kind: "window",
   x: 6.5,
   y: 4.6,
   z: -0.76,
   sx: 2.6,
   sy: 3.2,
   sz: 0.12,
};

export const STREET_BUILDING_SPOTS: readonly DecorSpot[] = [
   { kind: "building", x: 5.6, y: 4.0, z: -3.2, sx: 1.6, sy: 3.8, sz: 1.2, color: COLORS.buildingA },
   { kind: "building", x: 7.3, y: 4.4, z: -3.5, sx: 1.8, sy: 4.5, sz: 1.2, color: COLORS.buildingB },
   { kind: "streetLamp", x: 6.1, y: 3.8, z: -2.8, sx: 0.28, sy: 2.2, sz: 0.28, color: COLORS.streetWarmth },
];

// Overhead exhaust hood, hanging pan rack & pendant lamps: y >= 7.3
export const EXHAUST_HOOD_SPOT: DecorSpot = {
   kind: "exhaustHood",
   x: 0,
   y: 8.4,
   z: 0.2,
   sx: 18.0,
   sy: 1.8,
   sz: 2.2,
};

export const OVERHEAD_PAN_SPOTS: readonly DecorSpot[] = [
   { kind: "overheadPan", x: -6.0, y: 7.35, z: 0.3, sx: 0.42, sy: 0.42, sz: 0.42, rotY: 0.4 },
   { kind: "overheadPan", x: -3.0, y: 7.35, z: 0.3, sx: 0.42, sy: 0.42, sz: 0.42, rotY: -0.3 },
   { kind: "overheadPan", x: 3.0, y: 7.35, z: 0.3, sx: 0.42, sy: 0.42, sz: 0.42, rotY: 0.2 },
   { kind: "overheadPan", x: 6.0, y: 7.35, z: 0.3, sx: 0.42, sy: 0.42, sz: 0.42, rotY: -0.4 },
];

export const PENDANT_LAMP_SPOTS: readonly DecorSpot[] = [
   { kind: "pendantLamp", x: -6.5, y: 7.6, z: 0.5, sx: 0.48, sy: 0.4, sz: 0.48 },
   { kind: "pendantLamp", x: -2.2, y: 7.6, z: 0.5, sx: 0.48, sy: 0.4, sz: 0.48 },
   { kind: "pendantLamp", x: 2.2, y: 7.6, z: 0.5, sx: 0.48, sy: 0.4, sz: 0.48 },
   { kind: "pendantLamp", x: 6.5, y: 7.6, z: 0.5, sx: 0.48, sy: 0.4, sz: 0.48 },
];

/** All individual decor elements gathered for boundary and camera occlusion checks. */
export const ALL_DECOR_SPOTS: readonly DecorSpot[] = [
   ...SHELF_POST_SPOTS,
   ...SHELF_PLANK_SPOTS,
   ...JAR_SPOTS,
   ...BOTTLE_SPOTS,
   ...CERAMIC_SPOTS,
   ...CANISTER_SPOTS,
   UTENSIL_RAIL_SPOT,
   ...UTENSIL_SPOTS,
   WINDOW_SPOT,
   ...STREET_BUILDING_SPOTS,
   EXHAUST_HOOD_SPOT,
   ...OVERHEAD_PAN_SPOTS,
   ...PENDANT_LAMP_SPOTS,
];
