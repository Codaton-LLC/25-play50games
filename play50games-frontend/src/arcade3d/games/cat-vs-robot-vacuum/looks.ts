// One palette, the follow camera, and the wall and floor decor. Pure: no React, no three.js.
// Decor is built at unit size and scaled per spot (InstanceSpot), so one geometry serves every piece.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { followFocus } from "@/arcade3d/core/view";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type CatLevel } from "./levels";
import { HALL_HALF, ROOM_LEN } from "./rules";

export const COLORS = {
   wall: "#d6d3d1",
   wallCap: "#e7e5e4",
   floor: "#e7e5e4",
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
export const YAWS = [0, Math.PI / 2] as const;
export const FOV = 46;
export const FOLLOW = 0.45;
export const LOOK_AHEAD = 1.2;
export const DAMPING = 4;

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

const VIEWS = new Map<LevelId, FittedViewOptions>();

/** The whole hall in frame, biased toward the cat. Portrait picks the other yaw. */
export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      const level = LEVELS[id];
      const area = hallBox(level);
      view = {
         area,
         pitch: PITCH,
         yaws: YAWS,
         focus: followFocus({ lookAt: lookAtFor(level), reach: area, fraction: FOLLOW, bounds: area }),
         margin: { top: 0.03, right: 0.02, bottom: 0.05, left: 0.02 },
         padding: 8,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(id, view);
   }
   return view;
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
