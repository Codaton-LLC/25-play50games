// Treasure Island looks that are worth a test: the ground and water heights (so the drawn shoreline
// is the rules' shore(t)), the follow camera's window per screen, where the decor crabs sit,
// and the surrounding decor outside the play area.
// Pure: no three.js, no React. The rules stay flat (y = 0); only the drawing uses these heights.
import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { FIXED, ISLAND, TIDE, clearance, rho, type Island } from "./rules";

// ---------- unified color palette ----------

export const COLORS = {
   // Sky & Atmosphere
   skyTop: "#1e3a8a",
   skyBottom: "#fdba74",
   fog: "#fdba74",

   // Ground & Island
   sand: "#f5d8a0",
   sandRipple: "#edd092",
   sandSun: "#fae6be",
   wetSand: "#c49a62",
   grass: "#65a30d",
   grassSun: "#84cc16",
   grassDark: "#3f6212",
   jungleEdge: "#4d7c0f",

   // Tropical Sea & Reef
   sea: "#14b8a6",
   seaShallow: "#2dd4bf",
   deep: "#0f766e",
   deepLagoon: "#0d6e67",
   oceanBed: "#042f2e",
   underwaterSand: "#5fa8a3",
   foam: "#f0fdfa",
   surfFoam: "#e6fffa",

   // Rocks
   rock: "#78716c",
   rockSun: "#a8a29e",
   rockDark: "#44403c",

   // Palms & Foliage
   palm: "#4d7c0f",
   palmLeafSun: "#65a30d",
   palmTrunk: "#78350f",
   palmRing: "#9a3412",
   trunk: "#78350f",

   // Wood & Props
   wood: "#854d0e",
   woodLight: "#b45309",
   woodDark: "#5c2d12",
   iron: "#334155",
   deck: "#d97706",
   deckPlank: "#b45309",
   hull: "#9a3412",
   hullTrim: "#fef08a",
   boatTeal: "#0d9488",
   boatCream: "#fef3c7",
   rope: "#d97706",

   // Towel & Umbrella
   umbrellaRed: "#f43f5e",
   umbrellaCream: "#fff7ed",
   towelStripes: ["#f43f5e", "#fde68a", "#38bdf8", "#fde68a"] as const,

   // Characters & Gear
   hat: "#d4a373",
   hatBand: "#451a03",
   shirt: "#0f766e",
   skin: "#f5c9a0",
   shovelSteel: "#94a3b8",
   shovelSteelDark: "#64748b",

   // Treasure
   gold: "#fbbf24",
   goldShine: "#fef08a",
   chest: "#8b5a2b",
   chestWood: "#78350f",
   chestIron: "#334155",
   gemEmerald: "#34d399",
   gemRuby: "#f43f5e",

   // Fauna
   gull: "#f8fafc",
   gullWing: "#94a3b8",
   gullBeak: "#f59e0b",
   crab: "#ef4444",
   crabDark: "#991b1b",
   hole: "#452e1e",
   holeEdge: "#714a2c",

   // Shipwreck
   wreckWood: "#3b2314",
   wreckTrim: "#27160c",
} as const;

// ---------- ground and water ----------

/** The water's height at full tide (m): the sand slopes down to it at rho 1. */
export const LOW_WATER = -0.3;

/** The drawn sand height at elliptic radius r: flat inside ISLAND.sandFlat, down to LOW_WATER at 1, steeper beyond. */
export function groundHeight(r: number): number {
   if (r <= ISLAND.sandFlat) return 0;
   if (r <= 1) return (LOW_WATER * (r - ISLAND.sandFlat)) / (1 - ISLAND.sandFlat);
   return LOW_WATER - 1.2 * (r - 1);
}

/**
 * The water's height for a shoreline `shore` (rules shoreAt): LOW_WATER at 1, 0 at the final tide.
 * groundHeight(shore) === waterLevel(shore), so the drawn waterline is the rules' shoreline.
 */
export function waterLevel(shore: number): number {
   return (LOW_WATER * (shore - ISLAND.sandFlat)) / (1 - ISLAND.sandFlat);
}

/** Where a thing standing at (x, z) is drawn: on the sand, or on the sea floor under the water. */
export const groundAt = (x: number, z: number, shape: { rx: number; rz: number } = ISLAND) => groundHeight(rho(x, z, shape));

// ---------- the follow camera ----------

/** Camera tilt: a three-quarter top-down view (50°: the design's 55° drew the explorer 15 % shorter on a phone), so the ring on the sand, the route ahead and the explorer all read. */
export const PITCH = (50 * Math.PI) / 180;
/** The camera's fov (definition.camera.fov). */
export const FOV = 45;
/**
 * The follow camera keeps a window of the island around the explorer on screen (decision 1 of the
 * 2026-10-08 review: about 60 % of the island on a desktop, closer on a phone). Its size comes from
 * the canvas: this many CSS px per metre is the aim (an explorer about 40 px tall on a 390 x 844
 * phone), clamped between the phone's minimum and the desktop's 20 x 15 m.
 */
