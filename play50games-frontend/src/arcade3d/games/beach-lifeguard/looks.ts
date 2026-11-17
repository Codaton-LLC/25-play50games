// Palette, the follow view and the decor spots for Beach Lifeguard. Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import { createRng } from "@/arcade3d/core/math";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type BeachLevel } from "./levels";
import { SAND_DEPTH } from "./rules";

export const COLORS = {
   sand: "#f2d7a6",
   sandFar: "#e9cc95",
   wetSand: "#e7c98a",
   waterShallow: "#38bdf8",
   waterDeep: "#0369a1",
   waterFoam: "#f0fdf4",
   accent: "#fb7185",
   torusPink: "#fb7185",
   torusWhite: "#f8fafc",
   towerRed: "#e11d48",
   towerWhite: "#ffffff",
   towerWood: "#a16207",
   floatRed: "#ef4444",
   floatStrap: "#ffffff",
   jetSkiBlue: "#0284c7",
   jetSkiWhite: "#f8fafc",
   jetSkiSeat: "#1e293b",
   chairBlue: "#0ea5e9",
   chairWhite: "#f8fafc",
   coolerBlue: "#0284c7",
   coolerWhite: "#ffffff",
   hutWood: "#78350f",
   hutRoof: "#fef08a",
   sandcastle: "#eab308",
   guardShorts: "#dc2626",
   guardShirt: "#facc15",
   skin: "#fed7aa",
   hair: "#451a03",
   swimmerSuit: "#3b82f6",
   safeLine: "#ffffff",
   towLine: "#fde047",
   savedText: "#fff1f2",
   seabedShallow: "#f3dca8",
   seabedDeep: "#0b4a6e",
} as const;

export const PITCH = (50 * Math.PI) / 180;
export const FOV = 48;
export const LOOK_AHEAD = 1.6;
export const DAMPING = 4;

/** The walkable beach: sand and the swim zone. */
export function beachBox(level: BeachLevel): AABB {
   return { min: { x: -level.width / 2, y: 0, z: -level.water }, max: { x: level.width / 2, y: 2, z: SAND_DEPTH } };
}

/**
 * Half size of the window the follow camera keeps on screen around its aim. A portrait screen gets a
 * narrow window (its width is what pushes the camera back), so the lifeguard and the ring stay big.
 */
export function viewWindow(level: BeachLevel, portrait = false): { x: number; z: number } {
   return portrait ? { x: Math.min(level.width / 2, 4.5), z: 6 } : { x: Math.min(level.width / 2, 9), z: 7.5 };
}

/** The swimmer's beacon (arrow, label) stands over it: keep the swimmer this share of the window inside its far edge. */
export const SWIMMER_INSET = { x: 0.7, zNorth: 0.6 } as const;
/** The lifeguard may sit this share of the window from the aim (so a pan to the swimmer never loses him). */
export const HERO_REACH = 0.85;

/**
 * Pans the aim just far enough that the swimmer in trouble, and its GRAB beacon, sit inside the window
 * (clear of the shell chips and the screen edge) while the lifeguard stays in it too; the lifeguard wins
 * when both cannot fit. Writes into `aim` (x, z) and returns it. Pure; the caller clamps to `aimBounds`.
 */
export function frameAim(
   aim: { x: number; z: number },
   hero: { x: number; z: number },
   swimmer: { x: number; z: number } | null,
   window: { x: number; z: number },
): { x: number; z: number } {
   if (!swimmer) return aim;
   const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
   const sx = window.x * SWIMMER_INSET.x;
   aim.x = clamp(clamp(aim.x, swimmer.x - sx, swimmer.x + sx), hero.x - window.x * HERO_REACH, hero.x + window.x * HERO_REACH);
   // north (-z) is up the screen, where the beacon stands: only ever pan north, never back toward the sand
   const north = swimmer.z + window.z * SWIMMER_INSET.zNorth;
   if (aim.z > north) aim.z = Math.max(north, hero.z - window.z * HERO_REACH);
   return aim;
}

/** Where the camera may aim: the beach shrunk so the window stays over it, with a little sea and sand to spare. */
export function aimBounds(level: BeachLevel, portrait = false): AABB {
   const w = viewWindow(level, portrait);
   const box = beachBox(level);
   const hx = Math.max(0, level.width / 2 - w.x + 2);
   const zMin = Math.min(box.min.z + w.z - 2, 0);
   const zMax = Math.max(box.max.z - w.z + 1, zMin);
   return { min: { x: -hx, y: 0, z: zMin }, max: { x: hx, y: 2, z: zMax } };
}

/** Height (m) of the fitted box: the swimmer beacon's arrow tip and label reach about 2.7 m over the water. */
export const BEACON_HEADROOM = 3.4;

const VIEWS = new Map<string, FittedViewOptions>();

