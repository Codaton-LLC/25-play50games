// Pirate Cannon Battle looks: camera fitting, unified Caribbean palette, decor placements,
// and safety boundaries. Pure: no three.js or React runtime here.
import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";

const DEG = Math.PI / 180;

/** The canvas camera's fov (definition.camera.fov). */
export const FOV = 50;

/**
 * The camera pitch. 30° shows the cannon at the bottom and spreads the lanes up the screen;
 * landscape goes to 36° (lanes take a third of screen, cannon two thirds down), portrait keeps 30°.
 */
export const PITCH = { landscape: 36 * DEG, portrait: 30 * DEG } as const;

/** The three lanes (with zig-zags and hit spheres) and the cannon: what must stay on screen. */
export const SEA_BOX: AABB = { min: { x: -19, y: 0, z: -60 }, max: { x: 19, y: 6, z: 0 } };

/** The point the camera looks at: the box's floor centre (useFittedView's default focus). */
export const SEA_FOCUS: [number, number, number] = [0, 0, -30];

const YAWS = [0];
const MARGIN = { top: 0.08, bottom: 0.03, left: 0.02, right: 0.02 };
const view = (pitch: number): FittedViewOptions => ({ area: SEA_BOX, pitch, yaws: YAWS, margin: MARGIN, padding: 8, shift: true, fov: FOV });
const VIEWS = { landscape: view(PITCH.landscape), portrait: view(PITCH.portrait) };

/** The fit for this canvas (one cached object per orientation, so useFittedView refits only on a turn). */
export function viewFor(width: number, height: number): FittedViewOptions {
   return width >= height ? VIEWS.landscape : VIEWS.portrait;
}

/**
 * Unified Caribbean palette. 2-3 tones per object from this one table,
 * providing sunny warm golden light, tropical turquoise waters, and high readability.
 */
export const COLORS = {
   /** the sky: the canvas background and the fog, one colour so the far horizon meets it */
   skyTop: "#0284c7",
   sky: "#bae6fd",
   fog: "#bae6fd",
   cloud: "#ffffff",
   cloudShade: "#e0f2fe",

   /** Sea and water: luminous turquoise shallows and rich deep ocean */
   sea: "#0ea5e9",
   farSea: "#0284c7",
   deep: "#0369a1",
   foam: "#f0fdfa",
   surf: "#f0fdfa",

   /** Sand, islets, and coastal geology */
   sand: "#fde68a",
   sandWet: "#d4b46a",
   cliff: "#8c7b64",
   cliffTop: "#4d7c0f",
   grass: "#65a30d",
   rock: "#78716c",
   rockDark: "#57534e",

   /** Fort masonry and gun platform */
   stone: "#e7dfd5",
   stoneTrim: "#d6c8b4",
   stoneDark: "#8c7b64",
   stoneBase: "#6b5d4d",
   parapetCoping: "#f5ede3",
   woodDeck: "#9a5b28",
   deckPlank: "#7c3f15",

   /** Palms and tropical flora */
   palm: "#4d7c0f",
   palmDark: "#365314",
   trunk: "#a16207",
   trunkDark: "#78350f",
   coconut: "#713f12",

   /** Ships, props, and gameplay elements */
   wood: "#92400e",
   woodLight: "#b45309",
   sail: "#f8fafc",
   coral: "#fca5a5",
   accent: "#f87171",
   ball: "#1e293b",
   dots: "#fde047",
   ring: "#fde047",
   buoyRed: "#ef4444",
   buoyWhite: "#f8fafc",
   flag: "#f87171",
   barrel: "#dc2626",
   barrelWood: "#78350f",
   barrelBand: "#1e293b",
   chest: "#854d0e",
   chestGold: "#eab308",
   bronze: "#d97706",
   iron: "#1e293b",
   bird: "#ffffff",
   birdWing: "#cbd5e1",
   beacon: "#fef08a",
} as const;

/** The fort: the platform (top y = rules CANNON.platformY) and its parapet along the sea side, kept under the lowest shot. */
export const FORT = { halfX: 2.8, front: -1.9, back: 3.2, bottom: -1, parapetTop: 2.55, parapetDepth: 0.4 } as const;

/**
 * Play area bounds (including ship spawn hulls at x -24.5, harbour crossing past x +18 to +21,
 * galleon zig-zag lane margins z -58 to -22, and cannon fort at x ±3, z -2 to 3.2).
 * Every decor spot must be strictly OUTSIDE this bounding volume.
 */
