// One palette, lighting preset + fog, and follow camera options. Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { followFocus } from "@/arcade3d/core/view";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type MansionLevel } from "./levels";
import { ROOM_D, ROOM_W, WALL_H, WALL_T } from "./rules";

export const COLORS = {
   wall: "#292524",
   wallTrim: "#44403c",
   floor: "#1c1917",
   floorTrim: "#292524",
   accent: "#c4b5fd", // moonlight accent
   door: "#451a03",
   doorTrim: "#78350f",
   leverPlate: "#78716c",
   leverHandle: "#d4d4d8",
   armour: "#94a3b8",
   armourTrim: "#cbd5e1",
   clock: "#78350f",
   frame: "#d97706",
   canvas: "#3b352e",
   chair: "#92400e",
   table: "#78350f",
   bookshelf: "#57534e",
   detectiveCoat: "#475569",
   detectiveSkin: "#f1d0b4",
   exitGlow: "#86efac",
} as const;

export const PITCH = (58 * Math.PI) / 180;
export const YAWS = [0] as const;
export const FOV = 48;
export const FOLLOW = 0.55;
export const LOOK_AHEAD = 1.0;
export const DAMPING = 5;

export function buildingBox(level: MansionLevel): AABB {
   return {
      min: { x: -0.4, y: 0, z: -0.4 },
      max: { x: level.cols * ROOM_W + 0.4, y: WALL_H + 0.5, z: level.rows * ROOM_D + 0.4 },
   };
}

export function lookAtFor(level: MansionLevel): [number, number, number] {
   return [(level.cols * ROOM_W) / 2, 0.9, (level.rows * ROOM_D) / 2];
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      const level = LEVELS[id];
      const area = buildingBox(level);
      view = {
         area,
         pitch: PITCH,
         yaws: YAWS,
         focus: followFocus({ lookAt: lookAtFor(level), reach: area, fraction: FOLLOW, bounds: area }),
         margin: { top: 0.04, right: 0.03, bottom: 0.05, left: 0.03 },
         padding: 8,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(id, view);
   }
   return view;
}

export function wallSpots(solids: readonly AABB[]): InstanceSpot[] {
   return solids.map((b) => {
      const sx = Math.max(0.01, b.max.x - b.min.x);
      const sy = Math.max(0.01, b.max.y - b.min.y);
      const sz = Math.max(0.01, b.max.z - b.min.z);
      return {
         x: (b.min.x + b.max.x) / 2,
         y: (b.min.y + b.max.y) / 2,
         z: (b.min.z + b.max.z) / 2,
         sx,
         sy,
         sz,
      };
   });
}