/** A window round the aim (the camera follows the lifeguard with it), clear of the HUD and the controls. */
export function viewFor(id: LevelId, portrait = false): FittedViewOptions {
   const key = String(id) + (portrait ? "p" : "l");
   let view = VIEWS.get(key);
   if (!view) {
      const w = viewWindow(LEVELS[id], portrait);
      view = {
         // the box is tall enough (BEACON_HEADROOM) for the GRAB beacon's arrow and label over a swimmer at the
         // window's far edge, and the top margin keeps that label clear of the shell chip rows (390 x 844 checked)
         area: { min: { x: -w.x, y: 0, z: -w.z }, max: { x: w.x, y: BEACON_HEADROOM, z: w.z } },
         pitch: PITCH,
         yaws: [0],
         fov: FOV,
         margin: { top: 0.07, right: 0.02, bottom: 0.04, left: 0.02 },
         padding: 6,
         shift: true,
      };
      VIEWS.set(key, view);
   }
   return view;
}

/** The desk fog's start (index.tsx environment: 22 m to the level's fogFar). */
export const FOG_NEAR = 22;

/**
 * Fog measured from the fitted camera: it starts past the aim (camera distance + half the window), so the
 * lifeguard and the near half of the window are never fogged on any screen, and keeps the level's own depth
 * (fogFar - 22: L5's storm is still the nearest). Never nearer than the desk values.
 */
export function fogFor(level: BeachLevel, distance: number, portrait = false): { near: number; far: number } {
   const near = Math.max(FOG_NEAR, distance + viewWindow(level, portrait).z * 0.5);
   return { near, far: near + (level.fogFar - FOG_NEAR) };
}

// ---------- per-level look: sky, water and weather (lighting preset is levels.ts) ----------
// Each level reads as its name: L1 the small day beach, L2 a brighter busy midday, L3 a golden-hour
// resort with turquoise water, L4 a dusk waterpark, L5 a dark night storm with rain and a heavy sea.

export interface BeachTheme {
   /** SkyDome top (the horizon is the level's background / fog colour) */
   skyTop: string;
   waterShallow: string;
   waterDeep: string;
   waterFoam: string;
   /** the Water component's wave amplitude: the storm sea is the roughest */
   waveAmp: number;
   /** L5 only: the rain sheet */
   rain: boolean;
}

export const THEMES: Record<LevelId, BeachTheme> = {
   1: { skyTop: "#0ea5e9", waterShallow: COLORS.waterShallow, waterDeep: COLORS.waterDeep, waterFoam: COLORS.waterFoam, waveAmp: 0.14, rain: false },
   2: { skyTop: "#0369a1", waterShallow: "#0ea5e9", waterDeep: "#075985", waterFoam: COLORS.waterFoam, waveAmp: 0.15, rain: false },
   3: { skyTop: "#c2410c", waterShallow: "#5eead4", waterDeep: "#0f766e", waterFoam: "#ecfeff", waveAmp: 0.12, rain: false },
   4: { skyTop: "#7c2d12", waterShallow: "#38bdf8", waterDeep: "#155e75", waterFoam: "#fff7ed", waveAmp: 0.18, rain: false },
   5: { skyTop: "#292524", waterShallow: "#64748b", waterDeep: "#0f172a", waterFoam: "#cbd5e1", waveAmp: 0.3, rain: true },
};

export function themeFor(id: LevelId): BeachTheme {
   return THEMES[id];
}

// ---------- decor: never between the camera and the beach ----------
// The camera looks north (-z) from the south (+z): south of the sand only low things stand; the palms and
// huts line both ends of the beach, outside the play rectangle.

/** Camera-side decor (z > the sand) stays below this height. */
export const SOUTH_DECOR_MAX_H = 0.7;
/** Tall decor stands at least this far past either end of the beach. */
export const END_GAP = 2;

export interface DecorSpots {
   palms: InstanceSpot[];
   huts: InstanceSpot[];
   /** low beach clutter on the camera side (sandcastles and coolers, fitted to 1 m tall in assets.ts) */
   castles: InstanceSpot[];
   coolers: InstanceSpot[];
   /** L2 Busy Beach: low boardwalk planks along the back of the sand */
   boardwalk: InstanceSpot[];
   /** L3 Resort: hotel blocks past both beach ends, deck chairs and a low pool on the terrace */
   hotels: InstanceSpot[];
   deckChairs: InstanceSpot[];
   pool: { x: number; z: number; w: number; d: number } | null;
   /** L4 Waterpark: tall slide flumes past both beach ends; ring floats on the back sand */
   slides: InstanceSpot[];
   rings: InstanceSpot[];
}

/**
 * Seeded per level. Every decor GLB is fitted to 1 m tall (assets.ts): the spot's scale is the height.
 * Level 1 keeps today's layout; each later level adds its own set pieces, all outside the play rectangle:
 * tall things only past the beach ends, low things only on the camera side (z > the sand).
 */