export const WINDOW = { pxPerM: 52, minHalfX: 3.5, maxHalfX: 10, minHalfZ: 3.5, maxHalfZ: 7.5, depthPerWidth: 1.4, height: 1.9 } as const;

/** The window's half extents (m, x across the screen, z up it) for a canvas of width x height CSS px, in 0.25 m steps. */
export function windowHalf(width: number, height: number): { hx: number; hz: number } {
   const step = (v: number) => Math.round(v * 4) / 4;
   const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
   const hx = step(clamp(width / (2 * WINDOW.pxPerM), WINDOW.minHalfX, WINDOW.maxHalfX));
   // a tall screen shows the route ahead, but not so deep that the near edge's perspective shrinks the explorer
   const hz = step(clamp(height / (2 * WINDOW.pxPerM * Math.sin(PITCH)), WINDOW.minHalfZ, Math.min(WINDOW.maxHalfZ, WINDOW.depthPerWidth * hx)));
   return { hx, hz };
}

const VIEWS = new Map<string, FittedViewOptions>();
const ORIGIN = [{ x: 0, y: 0, z: 0 }];
const YAWS = [0];
const MARGIN = { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 };

/**
 * The fit for this canvas (one cached object per window size, so useFittedView refits only when it
 * changes). The camera follows the explorer fully (CameraRig followFraction 1), so the window is
 * relative to the explorer: `area` is centred on the origin and the only focus point is the origin.
 * One yaw: the camera always looks north from the dock's side (the start reads the same everywhere).
 */
export function viewFor(width: number, height: number): FittedViewOptions {
   const { hx, hz } = windowHalf(width, height);
   const key = `${hx}x${hz}`;
   let view = VIEWS.get(key);
   if (!view) {
      const area: AABB = { min: { x: -hx, y: 0, z: -hz }, max: { x: hx, y: WINDOW.height, z: hz } };
      view = { area, pitch: PITCH, yaws: YAWS, focus: ORIGIN, margin: MARGIN, padding: 8, shift: true, fov: FOV };
      VIEWS.set(key, view);
   }
   return view;
}

// ---------- decor crabs ----------

/** Candidate angles (rad, on the ellipse) for the three beach crabs; the first three clear of props are used. */
const CRAB_ANGLES = [3.6, 5.6, 0.9, 2.5, 4.6, 0.2, 1.9, 5.1];
/** How far inside the waterline a crab scuttles (rho). */
export const CRAB_INSET = 0.06;

/** Up to three crab spots (an angle on the ellipse each), clear of every footprint by 1.5 m at full tide. */
export function crabAngles(island: Pick<Island, "circles" | "boxes">, shape: { rx: number; rz: number } = ISLAND): number[] {
   const out: number[] = [];
   for (const a of CRAB_ANGLES) {
      const r = 1 - CRAB_INSET;
      if (clearance(island, shape.rx * r * Math.cos(a), shape.rz * r * Math.sin(a)) >= 1.5) out.push(a);
      if (out.length === 3) break;
   }
   return out;
}

/** The tide's progress 0..1 (looks: the water rises, the surf gets louder). */
export function tideProgress(shore: number): number {
   return (1 - shore) / (1 - TIDE.finalShore);
}

// ---------- surroundings decor outside the play area ----------

export interface OuterRockSpot {
   x: number;
   y: number;
   z: number;
   scale: number;
   rotY: number;
   surfRadius: number;
}

export interface OuterPalmSpot {
   x: number;
   y: number;
   z: number;
   scale: number;
   rotY: number;
}

