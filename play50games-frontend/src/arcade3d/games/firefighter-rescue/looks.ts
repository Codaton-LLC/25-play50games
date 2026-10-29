// One palette, the follow camera, and the wall segments. Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { followFocus } from "@/arcade3d/core/view";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type FireLevel } from "./levels";
import { DOOR_HALF, HALL_HALF, PORCH_Z, ROOM_DEEP, ROOM_LEN, doorMidZ, roomOf } from "./rules";

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
   const h = WALL_H;
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

// ---------- the Hyper3D props outside and on the walls (assets.ts fits them; assets.test.ts checks
// none of them stands on the walkable floor or between a fitted camera and the play) ----------

/** The fire truck parked across the street in front of the porch (its length along x). */
export const TRUCK_SPOT: InstanceSpot = { x: 0, y: 0, z: -5.75, rotY: Math.PI / 2 };
/** Two hydrants on the pavement either side of the truck. */
export const HYDRANT_SPOTS: InstanceSpot[] = [
   { x: -3.55, y: 0, z: -4.05, rotY: 0.4 },
   { x: 3.55, y: 0, z: -4.05, rotY: -0.4 },
];
/** The hose reel beside the truck, facing the building. */
export const HOSE_REEL_SPOT: InstanceSpot = { x: -5.1, y: 0, z: -4.25, rotY: 0 };
/** The street (code ground) under the truck: centre z and size. */
export const STREET = { z: -5.6, width: 13, depth: 4.4 } as const;

/** The lintel over the porch mouth (code, one more wall piece): bottom at the wall top. */
export const LINTEL: InstanceSpot = { x: 0, y: 2.33, z: PORCH_Z - 0.09, sx: HALL_HALF * 2 + 0.36, sy: 0.16, sz: 0.18 };

/**
 * Exit signs over the way out: one under the lintel over the porch mouth, facing in (the hall, the
 * player coming out), and one flush on each porch wall over the exit zone, facing the hall. Their
 * bottoms (y) are where the GLB's floor pivot goes; all hang above 1.7 m.
 */
export const EXIT_SIGN_SPOTS: InstanceSpot[] = [
   { x: 0, y: 1.9, z: PORCH_Z + 0.06, rotY: 0 },
   { x: -HALL_HALF + 0.05, y: 1.72, z: -2.05, rotY: Math.PI / 2 },
   { x: HALL_HALF - 0.05, y: 1.72, z: -2.05, rotY: -Math.PI / 2 },
];

/** The hall wall's centre line on a room's side (doors stand in it). */
export const DOOR_LINE_X = HALL_HALF + 0.09;

/**
 * One leaf of a room's double fire door (leaf 0 hinged at the doorway's low-z edge, leaf 1 at its
 * high-z edge), `open` 0 = shut in the doorway, 1 = swung 90° into the room against the doorway's
 * side. Writes the leaf's centre (floor) and its turn into `out`: the leaf's width (GLB x) runs from
 * the hinge along the swing direction.
 */
export function doorLeaf(room: number, leaf: 0 | 1, open: number, out: { x: number; z: number; rotY: number }) {
   const side = room % 2 === 0 ? -1 : 1;
   const hingeZ = doorMidZ(room) + (leaf === 0 ? -DOOR_HALF : DOOR_HALF);
   const shutZ = leaf === 0 ? 1 : -1;
   const a = Math.max(0, Math.min(1, open)) * (Math.PI / 2);
   const dx = side * Math.sin(a);
   const dz = shutZ * Math.cos(a);
   const half = DOOR_HALF / 2;
   out.x = side * DOOR_LINE_X + dx * half;
   out.z = hingeZ + dz * half;
   out.rotY = Math.atan2(-dz, dx);
   return out;
}

// ---------- cutaway: walls between the camera and the floor are drawn low ----------

/** Full wall height (m) and the cutaway height of a wall the camera looks over at the floor behind it. */
export const WALL_H = 2.25;
export const LOW_WALL_H = 1.0;

/**
 * Does a wall piece at (x, z), running along z (`alongZ`) or along x, stand between a camera at
 * `yaw` (core fitView: the camera sits at +sin(yaw), +cos(yaw) from its focus) and walkable floor?
 * Only walls across the view count (a wall running towards the camera hides nearly nothing), and
 * only with floor right behind them (an outer wall with the street behind stays full height).
 */
export function hidesFloor(level: FireLevel, yaw: number, x: number, z: number, alongZ: boolean, length = 0): boolean {
   const cx = Math.sin(yaw);
   const cz = Math.cos(yaw);
   if (alongZ ? Math.abs(cx) < 0.5 : Math.abs(cz) < 0.5) return false;
   const back = 0.7;
   for (const t of [-0.4, 0, 0.4]) {
      const px = x - cx * back + (alongZ ? 0 : t * length);
      const pz = z - cz * back + (alongZ ? t * length : 0);
      if (roomOf(level, px, pz) !== -2) return true;
   }
   return false;
}

/** wallSpots with every wall that would hide floor from the camera at `yaw` cut down to LOW_WALL_H. */
export function cutawayWalls(level: FireLevel, yaw: number): InstanceSpot[] {
   return wallSpots(level).map((spot) => {
      const alongZ = (spot.sz ?? 1) > (spot.sx ?? 1);
      if (!hidesFloor(level, yaw, spot.x, spot.z, alongZ, alongZ ? spot.sz ?? 0 : spot.sx ?? 0)) return spot;
      return { ...spot, y: LOW_WALL_H / 2, sy: LOW_WALL_H };
   });
}

/** The height (m) of the hall wall a room's door stands in, for the camera at `yaw`. */
export function doorWallHeight(level: FireLevel, yaw: number, room: number): number {
   const side = room % 2 === 0 ? -1 : 1;
   return hidesFloor(level, yaw, side * DOOR_LINE_X, doorMidZ(room), true, DOOR_HALF * 2) ? LOW_WALL_H : WALL_H;
}

/**
 * The cutaway height (m) of a room's door leaves swung open (lying along x into the room): low when
 * the camera looks across them at the room floor, as a wall there would be.
 */
export function openDoorHeight(level: FireLevel, yaw: number, room: number): number {
   const side = room % 2 === 0 ? -1 : 1;
   const x = side * (DOOR_LINE_X + DOOR_HALF / 2);
   const mid = doorMidZ(room);
   return hidesFloor(level, yaw, x, mid - DOOR_HALF, false, DOOR_HALF) || hidesFloor(level, yaw, x, mid + DOOR_HALF, false, DOOR_HALF) ? LOW_WALL_H : WALL_H;
}

/** Both porch walls stand full height (else the lintel over the porch mouth would float over a low wall). */
export function porchFull(level: FireLevel, yaw: number): boolean {
   return !hidesFloor(level, yaw, DOOR_LINE_X, PORCH_Z / 2, true, -PORCH_Z) && !hidesFloor(level, yaw, -DOOR_LINE_X, PORCH_Z / 2, true, -PORCH_Z);
}

/** Wall-mounted pieces (exit signs, plaques) only on walls drawn full height; the lintel's sign with the lintel. */
export function onFullWall(level: FireLevel, yaw: number, spot: InstanceSpot): boolean {
   if (spot === EXIT_SIGN_SPOTS[0]) return porchFull(level, yaw);
   if (Math.abs(Math.abs(spot.x) - HALL_HALF) > 0.15) return true;
   return !hidesFloor(level, yaw, Math.sign(spot.x) * DOOR_LINE_X, spot.z, true, 0);
}