export function decorSpots(id: LevelId): DecorSpots {
   const level = LEVELS[id];
   const rng = createRng(3400 + id);
   const halfW = level.width / 2;
   const out: DecorSpots = { palms: [], huts: [], castles: [], coolers: [], boardwalk: [], hotels: [], deckChairs: [], pool: null, slides: [], rings: [] };
   for (const side of [-1, 1]) {
      // a hut at each end of the sand, palms along both ends from the waterline to the back of the beach
      out.huts.push({ x: side * (halfW + END_GAP + 1.4), y: 0, z: 9 + rng() * 3, rotY: side > 0 ? -Math.PI / 2 : Math.PI / 2, scale: 2.4 });
      for (let z = 0.5; z < SAND_DEPTH + 6; z += 3 + rng() * 1.5) {
         out.palms.push({ x: side * (halfW + END_GAP + 0.5 + rng() * 3.5), y: 0, z, rotY: rng() * Math.PI * 2, scale: 3 + rng() * 1.4 });
      }
   }
   // low clutter on the camera side of the sand (the storm beach is wind-swept: about half of it)
   for (let x = -halfW - 6; x <= halfW + 6; x += 3 + rng() * 3) {
      const z = SAND_DEPTH + 1 + rng() * 5;
      if (id === 5 && rng() < 0.5) continue;
      if (rng() < 0.5) out.castles.push({ x, y: 0, z, rotY: rng() * Math.PI * 2, scale: 0.35 + rng() * 0.25 });
      else out.coolers.push({ x, y: 0, z, rotY: rng() * Math.PI * 2, scale: 0.35 + rng() * 0.15 });
   }

   if (id === 2) {
      // Busy Beach: a low wooden boardwalk runs along the back of the sand behind the clutter
      for (let x = -halfW - 4; x <= halfW + 4; x += 2.4) {
         out.boardwalk.push({ x, y: 0.05, z: SAND_DEPTH + 3.4 + (rng() - 0.5) * 0.2, rotY: (rng() - 0.5) * 0.05, scale: 1 });
      }
   } else if (id === 3) {
      // Resort: hotel blocks past both ends, neat deck-chair rows and a low pool on the terrace
      for (const side of [-1, 1]) {
         out.hotels.push({ x: side * (halfW + END_GAP + 7), y: 0, z: 5.5 + rng() * 1.5, rotY: side > 0 ? -Math.PI / 2 : Math.PI / 2, scale: 1 });
      }
      for (let row = 0; row < 2; row++) {
         for (let x = -halfW + 2 + rng(); x <= halfW - 2; x += 4.5 + rng() * 2) {
            out.deckChairs.push({ x, y: 0, z: SAND_DEPTH + 1.6 + row * 2.4 + rng() * 0.4, rotY: Math.PI + (rng() - 0.5) * 0.5, scale: 0.55 });
         }
      }
      out.pool = { x: 0, z: SAND_DEPTH + 6.4, w: Math.min(16, halfW * 1.4), d: 3.4 };
   } else if (id === 4) {
      // Waterpark: a tall slide flume past each beach end, ring floats scattered on the back sand
      for (const side of [-1, 1]) {
         out.slides.push({ x: side * (halfW + END_GAP + 5.5), y: 0, z: 4.5 + rng() * 1.5, rotY: side > 0 ? Math.PI / 2 : -Math.PI / 2, scale: 1.35 });
      }
      for (let i = 0; i < 6; i++) {
         out.rings.push({ x: -halfW - 3 + rng() * (halfW * 2 + 6), y: 0.14, z: SAND_DEPTH + 1.5 + rng() * 4, rotY: rng() * Math.PI, scale: 0.85 });
      }
   }
   return out;
}

// ---------- the water's depth and the swim (visual only: the rules keep their flat z split) ----------

/** The water surface's height (the Water plane), m. */
export const WATER_Y = -0.06;
/** The sea floor drops this much per metre out from the shoreline (z = 0), down to SEABED_MAX. */
export const SEABED_SLOPE = 0.42;
export const SEABED_MAX = 3.2;
/** The lifeguard wades out to here, then swims from SWIM_FULL_Z on (z < 0 is the sea). */
export const SWIM_START_Z = -1.3;
export const SWIM_FULL_Z = -2.3;

/** The sea floor's height at z (0 on the sand). */
export function seabedY(z: number): number {
   return z >= 0 ? 0 : Math.max(-SEABED_MAX, z * SEABED_SLOPE);
}

/** 0 = on foot (sand, wading), 1 = swimming, smooth in between. */
export function swimBlend(z: number): number {
   const t = Math.min(1, Math.max(0, (SWIM_START_Z - z) / (SWIM_START_Z - SWIM_FULL_Z)));
   return t * t * (3 - 2 * t);
}
