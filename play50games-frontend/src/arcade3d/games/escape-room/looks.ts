// Tiny Escape Room visual styling. Pure data: palette, level looks, fog,
// decor spots, and contrast helpers.
// No React, no three.js - uploaded by Scene, Decor and Primitives.
import type { LightingPreset } from "@/arcade3d/core/types";
import type { LevelId } from "@/arcade3d/types";

export const COLORS = {
   // Room floor: warm rich oak parquet planks
   floorWood: "#854d0e",
   floorWoodLight: "#a16207",
   floorWoodDark: "#713f12",
   floorWoodJoint: "#5c3a21",

   // Extended foundation/corridor floor outside the room
   floorSub: "#1c1917",
   floorSubBorder: "#292524",

   // Architectural trim and room walls
   skirting: "#5c2e0b",
   wallWood: "#451a03",
   wallTrim: "#78350f",
   wallPaint: "#334155",
   wallPaintWarm: "#e2e8f0",

   // Furniture & shelves (walnut / mahogany)
   shelfWood: "#5c2e0b",
   shelfWoodDark: "#3e1f0d",

   // Books on shelves (rich leather and gem tones with gold gilt)
   bookRed: "#991b1b",
   bookBlue: "#1e3a8a",
   bookGreen: "#065f46",
   bookGold: "#d97706",
   bookLeather: "#78350f",
   bookGilt: "#fbbf24",

   // Framed art
   frameWood: "#292524",
   frameCanvas: "#fef3c7",
   frameArtA: "#b45309",
   frameArtB: "#1e3a8a",

   // Indoor potted plants
   plantPot: "#c2410c",
   plantPotRim: "#ea580c",
   plantLeaf: "#15803d",
   plantLeafDark: "#166534",
   plantLeafBright: "#22c55e",
   plantSoil: "#292524",

   // Warm desk lamps
   lampBrass: "#d97706",
   lampShade: "#15803d",
   lampGlow: "#fef08a",

   // Window
   windowFrame: "#f8fafc",
   windowGlass: "#93c5fd",

   // Door & glowing frame
   doorWood: "#451a03",
   doorTrim: "#78350f",
   doorFrame: "#292524",
   doorGlow: "#fbbf24",
   doorEmissive: "#eab308",
   doorKnob: "#fbbf24",

   // Stations moving parts
   cupboardBody: "#5c2e0b",
   cupboardInner: "#d97706",
   cupboardDoor: "#451a03",
   cupboardHandle: "#fbbf24",

   drawerBody: "#78350f",
   drawerFace: "#5c2e0b",
   drawerPull: "#fbbf24",

   boxBody: "#451a03",
   boxStrap: "#292524",
   boxLock: "#fbbf24",

   // Stand-in desks and chairs
   deskTop: "#854d0e",
   deskBody: "#5c2e0b",
   deskPad: "#1e293b",
   chairWood: "#78350f",
   chairCushion: "#831843",

   // Runner stand-in
   runnerJacket: "#ea580c",
   runnerTrousers: "#1e293b",
   runnerBoots: "#0f172a",
   runnerSkin: "#fed7aa",
   runnerHair: "#78350f",
   runnerBadge: "#fbbf24",

   // Interactive feedback and markers
   accentYellow: "#eab308",

   // Scene background, fog and sky
   bg: "#1f2937",
   fog: "#1f2937",
   skyTop: "#0f172a",
   skyBottom: "#d97706",
} as const;

export interface LevelLook {
   lighting: LightingPreset;
   skyTop: string;
   skyBottom: string;
   fog: string;
   bg: string;
}

export const LEVEL_LOOKS: Record<LevelId, LevelLook> = {
   1: { lighting: "indoor", skyTop: "#111827", skyBottom: "#b45309", fog: "#1f2937", bg: "#1f2937" },
   2: { lighting: "indoor", skyTop: "#182337", skyBottom: "#92400e", fog: "#1f2937", bg: "#1f2937" },
   3: { lighting: "sunset", skyTop: "#3b1e54", skyBottom: "#f97316", fog: "#451a03", bg: "#451a03" },
   4: { lighting: "night", skyTop: "#030712", skyBottom: "#1e293b", fog: "#0b1020", bg: "#0b1020" },
   5: { lighting: "space", skyTop: "#020617", skyBottom: "#0f172a", fog: "#020617", bg: "#020617" },
};

