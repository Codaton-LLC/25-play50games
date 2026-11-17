// One palette, the follow camera, and the wall and floor decor. Pure: no React, no three.js.
// Decor is built at unit size and scaled per spot (InstanceSpot), so one geometry serves every piece.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type CatLevel } from "./levels";
import { HALL_HALF, ROOM_LEN } from "./rules";

/**
 * One palette built for reading at a glance: the floors and walls are cool, light and quiet; the
 * gameplay objects each own a hue nothing else uses. The cat is the only warm orange, the vacuums
 * dark graphite with danger red, the treats gold, the toys pink, the bed (the goal) green.
 */
export const COLORS = {
   wall: "#e8edf2",
   wallCap: "#ffffff",
   floor: "#e2e8f0",
   outerFloor: "#64748b",
   // whitewashed oak and a cool grey wood: planks you can see, never louder than the play
   woodLight: "#d9dde2",
   woodLightAlt: "#d1d6dc",
   woodSeam: "#aab2bc",
   woodWarm: "#c3cad3",
   woodWarmAlt: "#bcc4ce",
   woodWarmSeam: "#9099a6",
   parquet: "#5b6573",
   parquetAlt: "#556070",
   parquetSeam: "#3b4350",
   outerTint: "#cbd5e1",
   tileA: "#f1f5f9",
   tileB: "#e2e8f0",
   grout: "#b6c1cd",
   // the lane rug: a muted blue, low contrast, so the dark vacuums and gold treats on it stand out
   rugField: "#c9d5e2",
   baseboard: "#64748b",
   outerWall: "#eef2f6",
   glow: "#ff3b3b",
   bay: "#d6cfc4",
   rug: "#aebfd1",
   rugEdge: "#8ea2b8",
   cat: "#fb923c",
   catDark: "#c2410c",
   catInner: "#fecdd3",
   catRing: "#ffffff",
   vacuum: "#30353f",
   vacuumDark: "#1e2229",
   vacuumGlow: "#ff3b3b",
   danger: "#ef4444",
   treat: "#f59e0b",
   treatCore: "#fde047",
   treatHalo: "#facc15",
   toy: "#f472b6",
   toyCore: "#f9a8d4",
   toyHalo: "#f472b6",
   sofa: "#78716c",
   sofaCushion: "#a8a29e",
   bed: "#d6d3d1",
   bedFrame: "#57534e",
   table: "#92400e",
   tableTop: "#b45309",
   shelf: "#57534e",
   shelfBoard: "#78716c",
   clutter: "#a16207",
   clutterBand: "#ca8a04",
   pad: "#22c55e",
   padReady: "#4ade80",
   rim: "#dbeafe",
} as const;

export const PITCH = (55 * Math.PI) / 180;
export const FOV = 46;
/** fog starts past the follow camera's view of the hall, so the house fades out only at its far edge */
export const FOG_NEAR = 22;
export const FOG_FAR = 60;
/** a look-ahead along the cat's facing */
export const LOOK_AHEAD = 1.2;
export const DAMPING = 4;
/** The camera keeps this window (half sizes, m) around its aim: the hall's width and its walls, 7 m of it (the cat a clear size on a phone). */
export const VIEW_WINDOW = { x: 2.65, z: 3.5 } as const;
/** the player's zoom (wheel, pinch, + / -): a factor on the fitted camera distance */
export const ZOOM = { min: 0.6, max: 1.6, portrait: 0.8 } as const;

export function hallBox(level: CatLevel): AABB {
   const zEnd = level.rooms * ROOM_LEN;
   return {
      min: { x: -HALL_HALF - 0.4, y: 0, z: -0.4 },
      max: { x: HALL_HALF + 0.4, y: 2.5, z: zEnd + 0.4 },
   };
}

export function lookAtFor(level: CatLevel): [number, number, number] {
   return [0, 0.4, (level.rooms * ROOM_LEN) / 2];
}

/** Where the camera may aim: along the hall's centre line, from near one end wall to near the other. */
export function aimBounds(level: CatLevel): AABB {
   const zEnd = level.rooms * ROOM_LEN;
   // the aim may come as close as 1.2 m to either end wall, so the cat at the start (z 0.8) sits near the
   // middle of the picture, not at its far edge
   const lo = Math.min(1.2, zEnd / 2);
   const hi = Math.max(zEnd - 1.2, zEnd / 2);
   return { min: { x: 0, y: 0, z: lo }, max: { x: 0, y: 1, z: hi } };
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

/**
 * A follow camera from the south (yaw 0 only: a turned camera would look across the hall, where the
 * wall-side furniture can hide the cat). The window around the aim stays clear of the HUD and the controls.
 */
export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      view = {
         area: { min: { x: -VIEW_WINDOW.x, y: 0, z: -VIEW_WINDOW.z }, max: { x: VIEW_WINDOW.x, y: 1.2, z: VIEW_WINDOW.z } },
         pitch: PITCH,
         yaws: [0],
         margin: { top: 0.03, right: 0.02, bottom: 0.05, left: 0.02 },
         padding: 8,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(id, view);
   }
   return view;
}

// ---------- decor: outside the walls, never between the camera (south, +z) and the hall ----------

/** Decor south of the hall (the camera side) stays under this height. */
export const SOUTH_DECOR_MAX_H = 0.6;

export interface DecorSpots {
   catTrees: InstanceSpot[];
   chairs: InstanceSpot[];
}

