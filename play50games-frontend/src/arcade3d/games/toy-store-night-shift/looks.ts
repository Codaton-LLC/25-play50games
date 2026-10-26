// One palette, the follow camera, and the cosmetic spots. Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { createRng } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type Category, type ToyLevel } from "./levels";
import { SHELF_H, storeHalf, type Run } from "./rules";

export const COLORS = {
   floor: "#e2e8f0",
   floorTile: "#cbd5e1",
   floorEdge: "#94a3b8",
   outside: "#cbd5e1",
   wall: "#fbcfe8",
   wallTrim: "#f472b6",
   wallBlue: "#60a5fa",
   shelf: "#facc15",
   shelfTrimPink: "#f472b6",
   shelfTrimBlue: "#60a5fa",
   signBase: "#1e293b",
   torch: "#fde68a",
   emergency: "#4ade80",
   plate: "#ffffff",
   fallbackShelf: "#facc15",
   fallbackShelfTop: "#f472b6",
   fallbackToy: "#f59e0b",
   windup: "#f472b6",
   windupDark: "#9d174d",
   windupKey: "#fde68a",
   bin: "#60a5fa",
   binPlush: "#ef4444",
   crate: "#b45309",
   guard: "#1e3a8a",
   guardTrim: "#fbbf24",
   skin: "#f1d0b4",
} as const;

export const PITCH = (58 * Math.PI) / 180;
export const YAWS = [0, Math.PI / 2] as const;
export const FOV = 48;
export const FOLLOW = 1;
export const LOOK_AHEAD = 0.6;
export const DAMPING = 4;
/** What must stay on screen around the guard (m): a bigger store scrolls under the camera. Small enough that a portrait phone (the other yaw: d across its width) sees the guard clearly. */
export const WINDOW = { w: 12, d: 7 } as const;
export const WALL_H = 2.6;
/** The +x side (the portrait camera's side) is a low counter. */
export const SIDE_H = 0.7;
/** The back wall stands this far behind the walkable floor: a display strip for the bins and crates. */
export const BACK = 1.4;
/** The guard's torch: half the cone, range. */
export const TORCH = { halfAngle: 0.62, range: 6 } as const;

/** Fog starts past the farthest fitted camera (a 390 x 844 phone: about 30 m + the window), so it only hides the far floor. */
export const FOG = { near: 60, far: 150 } as const;

export function fog(level: ToyLevel): [string, number, number] {
   return [level.background, FOG.near, FOG.far];
}

export function lookAtFor(): [number, number, number] {
   return [0, 0.6, 0];
}

export function windowBox(level: ToyLevel): AABB {
   const { hx, hz } = storeHalf(level);
   const w = Math.min(hx * 2, WINDOW.w) / 2;
   const d = Math.min(hz * 2, WINDOW.d) / 2;
   return { min: { x: -w, y: 0, z: -d }, max: { x: w, y: 2.4, z: d } };
}

/** Where the camera aim may go: the store shrunk by half the window, so the walls never leave the frame. */
export function aimBounds(level: ToyLevel): AABB {
   const { hx, hz } = storeHalf(level);
   const w = Math.min(hx * 2, WINDOW.w) / 2;
   const d = Math.min(hz * 2, WINDOW.d) / 2;
   return { min: { x: -(hx - w), y: 0, z: -(hz - d) }, max: { x: hx - w, y: 2.4, z: hz - d } };
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

/** The window round the guard in frame. Portrait picks the other yaw. */
export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      view = {
         area: windowBox(LEVELS[id]),
         pitch: PITCH,
         yaws: YAWS,
         focus: [{ x: 0, y: 0.6, z: 0 }],
         margin: { top: 0.03, right: 0.02, bottom: 0.05, left: 0.02 },
         padding: 8,
         shift: true,
         fov: 48,
      };
      VIEWS.set(id, view);
   }
   return view;
}

/** Floor tiles: every other 2 m slab a shade darker. Unit boxes scaled by the spot. */
export function tileSpots(level: ToyLevel): InstanceSpot[] {
   const { hx, hz } = storeHalf(level);
   const spots: InstanceSpot[] = [];
   const step = 2;
   for (let x = -hx + step / 2; x < hx; x += step) {
      for (let z = -hz + step / 2; z < hz; z += step) {
         if (((Math.round((x + hx) / step) + Math.round((z + hz) / step)) & 1) === 0) continue;
         spots.push({ x, y: 0.004, z, sx: step, sy: 0.008, sz: step });
      }
   }
   return spots;
}

