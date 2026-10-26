// One palette, the follow camera, and the wall segments. Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { followFocus } from "@/arcade3d/core/view";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type FireLevel } from "./levels";
import { DOOR_HALF, HALL_HALF, PORCH_Z, ROOM_DEEP, ROOM_LEN, doorMidZ } from "./rules";

export const COLORS = {
   wall: "#78716c",
   wallTrim: "#a8a29e",
   floor: "#6b6258",
   floorLine: "#857a6d",
   street: "#4b4540",
   ember: "#f97316",
   emberCore: "#fdba74",
   smoke: "#78716c",
   coat: "#b91c1c",
   coatDark: "#7f1d1d",
   stripe: "#f97316",
   navy: "#1e293b",
   helmet: "#292524",
   skin: "#f1d0b4",
   civCloth: "#e7e5e4",
   civTrim: "#44403c",
   sofa: "#78716c",
   sofaCushion: "#a8a29e",
   bed: "#d6d3d1",
   bedFrame: "#57534e",
   cabinet: "#44403c",
   cabinetDoor: "#78716c",
   chair: "#92400e",
   chairSeat: "#b45309",
   truck: "#ef4444",
   truckDark: "#7f1d1d",
   truckGlass: "#bae6fd",
   hydrant: "#dc2626",
   hydrantCap: "#fecaca",
   hose: "#334155",
   hoseRubber: "#b91c1c",
   exit: "#16a34a",
   exitGlow: "#bbf7d0",
   debris: "#78716c",
   debrisBand: "#44403c",
} as const;

export const PITCH = (52 * Math.PI) / 180;
export const YAWS = [0, Math.PI / 2] as const;
export const FOV = 48;
export const FOLLOW = 0.45;
export const LOOK_AHEAD = 1.5;
export const DAMPING = 4;

export function buildingBox(level: FireLevel): AABB {
   const zEnd = level.rooms * ROOM_LEN;
   return {
      min: { x: -HALL_HALF - ROOM_DEEP - 0.4, y: 0, z: PORCH_Z - 0.4 },
      max: { x: HALL_HALF + ROOM_DEEP + 0.4, y: 2.5, z: zEnd + 0.4 },
   };
}

export function lookAtFor(level: FireLevel): [number, number, number] {
   return [0, 0.6, (PORCH_Z + level.rooms * ROOM_LEN) / 2];
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

/** Whole corridor in frame, biased toward the firefighter. Portrait picks the other yaw. */
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
         margin: { top: 0.03, right: 0.02, bottom: 0.05, left: 0.02 },
         padding: 8,
         shift: true,
         fov: FOV,
         // the building is long and narrow: on a phone no distance keeps it clear of the HUD, the stick and the cookie
         // banner (the fit gave up at its 500 m cap and drew nothing), so it frames the whole building and the
         // HUD overlays it, as the follow camera keeps the firefighter in the open middle
         avoidHud: false,
         avoidControls: false,
         avoidObstructions: false,
      };
      VIEWS.set(id, view);
   }
   return view;
}

/** Interior walls, just outside the walkable floor. One instanced box. */
export function wallSpots(level: FireLevel): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   const t = 0.18;
   const h = 2.25;
   const add = (x: number, z: number, sx: number, sz: number) => {
      if (sx < 0.08 || sz < 0.08) return;
      spots.push({ x, y: h / 2, z, sx, sy: h, sz });
   };
   const zEnd = level.rooms * ROOM_LEN;
   add(0, zEnd + t / 2, HALL_HALF * 2, t);
   add(-HALL_HALF - t / 2, PORCH_Z / 2, t, -PORCH_Z);
   add(HALL_HALF + t / 2, PORCH_Z / 2, t, -PORCH_Z);
   for (let i = 0; i < level.rooms; i++) {
      const z0 = i * ROOM_LEN;
      const z1 = z0 + ROOM_LEN;
      const mid = doorMidZ(i);
      const gap0 = mid - DOOR_HALF;
      const gap1 = mid + DOOR_HALF;
      for (const side of [-1, 1] as const) {
         const hasRoom = (i % 2 === 0) === (side < 0);
         const x = side < 0 ? -HALL_HALF - t / 2 : HALL_HALF + t / 2;
         if (!hasRoom) {
            add(x, (z0 + z1) / 2, t, ROOM_LEN);
            continue;
         }
         add(x, (z0 + gap0) / 2, t, gap0 - z0);
         add(x, (gap1 + z1) / 2, t, z1 - gap1);
         const outer = side < 0 ? -HALL_HALF - ROOM_DEEP - t / 2 : HALL_HALF + ROOM_DEEP + t / 2;
         add(outer, (z0 + z1) / 2, t, ROOM_LEN);
         const xMid = side < 0 ? -(HALL_HALF + ROOM_DEEP / 2) : HALL_HALF + ROOM_DEEP / 2;
         add(xMid, z0, ROOM_DEEP, t);
         add(xMid, z1, ROOM_DEEP, t);
      }
   }
   return spots;
}

/** Cosmetic plaques on the hall. Count is scaled by useQuality().decor in the scene. */
export function plaqueSpots(level: FireLevel): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (let i = 0; i < level.rooms; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      spots.push({
         x: side * (HALL_HALF - 0.02),
         y: 1.45,
         z: i * ROOM_LEN + 1.2,
         sx: 0.06,
         sy: 0.42,
         sz: 0.7,
      });
   }
   return spots;
}