export const PLAY_BOUNDS = {
   x0: -26.0,
   x1: 23.0,
   z0: -62.0,
   z1: 3.5,
   y0: -1.0,
   y1: 8.0,
} as const;

/** Returns true if a given (x, z) point is within the active play bounds (grown by optional margin). */
export function inPlayArea(x: number, z: number, margin = 0): boolean {
   return (
      x >= PLAY_BOUNDS.x0 - margin &&
      x <= PLAY_BOUNDS.x1 + margin &&
      z >= PLAY_BOUNDS.z0 - margin &&
      z <= PLAY_BOUNDS.z1 + margin
   );
}

export interface DecorSpot {
   x: number;
   y: number;
   z: number;
   rotY?: number;
   sx?: number;
   sy?: number;
   sz?: number;
}

/** Distant cliffs, headlands, and background island ridges framing the cove. All at z <= -75. */
export const CLIFF_SPOTS: readonly DecorSpot[] = [
   { x: -46, y: 0, z: -92, rotY: 0.35, sx: 20, sy: 16, sz: 16 },
   { x: -62, y: 0, z: -80, rotY: 0.62, sx: 18, sy: 20, sz: 18 },
   { x: -38, y: 0, z: -112, rotY: -0.2, sx: 24, sy: 14, sz: 18 },
   { x: 48, y: 0, z: -88, rotY: -0.42, sx: 19, sy: 17, sz: 16 },
   { x: 62, y: 0, z: -76, rotY: -0.68, sx: 17, sy: 19, sz: 18 },
   { x: 38, y: 0, z: -108, rotY: 0.25, sx: 22, sy: 15, sz: 17 },
   { x: -12, y: 0, z: -138, rotY: 0.1, sx: 36, sy: 12, sz: 22 },
   { x: 20, y: 0, z: -145, rotY: -0.15, sx: 32, sy: 11, sz: 20 },
] as const;

/** Distant cliffside citadel perched on the high left headland overlooking the Caribbean approaches. */
export const DISTANT_FORT_SPOT: DecorSpot = { x: -46, y: 15.5, z: -92, rotY: 0.35, sx: 1, sy: 1, sz: 1 };

/** Sandy islets with palm groves and reef rocks, strictly flanking the bay outside the lanes. */
export const ISLET_SPOTS: readonly DecorSpot[] = [
   { x: -35, y: 0, z: -38, rotY: 0.2, sx: 4.8, sy: 1.1, sz: 4.4 },
   { x: -31, y: 0, z: -15, rotY: 0.8, sx: 3.4, sy: 0.85, sz: 3.2 },
   { x: 34, y: 0, z: -42, rotY: -0.4, sx: 4.2, sy: 0.95, sz: 3.8 },
   { x: 31, y: 0, z: -18, rotY: 0.5, sx: 3.2, sy: 0.8, sz: 3.0 },
] as const;

/** Breaking surf and foam rings around outer islets and reef boulders. */
export const SURF_SPOTS: readonly DecorSpot[] = [
   { x: -35, y: 0.03, z: -38, sx: 5.6, sy: 1, sz: 5.2 },
   { x: -31, y: 0.03, z: -15, sx: 4.0, sy: 1, sz: 3.8 },
   { x: 34, y: 0.03, z: -42, sx: 5.0, sy: 1, sz: 4.6 },
   { x: 31, y: 0.03, z: -18, sx: 3.8, sy: 1, sz: 3.6 },
   { x: -38, y: 0.03, z: -44, sx: 2.4, sy: 1, sz: 2.4 },
   { x: 36, y: 0.03, z: -48, sx: 2.4, sy: 1, sz: 2.4 },
] as const;

/** Low-poly reef boulders scattered around outer islets and headlands. */
export const ROCK_SPOTS: readonly DecorSpot[] = [
   { x: -38, y: 0, z: -41, rotY: 0.4, sx: 1.3, sy: 1.4, sz: 1.2 },
   { x: -32, y: 0, z: -43, rotY: 1.1, sx: 1.0, sy: 1.1, sz: 0.9 },
   { x: -33, y: 0, z: -18, rotY: 2.1, sx: 1.2, sy: 1.3, sz: 1.1 },
   { x: -29, y: 0, z: -12, rotY: 0.7, sx: 0.9, sy: 1.0, sz: 0.8 },
   { x: 36, y: 0, z: -46, rotY: 0.5, sx: 1.4, sy: 1.4, sz: 1.2 },
   { x: 31, y: 0, z: -46, rotY: 1.8, sx: 1.0, sy: 1.1, sz: 0.9 },
   { x: 33, y: 0, z: -15, rotY: 2.5, sx: 1.1, sy: 1.1, sz: 1.0 },
   { x: 29, y: 0, z: -22, rotY: 0.3, sx: 0.8, sy: 0.9, sz: 0.8 },
   { x: -46, y: 0, z: -78, rotY: 1.4, sx: 2.4, sy: 2.6, sz: 2.0 },
   { x: 44, y: 0, z: -76, rotY: 0.9, sx: 2.2, sy: 2.4, sz: 1.9 },
] as const;