/** Linear fog. `near` is past the far room corner from the fitted cameras, so play stays crisp. */
export const FOG = { near: 56, far: 95 } as const;

/** Playable floor bounds: x in [-6, 6], z in [-5, 5]. */
export const PLAY_BOUNDS = { minX: -6.0, maxX: 6.0, minZ: -5.0, maxZ: 5.0 } as const;

/** Physical guard bounds: x in [-6.2, 6.2], z in [-5.2, 5.2]. */
export const GUARD_BOUNDS = { minX: -6.2, maxX: 6.2, minZ: -5.2, maxZ: 5.2 } as const;

export function inPlayArea(x: number, z: number): boolean {
   return x >= PLAY_BOUNDS.minX && x <= PLAY_BOUNDS.maxX && z >= PLAY_BOUNDS.minZ && z <= PLAY_BOUNDS.maxZ;
}

export function inGuardBounds(x: number, z: number): boolean {
   return x >= GUARD_BOUNDS.minX && x <= GUARD_BOUNDS.maxX && z >= GUARD_BOUNDS.minZ && z <= GUARD_BOUNDS.maxZ;
}

/** Distance from a camera to the furthest room corner at z = -5.2, x = ±6.2, y = 2.1. */
export function farRoomDistance(camera: { x: number; y: number; z: number }): number {
   let max = 0;
   for (const x of [-6.2, 6.2]) {
      for (const y of [0, 2.1]) {
         const d = Math.hypot(x - camera.x, y - camera.y, -5.2 - camera.z);
         if (d > max) max = d;
      }
   }
   return max;
}

function channel(c: number): number {
   const s = c / 255;
   return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG contrast ratio of two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
   const lum = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
   };
   const hi = Math.max(lum(a), lum(b));
   const lo = Math.min(lum(a), lum(b));
   return (hi + 0.05) / (lo + 0.05);
}

export interface DecorSpot {
   kind: "shelf" | "bookRow" | "plant" | "picture" | "lamp" | "window" | "wallPanel" | "moulding";
   x: number;
   y: number;
   z: number;
   rotY?: number;
   sx?: number;
   sy?: number;
   sz?: number;
}

/**
 * Decor spots strictly OUTSIDE the play area bounds (|x| > 6.0 || |z| > 5.0).
 * All tall decor (shelves, pictures, window, plants, lamps) sits behind the back wall (z <= -5.3)
 * or to the far left (x <= -6.3), so they never occlude any play target from the fitted camera.
 */