/** Seeded per level (the same house every run). Decor GLBs are fitted to 1 m: a spot's scale is its height. */
export function decorSpots(id: LevelId): DecorSpots {
   const level = LEVELS[id];
   const zEnd = level.rooms * ROOM_LEN;
   const out: DecorSpots = { catTrees: [], chairs: [] };
   for (let i = 0; i < level.rooms; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = i * ROOM_LEN + 1.6;
      out.catTrees.push({ x: side * (HALL_HALF + 0.9), y: 0, z, rotY: side > 0 ? -Math.PI / 2 : Math.PI / 2, scale: 1.5 });
      out.chairs.push({ x: -side * (HALL_HALF + 0.75), y: 0, z: z + 2.4, rotY: side > 0 ? -Math.PI / 2 : Math.PI / 2, scale: 0.9 });
   }
   // beyond the far end wall (north, away from the camera) two more cat trees
   out.catTrees.push({ x: -1.4, y: 0, z: -0.9, rotY: 0, scale: 1.7 }, { x: 1.5, y: 0, z: -1.0, rotY: 0.4, scale: 1.4 });
   void zEnd;
   return out;
}

/** Low perimeter walls, just outside the walkable hall. One instanced box. */
/** The rest of the house: outer walls this far beyond the hall's side walls, and beyond its far end. */
export const OUTER_GAP = 2.2;
export const OUTER_WALL_H = 1.4;

export type FloorKind = "woodLight" | "woodWarm" | "tile";

/** The floor of room i on a level: the kitchen level starts on tiles; rooms alternate so each reads as its own room. */
export function roomFloor(id: LevelId, room: number): FloorKind {
   const cycle: readonly FloorKind[] = id === 2 ? ["tile", "woodLight", "tile"] : id === 3 ? ["woodWarm", "woodLight", "tile"] : ["woodLight", "tile", "woodWarm"];
   return cycle[room % cycle.length];
}

/** One thin box per room floor (4.8 x 6 m), grouped by floor kind (one draw call per kind). */
export function floorSpots(id: LevelId): Record<FloorKind, InstanceSpot[]> {
   const level = LEVELS[id];
   const out: Record<FloorKind, InstanceSpot[]> = { woodLight: [], woodWarm: [], tile: [] };
   for (let i = 0; i < level.rooms; i++) out[roomFloor(id, i)].push({ x: 0, y: -0.004, z: i * ROOM_LEN + ROOM_LEN / 2, sx: HALL_HALF * 2, sy: 0.01, sz: ROOM_LEN });
   return out;
}

/** A patterned rug in the lane of every room (under the vacuums' loop, flat: nothing collides with it). */
export function rugSpots(level: CatLevel): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (let i = 0; i < level.rooms; i++) spots.push({ x: 0, y: 0.006, z: i * ROOM_LEN + ROOM_LEN / 2, sx: 1.7, sy: 0.008, sz: ROOM_LEN - 1.6 });
   return spots;
}

/** The hall's low walls (0.55 m, under the cat's sight line), each with a dark baseboard and a light cap. */
export function wallSpots(level: CatLevel): { body: InstanceSpot[]; base: InstanceSpot[]; cap: InstanceSpot[] } {
   const h = 0.55;
   const t = 0.2;
   const zEnd = level.rooms * ROOM_LEN;
   const runs = [
      { x: -HALL_HALF - t / 2, z: zEnd / 2, sx: t, sz: zEnd + 2 * t },
      { x: HALL_HALF + t / 2, z: zEnd / 2, sx: t, sz: zEnd + 2 * t },
      { x: 0, z: -t / 2, sx: HALL_HALF * 2, sz: t },
      { x: 0, z: zEnd + t / 2, sx: HALL_HALF * 2, sz: t },
   ];
   return {
      body: runs.map((r) => ({ x: r.x, y: h / 2, z: r.z, sx: r.sx, sy: h, sz: r.sz })),
      base: runs.map((r) => ({ x: r.x, y: 0.05, z: r.z, sx: r.sx + 0.04, sy: 0.1, sz: r.sz + 0.04 })),
      cap: runs.map((r) => ({ x: r.x, y: h + 0.025, z: r.z, sx: r.sx + 0.06, sy: 0.05, sz: r.sz + 0.06 })),
   };
}

/** The outer house walls: both sides and the far end (north), never the camera side (south). */
export function outerWallSpots(level: CatLevel): { body: InstanceSpot[]; trim: InstanceSpot[] } {
   const zEnd = level.rooms * ROOM_LEN;
   const x = HALL_HALF + OUTER_GAP;
   const z0 = -OUTER_GAP - 1;
   const len = zEnd + 40;
   const runs = [
      { x: -x - 0.15, z: z0 + len / 2, sx: 0.3, sz: len },
      { x: x + 0.15, z: z0 + len / 2, sx: 0.3, sz: len },
      { x: 0, z: z0 - 0.15, sx: 2 * x + 0.6, sz: 0.3 },
   ];
   return {
      body: runs.map((r) => ({ x: r.x, y: OUTER_WALL_H / 2, z: r.z, sx: r.sx, sy: OUTER_WALL_H, sz: r.sz })),
      trim: runs.map((r) => ({ x: r.x, y: 0.06, z: r.z, sx: r.sx + 0.06, sy: 0.12, sz: r.sz + 0.06 })),
   };
}
