// Treasure Island looks that are worth a test: the ground and water heights (so the drawn shoreline
// is the rules' shore(t)), the follow camera's window per screen, and where the decor crabs sit.
// Pure: no three.js, no React. The rules stay flat (y = 0); only the drawing uses these heights.
import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { ISLAND, TIDE, clearance, rho, type Island } from "./rules";

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
export const groundAt = (x: number, z: number) => groundHeight(rho(x, z));

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
export function crabAngles(island: Pick<Island, "circles" | "boxes">): number[] {
   const out: number[] = [];
   for (const a of CRAB_ANGLES) {
      const r = 1 - CRAB_INSET;
      if (clearance(island, ISLAND.rx * r * Math.cos(a), ISLAND.rz * r * Math.sin(a)) >= 1.5) out.push(a);
      if (out.length === 3) break;
   }
   return out;
}

/** The tide's progress 0..1 (looks: the water rises, the surf gets louder). */
export function tideProgress(shore: number): number {
   return (1 - shore) / (1 - TIDE.finalShore);
}
