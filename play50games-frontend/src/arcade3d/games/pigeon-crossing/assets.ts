import type { ModelAsset } from "@/arcade3d/core/types";

const PROP_BUDGET = { tris: 5000, bytes: 300000 };

/** streetLampNight.glb raw bounds, measured on the mesh (assets.test.ts): post with a cross-arm, feet on y = 0. */
export const LAMP_GLB = { width: 0.7062, height: 1.8988, depth: 1.1816 } as const;
/** Drawn 3.6 m tall so the lamp tops the 1.8 m side cover (live traffic is ~1.3 m tall). */
export const LAMP_HEIGHT = 3.6;
export const LAMP_SCALE = LAMP_HEIGHT / LAMP_GLB.height;

/** rushTaxi.glb raw bounds, measured on the mesh: long along z, like the vehicle fleet's GLBs. */
export const RUSH_TAXI_GLB = { width: 0.7922, height: 0.835, depth: 1.904 } as const;
/** Parked at the live taxi fleet's drawn length (2.95 m) so it reads as one of them. */
export const RUSH_TAXI_LENGTH = 2.95;
export const RUSH_TAXI_SCALE = RUSH_TAXI_LENGTH / RUSH_TAXI_GLB.depth;
/** The GLB's +z end is only weakly lower than its tail (0.97, measured), so the copies park
 *  parallel to the street and the spots turn the whole copy; the asset's rotationY stays 0. */

export const ASSETS = {
   // Claude's folded-wing GLB: 0.99 x 1.90 x 1.74 m, feet on y=0, facing +z.
   // The manifest owns availability; an unlisted URL goes straight to our primitive.
   pigeon: {
      id: "pigeon", url: "/models/3d/pigeon-crossing/pigeon.glb",
      scale: 0.658, stretch: [0.86, 1, 1], rotationY: Math.PI, rigged: false,
      fallback: "sphere", fallbackColor: "#8192a9", budget: { tris: 20000, bytes: 1500000 },
   },
   // Group C vehicles (2026-10-07), long along the GLB's z like the stand-ins' local frame (front at
   // +z, which the pool's facing quaternion turns to the travel direction). Each one is fitted to
   // its stand-in (Primitives.tsx: length x width x height incl. wheels), so it stays inside its
   // rules hit box and under the 1.5 m cover roof (assets.test.ts). Measured GLBs (w x h x l):
   // car 0.91 x 0.81 x 1.90, front at -z (turned round) -> 1.11 x 1.14 x 2.66 (hit box 2.80 x 1.15)
   // taxi 0.93 x 1.12 x 1.89, front at +z -> 1.16 x 1.29 x 2.95 (hit box 3.10 x 1.20)
   // van 1.17 x 1.04 x 1.89, front at +z -> 1.26 x 1.29 x 3.66 (hit box 3.80 x 1.30): a long van
   car: {
      id: "car", url: "/models/3d/pigeon-crossing/car.glb", scale: 1.4, stretch: [0.87, 1, 1], rotationY: Math.PI,
      fallback: "box", fallbackColor: "#f47967", budget: PROP_BUDGET,
   },
   taxi: {
      id: "taxi", url: "/models/3d/pigeon-crossing/taxi.glb", scale: 1.56, stretch: [0.795, 0.742, 1],
      fallback: "box", fallbackColor: "#ffd15b", budget: PROP_BUDGET,
   },
   van: {
      id: "van", url: "/models/3d/pigeon-crossing/van.glb", scale: 1.93, stretch: [0.56, 0.64, 1],
      fallback: "box", fallbackColor: "#e9edf3", budget: PROP_BUDGET,
   },
   // Night/rush-hour street decor, levels 4-5 only (meta.ts: Night Traffic, Rush Hour). Fitted from
   // the measured bounds below (assets.test.ts re-measures them on the real meshes). Decor.tsx
   // places the copies at |x| = decorX(horizon.coverX), beyond the side cover's outer edge, so they
   // never enter the play bounds (±PLAY_HALF_WIDTH) or overlap traffic's spawn extent.
   streetLampNight: {
      id: "streetLampNight", url: "/models/3d/pigeon-crossing/streetLampNight.glb", scale: LAMP_SCALE,
      fallback: "cylinder", fallbackColor: "#2f3b52", budget: PROP_BUDGET,
   },
   rushTaxi: {
      id: "rushTaxi", url: "/models/3d/pigeon-crossing/rushTaxi.glb", scale: RUSH_TAXI_SCALE,
      fallback: "box", fallbackColor: "#ffd15b", budget: PROP_BUDGET,
   },
} satisfies Record<string, ModelAsset>;

// ---- Night/rush-hour street decor placement (levels 4-5 only) --------------------------------------

/** Run stages that get the street decor: levels 4 and 5 (levels.ts / meta.ts titles). */
export const DECOR_LEVELS = [4, 5] as const;
export function isDecorLevel(level: number): boolean {
   return level === DECOR_LEVELS[0] || level === DECOR_LEVELS[1];
}

/**
 * Copies stand this far beyond the side cover's outer edge. The filled cover never sits inside
 * ±(COVER_INNER_X + 2.3) and traffic's farthest spawn extent is COVER_INNER_X + 3.8, so with this
 * margin a copy's inner edge stays clear of both at every cover width.
 */
export const DECOR_COVER_MARGIN = 2.5;
/** |x| of a decor copy when the side cover's outer edge is at `coverX` (the cover only grows). */
export function decorX(coverX: number): number {
   return coverX + DECOR_COVER_MARGIN;
}

/**
 * A copy recycles to the far end of its line once this many rows behind the pigeon; the camera's
 * rear ground envelope reaches at most ~+11 m (≈6 rows) behind, so the jump is never on screen.
 */
export const DECOR_RECYCLE_ROWS = 8;

export interface StreetDecorSpot {
   /** Absolute street row (world-anchored); decorRow mutates it when the copy recycles. */
   row: number;
   side: -1 | 1;
   /** Whole-copy turn around +y, written by the pool's update. */
   rotY: number;
}

/** Street-lamp line: 4 copies, rows ≡ 2 (mod 9), alternating sides. */
export const LAMP_SPACING = 9;
export const LAMP_COUNT = 4;
export function createLampSpots(): StreetDecorSpot[] {
   return [
      { row: 2, side: -1, rotY: 0 },
      { row: 11, side: 1, rotY: Math.PI },
      { row: 20, side: -1, rotY: 0 },
      { row: 29, side: 1, rotY: Math.PI },
   ];
}

/** Parked rush-taxi line: 3 copies, rows ≡ 6 (mod 12), alternating sides. */
export const RUSH_TAXI_SPACING = 12;
export const RUSH_TAXI_COUNT = 3;
export function createTaxiSpots(): StreetDecorSpot[] {
   return [
      { row: 6, side: -1, rotY: 0 },
      { row: 18, side: 1, rotY: Math.PI },
      { row: 30, side: -1, rotY: 0 },
   ];
}

/**
 * World-anchored row of one copy: once DECOR_RECYCLE_ROWS behind the pigeon, jump one full line
 * forward (spacing x count rows). The old spot is off the rear envelope and the new one off the
 * front, so the recycle never shows. Mutates `spot.row`.
 */
export function decorRow(spot: StreetDecorSpot, playerRow: number, spacing: number, count: number): number {
   if (spot.row < playerRow - DECOR_RECYCLE_ROWS) spot.row += spacing * count;
   return spot.row;
}