export const DECOR_SPOTS: readonly DecorSpot[] = [
   // Back wall main panels (behind room at z = -5.35, height 3.6)
   { kind: "wallPanel", x: -9.5, y: 1.8, z: -5.35, sx: 7, sy: 3.6, sz: 0.2 },
   { kind: "wallPanel", x: -3.8, y: 1.8, z: -5.35, sx: 4.4, sy: 3.6, sz: 0.2 },
   { kind: "wallPanel", x: 3.8, y: 1.8, z: -5.35, sx: 4.4, sy: 3.6, sz: 0.2 },
   { kind: "wallPanel", x: 9.5, y: 1.8, z: -5.35, sx: 7, sy: 3.6, sz: 0.2 },

   // Left wall panels (x = -6.35, extending from z = -5.35 to +6.5)
   { kind: "wallPanel", x: -6.35, y: 1.8, z: -2.5, rotY: Math.PI / 2, sx: 6, sy: 3.6, sz: 0.2 },
   { kind: "wallPanel", x: -6.35, y: 1.8, z: 3.5, rotY: Math.PI / 2, sx: 6, sy: 3.6, sz: 0.2 },

   // Top cornice moulding along back wall (y = 3.65)
   { kind: "moulding", x: -9.5, y: 3.65, z: -5.3, sx: 7, sy: 0.16, sz: 0.28 },
   { kind: "moulding", x: -3.8, y: 3.65, z: -5.3, sx: 4.4, sy: 0.16, sz: 0.28 },
   { kind: "moulding", x: 3.8, y: 3.65, z: -5.3, sx: 4.4, sy: 0.16, sz: 0.28 },
   { kind: "moulding", x: 9.5, y: 3.65, z: -5.3, sx: 7, sy: 0.16, sz: 0.28 },
   { kind: "moulding", x: -6.3, y: 3.65, z: 0.5, rotY: Math.PI / 2, sx: 12, sy: 0.16, sz: 0.28 },

   // Tall mahogany bookshelves behind the back wall (x = -3.8, x = 3.8; z = -5.25, width 2.2, height 3.1)
   { kind: "shelf", x: -3.8, y: 1.55, z: -5.25, sx: 2.2, sy: 3.1, sz: 0.45 },
   { kind: "shelf", x: 3.8, y: 1.55, z: -5.25, sx: 2.2, sy: 3.1, sz: 0.45 },

   // Rows of colourful books on the shelves
   { kind: "bookRow", x: -3.8, y: 0.65, z: -5.16, sx: 1.9, sy: 0.38, sz: 0.25 },
   { kind: "bookRow", x: -3.8, y: 1.25, z: -5.16, sx: 1.9, sy: 0.38, sz: 0.25 },
   { kind: "bookRow", x: -3.8, y: 1.85, z: -5.16, sx: 1.9, sy: 0.38, sz: 0.25 },
   { kind: "bookRow", x: -3.8, y: 2.45, z: -5.16, sx: 1.9, sy: 0.38, sz: 0.25 },

   { kind: "bookRow", x: 3.8, y: 0.65, z: -5.16, sx: 1.9, sy: 0.38, sz: 0.25 },
   { kind: "bookRow", x: 3.8, y: 1.25, z: -5.16, sx: 1.9, sy: 0.38, sz: 0.25 },
   { kind: "bookRow", x: 3.8, y: 1.85, z: -5.16, sx: 1.9, sy: 0.38, sz: 0.25 },
   { kind: "bookRow", x: 3.8, y: 2.45, z: -5.16, sx: 1.9, sy: 0.38, sz: 0.25 },

   // Large framed pictures on the back and left walls
   { kind: "picture", x: -1.75, y: 2.4, z: -5.22, sx: 1.1, sy: 0.85, sz: 0.08 },
   { kind: "picture", x: 1.75, y: 2.4, z: -5.22, sx: 1.1, sy: 0.85, sz: 0.08 },
   { kind: "picture", x: -6.22, y: 2.4, z: -1.8, rotY: Math.PI / 2, sx: 1.3, sy: 0.9, sz: 0.08 },
   { kind: "picture", x: -6.22, y: 2.4, z: 2.2, rotY: Math.PI / 2, sx: 1.3, sy: 0.9, sz: 0.08 },

   // Window with warm daylight/sky view on the upper back wall (x = -8.2, z = -5.26, width 2.4, height 1.8)
   { kind: "window", x: -8.2, y: 2.2, z: -5.26, sx: 2.4, sy: 1.8, sz: 0.12 },
   { kind: "window", x: 8.2, y: 2.2, z: -5.26, sx: 2.4, sy: 1.8, sz: 0.12 },

   // Potted indoor plants (monstera / ficus) in ceramic planters outside corners
   { kind: "plant", x: -6.6, y: 0.75, z: -5.32, sx: 0.9, sy: 1.5, sz: 0.9 },
   { kind: "plant", x: 6.6, y: 0.75, z: -5.32, sx: 0.9, sy: 1.5, sz: 0.9 },
   { kind: "plant", x: -6.6, y: 0.75, z: 4.8, sx: 0.9, sy: 1.5, sz: 0.9 },

   // Warm banker's lamps on shelf ledges outside the room
   { kind: "lamp", x: -2.85, y: 1.9, z: -5.16, sx: 0.3, sy: 0.42, sz: 0.3 },
   { kind: "lamp", x: 2.85, y: 1.9, z: -5.16, sx: 0.3, sy: 0.42, sz: 0.3 },
] as const;

export function decorOf(kind: DecorSpot["kind"]): DecorSpot[] {
   return DECOR_SPOTS.filter((s) => s.kind === kind);
}