/** Coconut palms on outer islets. */
export const PALM_DECOR_SPOTS: readonly DecorSpot[] = [
   { x: -35.5, y: 1.0, z: -38.5, rotY: 0.6, sx: 1.0, sy: 1.05, sz: 1.0 },
   { x: -33.8, y: 0.85, z: -37.2, rotY: 2.2, sx: 0.85, sy: 0.9, sz: 0.85 },
   { x: 33.5, y: 0.9, z: -42.5, rotY: 1.4, sx: 0.95, sy: 1.0, sz: 0.95 },
   { x: 34.8, y: 0.8, z: -41.0, rotY: 3.1, sx: 0.8, sy: 0.85, sz: 0.8 },
] as const;

/** Cumulus clouds high in the sky, drifting gently across the bay. */
export const CLOUDS: readonly DecorSpot[] = [
   { x: -48, y: 34, z: -95, sx: 14, sy: 5.5, sz: 9 },
   { x: -16, y: 36, z: -125, sx: 18, sy: 6.5, sz: 11 },
   { x: 22, y: 33, z: -105, sx: 15, sy: 5.8, sz: 10 },
   { x: 52, y: 35, z: -90, sx: 13, sy: 5.2, sz: 8.5 },
   { x: -2, y: 38, z: -140, sx: 20, sy: 7.0, sz: 12 },
] as const;

export const CLOUD_DRIFT = 2.4;

/** Tropical seagulls flock configuration. Circling over the distant cliffs. */
export const BIRDS = {
   count: 5,
   centerX: -32,
   centerZ: -78,
   radiusX: 7.0,
   radiusZ: 4.5,
   y: 16.5,
} as const;

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

/**
 * Each level's weather and sea (README "Levels"): the core light, sky, sea tones, how rough the
 * water runs, and what joins the bay: moored ships in the harbour (2), a sailing fleet on the
 * horizon (3), a storm with rain and lightning (4), the captain's flagship lying off the far lane
 * (5). Looks only: the rules, the lanes and the limits are the same. Level 1 is today's bay.
 */
export interface BayTheme {
   lighting: "day" | "sunset" | "night";
   skyTop: string;
   sky: string;
   sea: string;
   farSea: string;
   deep: string;
   foam: string;
   /** wave height (m) and speed factor */
   amplitude: number;
   waveSpeed: number;
   rain: boolean;
   lightning: boolean;
   /** background ships: moored in the harbour, sailing the horizon, the flagship */
   ships: "none" | "moored" | "fleet" | "flagship";
}

export const BAY_THEMES: Record<1 | 2 | 3 | 4 | 5, BayTheme> = {
   1: { lighting: "day", skyTop: COLORS.skyTop, sky: COLORS.sky, sea: COLORS.sea, farSea: COLORS.farSea, deep: COLORS.deep, foam: COLORS.foam, amplitude: 0.16, waveSpeed: 0.75, rain: false, lightning: false, ships: "none" },
   2: { lighting: "day", skyTop: "#0ea5e9", sky: "#fde68a", sea: "#14b8a6", farSea: "#0f766e", deep: "#115e59", foam: "#f0fdfa", amplitude: 0.12, waveSpeed: 0.6, rain: false, lightning: false, ships: "moored" },
   3: { lighting: "sunset", skyTop: "#7c3aed", sky: "#fdba74", sea: "#0e7490", farSea: "#164e63", deep: "#083344", foam: "#fed7aa", amplitude: 0.2, waveSpeed: 0.85, rain: false, lightning: false, ships: "fleet" },
   4: { lighting: "night", skyTop: "#020617", sky: "#334155", sea: "#1e3a5f", farSea: "#0f172a", deep: "#0b1324", foam: "#cbd5e1", amplitude: 0.32, waveSpeed: 1.3, rain: true, lightning: true, ships: "none" },
   5: { lighting: "sunset", skyTop: "#450a0a", sky: "#f97316", sea: "#1d4ed8", farSea: "#1e3a8a", deep: "#172554", foam: "#fde68a", amplitude: 0.2, waveSpeed: 0.9, rain: false, lightning: false, ships: "flagship" },
};

