// One palette, the follow camera, and the wall and floor decor. Pure: no React, no three.js.
// Decor is built at unit size and scaled per spot (InstanceSpot), so one geometry serves every piece.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type CatLevel } from "./levels";
import { HALL_HALF, ROOM_LEN } from "./rules";

export const COLORS = {
   wall: "#d6d3d1",
   wallCap: "#e7e5e4",
   floor: "#e7e5e4",
   outerFloor: "#a8a29e",
   glow: "#38bdf8",
   bay: "#d6cfc4",
   rug: "#fb923c",
   rugEdge: "#f97316",
   cat: "#fb923c",
   catDark: "#c2410c",
   catInner: "#fecdd3",
   vacuum: "#94a3b8",
   vacuumDark: "#475569",
   vacuumGlow: "#38bdf8",
   treat: "#f97316",
   treatCore: "#fdba74",
   toy: "#fde68a",
   toyCore: "#facc15",
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
   pad: "#fb923c",
} as const;

export const PITCH = (55 * Math.PI) / 180;
export const FOV = 46;
/** fog starts past the follow camera's view of the hall, so the house fades out only at its far edge */
export const FOG_NEAR = 22;
export const FOG_FAR = 60;
/** a look-ahead along the cat's facing */
export const LOOK_AHEAD = 1.2;
export const DAMPING = 4;
/** The camera keeps this window (half sizes, m) around its aim: the hall's width with its walls and decor strip, 9 m of it. */
export const VIEW_WINDOW = { x: 3.0, z: 4.5 } as const;

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

/** Where the camera may aim: along the hall's centre line, so the window never shows much past the end walls. */
export function aimBounds(level: CatLevel): AABB {
   const zEnd = level.rooms * ROOM_LEN;
   const lo = Math.min(VIEW_WINDOW.z - 1, zEnd / 2);
   const hi = Math.max(zEnd - VIEW_WINDOW.z + 1, zEnd / 2);
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
export function wallSpots(level: CatLevel): InstanceSpot[] {
   const h = 0.55;
   const t = 0.2;
   const zEnd = level.rooms * ROOM_LEN;
   const span = (x: number, z: number, sx: number, sz: number): InstanceSpot => ({ x, y: h / 2, z, sx, sy: h, sz });
   return [
      span(-HALL_HALF - t / 2, zEnd / 2, t, zEnd),
      span(HALL_HALF + t / 2, zEnd / 2, t, zEnd),
      span(0, -t / 2, HALL_HALF * 2 + t, t),
      span(0, zEnd + t / 2, HALL_HALF * 2 + t, t),
   ];
}

/** Flat tone strips: one per bay per room, so each room reads as a room from above. */
export function baySpots(level: CatLevel): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (let i = 0; i < level.rooms; i++) {
      const z = i * ROOM_LEN + ROOM_LEN / 2;
      for (const side of [-1, 1]) {
         spots.push({ x: side * 1.8, y: 0.005, z, sx: 1.2, sy: 0.01, sz: ROOM_LEN - 0.2 });
      }
   }
   return spots;
}

/** The lane rug under the vacuum's loop. */
export function rugSpot(level: CatLevel): InstanceSpot {
   return { x: 0, y: 0.008, z: (level.rooms * ROOM_LEN) / 2, sx: 1.9, sy: 0.012, sz: level.rooms * ROOM_LEN - 2.4 };
}