/** Outer rocks emerging from the turquoise shallows/open sea, each with a surf ring. */
export const OUTER_ROCKS: readonly OuterRockSpot[] = [
   // North reef (behind the island from the camera's view)
   { x: -5, y: -0.1, z: -18, scale: 1.4, rotY: 0.5, surfRadius: 0.95 },
   { x: 6, y: -0.15, z: -19, scale: 1.6, rotY: 1.2, surfRadius: 1.1 },
   { x: 0, y: -0.1, z: -25, scale: 2.1, rotY: 2.1, surfRadius: 1.4 },
   { x: -12, y: -0.12, z: -22, scale: 1.5, rotY: 0.8, surfRadius: 1.0 },
   { x: 13, y: -0.1, z: -22, scale: 1.8, rotY: 1.7, surfRadius: 1.2 },
   // Northwest reef (near shipwreck)
   { x: -21, y: -0.1, z: -22, scale: 2.0, rotY: 0.3, surfRadius: 1.35 },
   { x: -28, y: -0.12, z: -26, scale: 1.9, rotY: 1.1, surfRadius: 1.3 },
   { x: -18, y: -0.15, z: -17, scale: 1.3, rotY: 2.4, surfRadius: 0.9 },
   // Northeast reef
   { x: 21, y: -0.1, z: -21, scale: 2.0, rotY: 0.9, surfRadius: 1.35 },
   { x: 28, y: -0.12, z: -24, scale: 1.7, rotY: 1.5, surfRadius: 1.15 },
   { x: 18, y: -0.15, z: -17, scale: 1.4, rotY: 2.8, surfRadius: 0.95 },
   // Far East sea stacks
   { x: 26, y: -0.1, z: -6, scale: 1.7, rotY: 0.4, surfRadius: 1.15 },
   { x: 27, y: -0.12, z: 2, scale: 1.5, rotY: 1.8, surfRadius: 1.0 },
   // Far West sea stacks
   { x: -26, y: -0.1, z: -5, scale: 1.6, rotY: 1.9, surfRadius: 1.1 },
   { x: -27, y: -0.12, z: 3, scale: 1.4, rotY: 0.6, surfRadius: 0.95 },
];

/** Outer palms standing on distant background islets/sandbars. */
export const OUTER_PALMS: readonly OuterPalmSpot[] = [
   // Far Northwest atoll
   { x: -22, y: 0.05, z: -18, scale: 1.1, rotY: 0.4 },
   { x: -24, y: 0.08, z: -16, scale: 0.9, rotY: 1.7 },
   // Far Northeast atoll
   { x: 22, y: 0.05, z: -18, scale: 1.05, rotY: 2.2 },
   { x: 25, y: 0.08, z: -16, scale: 0.85, rotY: 0.8 },
   // Far East atoll
   { x: 26, y: 0.05, z: -2, scale: 1.0, rotY: 1.1 },
   { x: 27, y: 0.06, z: 4, scale: 0.8, rotY: 2.5 },
   // Far West atoll
   { x: -26, y: 0.05, z: -1, scale: 1.0, rotY: 0.5 },
   { x: -27, y: 0.06, z: 5, scale: 0.85, rotY: 1.9 },
   // Far North islet
   { x: -3, y: 0.05, z: -29, scale: 1.15, rotY: 1.3 },
   { x: 3, y: 0.06, z: -30, scale: 0.95, rotY: 2.7 },
];

/** Distant pirate shipwreck silhouette on the northwest reef against the sunset horizon. */
export const SHIPWRECK = {
   x: -25,
   y: -0.3,
   z: -27,
   scale: 1.2,
   rotY: 0.5,
   roll: -0.25,
   pitch: 0.12,
   radius: 4.5,
} as const;

/** A flock of gulls circling lazily over the ocean / shipwreck reef. */
export const OUTER_BIRDS = {
   count: 5,
   centerX: -18,
   centerZ: -23,
   radiusX: 6.5,
   radiusZ: 4.2,
   y: 7.2,
} as const;

// ---------- play area and occlusion verification helpers ----------

/** The maximum walkable boundary is rho 1.12 (the wading limit) plus the dock extension. */
export const PLAY_LIMITS = {
   maxRho: 1.12,
   dockMinX: -FIXED.dock.hx - 0.2,
   dockMaxX: FIXED.dock.hx + 0.2,
   dockMinZ: FIXED.dock.fromZ - 0.2,
   dockMaxZ: FIXED.dock.toZ + 0.2,
} as const;

/** Returns true if (x, z) is inside or too close to the playable area. */
export function inPlayArea(x: number, z: number, margin = 0.5): boolean {
   const r = rho(x, z);
   if (r <= PLAY_LIMITS.maxRho + margin / Math.min(ISLAND.rx, ISLAND.rz)) return true;
   if (
      x >= PLAY_LIMITS.dockMinX - margin &&
      x <= PLAY_LIMITS.dockMaxX + margin &&
      z >= PLAY_LIMITS.dockMinZ - margin &&
      z <= PLAY_LIMITS.dockMaxZ + margin
   ) {
      return true;
   }
   return false;
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

/**
 * 2D distance between a point (px, pz) and a line segment (x1, z1) -> (x2, z2).
 */
export function distanceToSegmentXZ(px: number, pz: number, x1: number, z1: number, x2: number, z2: number): number {
   const dx = x2 - x1;
   const dz = z2 - z1;
   const lenSq = dx * dx + dz * dz;
   if (lenSq < 1e-8) return Math.hypot(px - x1, pz - z1);
   const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lenSq));
   return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}