/** The back and side walls and their trim bands: unit boxes scaled by the spot. */
export function wallSpots(level: ToyLevel): { walls: InstanceSpot[]; trims: InstanceSpot[] } {
   const { hx, hz } = storeHalf(level);
   const t = 0.3;
   const h = WALL_H;
   const walls: InstanceSpot[] = [
      { x: 0, y: h / 2, z: -hz - BACK - t / 2, sx: hx * 2 + t * 2, sy: h, sz: t },
      { x: -hx - t / 2, y: h / 2, z: -BACK / 2, sx: t, sy: h, sz: hz * 2 + BACK },
      // the portrait camera (yaw pi/2) looks in from +x: that side is a low counter, never a wall in front of the guard
      { x: hx + t / 2, y: SIDE_H / 2, z: -BACK / 2, sx: t, sy: SIDE_H, sz: hz * 2 + BACK },
   ];
   const trims: InstanceSpot[] = [
      { x: 0, y: 0.3, z: -hz - BACK + 0.02, sx: hx * 2, sy: 0.12, sz: 0.06 },
      { x: -hx + 0.02, y: 0.3, z: -BACK / 2, sx: 0.06, sy: 0.12, sz: hz * 2 + BACK },
      { x: hx - 0.02, y: 0.3, z: -BACK / 2, sx: 0.06, sy: 0.12, sz: hz * 2 + BACK },
      { x: 0, y: h - 0.15, z: -hz - BACK + 0.02, sx: hx * 2, sy: 0.14, sz: 0.06 },
      { x: -hx + 0.02, y: h - 0.15, z: -BACK / 2, sx: 0.06, sy: 0.14, sz: hz * 2 + BACK },
      { x: hx - 0.02, y: SIDE_H - 0.1, z: -BACK / 2, sx: 0.06, sy: 0.1, sz: hz * 2 + BACK },
   ];
   return { walls, trims };
}

/** Slot x offsets on a shelf's top: either side of the sign. */
export const SLOT_X = [-0.95, 0.95, -1.55, 1.55] as const;
/** A toy of this size class sits on the shelf top at y = SHELF_H. */
export function slotSpot(shelf: { x: number; z: number }, slot: number): { x: number; y: number; z: number } {
   return { x: shelf.x + SLOT_X[slot % SLOT_X.length], y: SHELF_H, z: shelf.z + (slot >= SLOT_X.length ? 0.12 : -0.05) };
}

/** The sign plates lie flat on each shelf's top, so they read from every camera yaw. */
export function signSpots(run: Run): Record<Category, InstanceSpot[]> {
   const out = {} as Record<Category, InstanceSpot[]>;
   for (const s of run.shelves) (out[s.cat] ??= []).push({ x: s.x, y: SHELF_H + 0.045, z: s.z, sx: 0.72, sz: 0.72, sy: 1 });
   return out;
}

/** The dark boards under the sign plates. */
export function signBaseSpots(run: Run): InstanceSpot[] {
   return run.shelves.map((s) => ({ x: s.x, y: SHELF_H + 0.015, z: s.z, sx: 0.8, sy: 0.03, sz: 0.8 }));
}

/** Decor against the back wall and in the corners: bins and crates, never in the walkable middle. */
export interface Decor {
   kind: "bin" | "binPlush" | "crate";
   x: number;
   z: number;
   rotY: number;
   y: number;
}

export function decorOf(run: Run): Decor[] {
   const rng = createRng((run.seed ^ 0x7075) >>> 0);
   const { hx, hz } = run;
   const out: Decor[] = [];
   const n = 3 + Math.floor(rng() * 2);
   for (let i = 0; i < n; i++) {
      const x = -hx + 1.2 + (hx * 2 - 2.4) * ((i + 0.3 + rng() * 0.4) / n);
      const kind = run.level.lighting === "night" && i % 2 === 0 ? "crate" : i % 2 === 0 ? "bin" : "binPlush";
      out.push({ kind, x, z: -hz - 0.7, rotY: (rng() - 0.5) * 0.4, y: kind === "crate" ? 0 : 0 });
   }
   return out;
}
