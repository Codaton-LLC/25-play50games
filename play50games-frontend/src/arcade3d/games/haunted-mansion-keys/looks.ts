// One palette, the follow view and the spots the Scene draws. Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type MansionLevel } from "./levels";
import { ROOM_D, ROOM_W, WALL_H, type Prop, type PropKind, type Run } from "./rules";

export const COLORS = {
   wall: "#292524",
   wallTrim: "#57534e",
   wallBack: "#3b302a",
   floor: "#3f2d22",
   floorPlank: "#4a3628",
   floorSeam: "#2a1d15",
   grounds: "#1a2419",
   gravel: "#44403c",
   accent: "#c4b5fd",
   door: "#451a03",
   doorTrim: "#78350f",
   leverPlate: "#78716c",
   leverHandle: "#d4d4d8",
   leverPost: "#44403c",
   armour: "#94a3b8",
   armourTrim: "#cbd5e1",
   clock: "#78350f",
   frame: "#d97706",
   canvas: "#3b352e",
   chair: "#92400e",
   table: "#78350f",
   bookshelf: "#57534e",
   pedestal: "#57534e",
   pedestalTop: "#a8a29e",
   detectiveCoat: "#475569",
   detectiveSkin: "#f1d0b4",
   exitGlow: "#86efac",
} as const;

export const PITCH = (58 * Math.PI) / 180;
export const FOV = 48;
export const LOOK_AHEAD = 1.0;
export const DAMPING = 5;

/**
 * Walls are drawn as a cutaway: the back (z = 0) exterior wall full height (the paintings, the clock
 * and the shelves stand against it), every other wall low, so the camera (looking north, pitch 58°)
 * always sees the detective over them (a 1 m wall hides at most the legs).
 */
export const LOW_WALL_H = 1.0;

export function buildingBox(level: MansionLevel): AABB {
   return {
      min: { x: -0.4, y: 0, z: -0.4 },
      max: { x: level.cols * ROOM_W + 0.4, y: WALL_H + 0.5, z: level.rows * ROOM_D + 0.4 },
   };
}

export function lookAtFor(level: MansionLevel): [number, number, number] {
   return [(level.cols * ROOM_W) / 2, 0.9, (level.rows * ROOM_D) / 2];
}

/** Half size of the window kept on screen round the aim: one room and a half, so a room fills the view. */
export const VIEW_WINDOW = { x: 5.2, z: 4.4 } as const;

const VIEWS = new Map<LevelId, FittedViewOptions>();

/** The close follow view: a window round the aim point, clear of the HUD, the key ring and the controls. */
export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      const level = LEVELS[id];
      const wx = Math.min(VIEW_WINDOW.x, (level.cols * ROOM_W) / 2 + 0.5);
      const wz = Math.min(VIEW_WINDOW.z, (level.rows * ROOM_D) / 2 + 0.5);
      view = {
         area: { min: { x: -wx, y: 0, z: -wz }, max: { x: wx, y: 1.8, z: wz } },
         pitch: PITCH,
         yaws: [0],
         margin: { top: 0.04, right: 0.03, bottom: 0.05, left: 0.03 },
         padding: 8,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(id, view);
   }
   return view;
}

/** Where the camera may aim: the building shrunk by the window (the view never drifts off the house). */
export function aimBounds(level: MansionLevel): AABB {
   const w = level.cols * ROOM_W;
   const d = level.rows * ROOM_D;
   const cx = w / 2;
   const cz = d / 2;
   const hx = Math.max(0, w / 2 - VIEW_WINDOW.x + 1);
   const hz = Math.max(0, d / 2 - VIEW_WINDOW.z + 1);
   return { min: { x: cx - hx, y: 0.9, z: cz - hz }, max: { x: cx + hx, y: 0.9, z: cz + hz } };
}

/** Is this wall the back (north, z <= 0) exterior wall? */
export const isBackWall = (b: AABB) => b.max.z <= 0 && b.min.z < 0;

/** Wall boxes as instance spots (unit cube scaled per spot), at their drawn height. */
export function wallSpots(walls: readonly AABB[]): InstanceSpot[] {
   return walls.map((b) => {
      const h = isBackWall(b) ? WALL_H : LOW_WALL_H;
      return {
         x: (b.min.x + b.max.x) / 2,
         y: h / 2,
         z: (b.min.z + b.max.z) / 2,
         sx: Math.max(0.01, b.max.x - b.min.x),
         sy: h,
         sz: Math.max(0.01, b.max.z - b.min.z),
      };
   });
}

/** A light cap on every low wall. */
export function capSpots(walls: readonly AABB[]): InstanceSpot[] {
   return walls.map((b) => {
      const h = isBackWall(b) ? WALL_H : LOW_WALL_H;
      return {
         x: (b.min.x + b.max.x) / 2,
         y: h + 0.025,
         z: (b.min.z + b.max.z) / 2,
         sx: Math.max(0.01, b.max.x - b.min.x) + 0.04,
         sy: 0.05,
         sz: Math.max(0.01, b.max.z - b.min.z) + 0.04,
      };
   });
}

export function propSpots(props: readonly Prop[], kind: PropKind): InstanceSpot[] {
   return props.filter((p) => p.kind === kind).map((p) => ({ x: p.x, y: 0, z: p.z, rotY: p.rotY }));
}

/** A painting on the back wall of every first-row room, between its clock and shelf. */
export function paintingSpots(run: Run): InstanceSpot[] {
   return run.rooms.filter((r) => r.row === 0).map((r) => ({ x: r.cx, y: 0.95, z: 0.08 }));
}
