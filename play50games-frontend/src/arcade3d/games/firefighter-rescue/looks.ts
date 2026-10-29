// Per-level palettes and the exterior set dressing, the follow camera, and the wall segments.
// Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { followFocus } from "@/arcade3d/core/view";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type FireLevel } from "./levels";
import { DOOR_HALF, HALL_HALF, PORCH_Z, ROOM_LEN, doorMidZ, roomDeep, roomOf, roomSide } from "./rules";

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
   const deep = roomDeep(level);
   return {
      min: { x: -HALL_HALF - deep - 0.4, y: 0, z: PORCH_Z - 0.4 },
      max: { x: HALL_HALF + deep + 0.4, y: 2.5, z: zEnd + 0.4 },
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
   const deep = roomDeep(level);
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
      const mid = doorMidZ(level, i);
      const gap0 = mid - DOOR_HALF;
      const gap1 = mid + DOOR_HALF;
      for (const side of [-1, 1] as const) {
         const hasRoom = roomSide(level, i) === side;
         const x = side < 0 ? -HALL_HALF - t / 2 : HALL_HALF + t / 2;
         if (!hasRoom) {
            add(x, (z0 + z1) / 2, t, ROOM_LEN);
            continue;
         }
         add(x, (z0 + gap0) / 2, t, gap0 - z0);
         add(x, (gap1 + z1) / 2, t, z1 - gap1);
         const outer = side < 0 ? -HALL_HALF - deep - t / 2 : HALL_HALF + deep + t / 2;
         add(outer, (z0 + z1) / 2, t, ROOM_LEN);
         const xMid = side < 0 ? -(HALL_HALF + deep / 2) : HALL_HALF + deep / 2;
         add(xMid, z0, deep, t);
         add(xMid, z1, deep, t);
      }
   }
   return spots;
}

/** Cosmetic plaques on the hall. Count is scaled by useQuality().decor in the scene. */
export function plaqueSpots(level: FireLevel): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (let i = 0; i < level.rooms; i++) {
      const side = roomSide(level, i);
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
export function doorLeaf(level: FireLevel, room: number, leaf: 0 | 1, open: number, out: { x: number; z: number; rotY: number }) {
   const side = roomSide(level, room);
   const hingeZ = doorMidZ(level, room) + (leaf === 0 ? -DOOR_HALF : DOOR_HALF);
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
   const side = roomSide(level, room);
   return hidesFloor(level, yaw, side * DOOR_LINE_X, doorMidZ(level, room), true, DOOR_HALF * 2) ? LOW_WALL_H : WALL_H;
}

/**
 * The cutaway height (m) of a room's door leaves swung open (lying along x into the room): low when
 * the camera looks across them at the room floor, as a wall there would be.
 */
export function openDoorHeight(level: FireLevel, yaw: number, room: number): number {
   const side = roomSide(level, room);
   const x = side * (DOOR_LINE_X + DOOR_HALF / 2);
   const mid = doorMidZ(level, room);
   return hidesFloor(level, yaw, x, mid - DOOR_HALF, false, DOOR_HALF) || hidesFloor(level, yaw, x, mid + DOOR_HALF, false, DOOR_HALF) ? LOW_WALL_H : WALL_H;
}

/** Both porch walls stand full height (else the lintel over the porch mouth would float over a low wall). */
export function porchFull(level: FireLevel, yaw: number): boolean {
   return !hidesFloor(level, yaw, DOOR_LINE_X, PORCH_Z / 2, true, -PORCH_Z) && !hidesFloor(level, yaw, -DOOR_LINE_X, PORCH_Z / 2, true, -PORCH_Z);
}

// One palette per level (level 1 is today's palette, unchanged): the walls, floor and furniture
// follow the level's look; embers, smoke, debris and the civilians stay the same everywhere so the
// objectives and hazards read the same on every level.
export interface LevelColors {
   wall: string;
   wallTrim: string;
   floor: string;
   floorLine: string;
   street: string;
   sofa: string;
   sofaCushion: string;
   bed: string;
   bedFrame: string;
   cabinet: string;
   cabinetDoor: string;
   chair: string;
   chairSeat: string;
}

const PALETTES: Record<number, LevelColors> = {
   1: {
      wall: COLORS.wall,
      wallTrim: COLORS.wallTrim,
      floor: COLORS.floor,
      floorLine: COLORS.floorLine,
      street: COLORS.street,
      sofa: COLORS.sofa,
      sofaCushion: COLORS.sofaCushion,
      bed: COLORS.bed,
      bedFrame: COLORS.bedFrame,
      cabinet: COLORS.cabinet,
      cabinetDoor: COLORS.cabinetDoor,
      chair: COLORS.chair,
      chairSeat: COLORS.chairSeat,
   },
   // Family House by day: cream walls, a wooden floor, warm furniture.
   2: {
      wall: "#d3c7b4",
      wallTrim: "#f3ece0",
      floor: "#8a6f4d",
      floorLine: "#9d8160",
      street: COLORS.street,
      sofa: "#b08968",
      sofaCushion: "#e6ccb2",
      bed: "#f3ece0",
      bedFrame: "#8a6f4d",
      cabinet: "#6b4f3a",
      cabinetDoor: "#8a6f4d",
      chair: "#7f5539",
      chairSeat: "#b08968",
   },
   // Office: cool grey partitions, blue carpet, dark desks.
   3: {
      wall: "#9aa5b1",
      wallTrim: "#cbd2d9",
      floor: "#525d6b",
      floorLine: "#66727f",
      street: "#3f4750",
      sofa: "#475569",
      sofaCushion: "#94a3b8",
      bed: "#cbd5e1",
      bedFrame: "#64748b",
      cabinet: "#334155",
      cabinetDoor: "#475569",
      chair: "#1e293b",
      chairSeat: "#334155",
   },
   // Hotel at night: dark walls, brass trim, a deep red carpet.
   4: {
      wall: "#4a3f3a",
      wallTrim: "#a1825c",
      floor: "#59393b",
      floorLine: "#6b4a4c",
      street: "#292524",
      sofa: "#4e3d4e",
      sofaCushion: "#a1825c",
      bed: "#e7e0d5",
      bedFrame: "#4a3f3a",
      cabinet: "#3a2f2b",
      cabinetDoor: "#a1825c",
      chair: "#3a2f2b",
      chairSeat: "#a1825c",
   },
   // Warehouse at sunset: bare metal, concrete, wooden crates, safety-yellow trim.
   5: {
      wall: "#6e747c",
      wallTrim: "#f59e0b",
      floor: "#55534f",
      floorLine: "#6b6963",
      street: "#44403c",
      sofa: "#3f4b57",
      sofaCushion: "#6e747c",
      bed: "#78716c",
      bedFrame: "#57534e",
      cabinet: "#8a6b3d",
      cabinetDoor: "#a5824f",
      chair: "#57534e",
      chairSeat: "#78716c",
   },
};

/** The level's palette (level 1 is COLORS, unchanged). */
export function levelColors(level: FireLevel): LevelColors {
   return PALETTES[levelPaletteId(level)];
}

// identify the palette by the theme (levels are distinct themes)
function levelPaletteId(level: FireLevel): number {
   switch (level.plan.furn) {
      case "house": return 2;
      case "office": return 3;
      case "hotel": return 4;
      case "warehouse": return 5;
      default: return 1;
   }
}

/** Wall-mounted pieces (exit signs, plaques) only on walls drawn full height; the lintel's sign with the lintel. */
export function onFullWall(level: FireLevel, yaw: number, spot: InstanceSpot): boolean {
   if (spot === EXIT_SIGN_SPOTS[0]) return porchFull(level, yaw);
   if (Math.abs(Math.abs(spot.x) - HALL_HALF) > 0.15) return true;
   return !hidesFloor(level, yaw, Math.sign(spot.x) * DOOR_LINE_X, spot.z, true, 0);
}

// ---------- per-level exterior set dressing (Scene.tsx renders it; all of it stays off the
// walkable floor — levels-variety.test.ts checks every footprint against the play rects) ----------

export interface DecorPiece {
   spot: InstanceSpot;
   color: string;
}

export interface LevelDecor {
   /** solid-colour boxes: hedges, canopies, docks, crates (instanced per colour in the scene) */
   boxes: DecorPiece[];
   /** cylinders: columns, barrels, posts, topiary */
   cyls: DecorPiece[];
   /** window strips and sign glows on the exterior walls (`emissive` 0 = plain glass) */
   windows: { spot: InstanceSpot; color: string; emissive: number }[];
}

const NO_DECOR: LevelDecor = { boxes: [], cyls: [], windows: [] };

/**
 * The level's set pieces outside the building: family-house hedges, the office entrance canopy and
 * glass strips, the hotel's lit windows and portico, the warehouse dock and barrels. Everything
 * sits beyond the porch walls (|x| > 1.7 or z < -3.45) or on an exterior wall face, so the play
 * floor, the camera solids and the cutaway are untouched. Level 1 keeps its bare street.
 */
export function levelDecor(level: FireLevel): LevelDecor {
   const zEnd = level.rooms * ROOM_LEN;
   const outerX = HALL_HALF + roomDeep(level) + 0.18;
   switch (level.plan.furn) {
      case "house": {
         const boxes: DecorPiece[] = [];
         const cyls: DecorPiece[] = [];
         // a clipped hedge along the far side of the street, behind the parked truck
         for (const x of [-6.0, -4.5, -3.0, 3.0, 4.5, 6.0]) boxes.push({ spot: { x, y: 0.3, z: -6.9, sx: 1.4, sy: 0.6, sz: 0.5 }, color: "#527a35" });
         // the front garden walls beside the porch and the lawn patches
         for (const side of [-1, 1]) {
            boxes.push({ spot: { x: side * 1.78, y: 0.225, z: -2.2, sx: 0.24, sy: 0.45, sz: 2.4 }, color: "#d3c7b4" });
            boxes.push({ spot: { x: side * 3.6, y: 0.03, z: -2.9, sx: 3.0, sy: 0.06, sz: 1.6 }, color: "#5c8a3c" });
         }
         // the mailbox by the garden gate
         boxes.push({ spot: { x: 2.15, y: 0.55, z: -3.6, sx: 0.14, sy: 1.1, sz: 0.14 }, color: "#6b4f3a" });
         boxes.push({ spot: { x: 2.15, y: 1.2, z: -3.6, sx: 0.34, sy: 0.26, sz: 0.5 }, color: "#8a6f4d" });
         const windows = level.rooms === 3
            ? [
               { spot: { x: -outerX - 0.02, y: 1.5, z: 3, sx: 0.06, sy: 0.85, sz: 1.5 }, color: "#bfd7ea", emissive: 0 },
               { spot: { x: outerX + 0.02, y: 1.5, z: 9, sx: 0.06, sy: 0.85, sz: 1.5 }, color: "#bfd7ea", emissive: 0 },
               { spot: { x: outerX + 0.02, y: 1.5, z: 15, sx: 0.06, sy: 0.85, sz: 1.5 }, color: "#bfd7ea", emissive: 0 },
            ]
            : [];
         return { boxes, cyls, windows };
      }
      case "office": {
         const boxes: DecorPiece[] = [
            // the entrance canopy on two slim columns, over the street end of the porch
            { spot: { x: 0, y: 2.42, z: -4.05, sx: 5.0, sy: 0.14, sz: 1.6 }, color: "#334155" },
            // the company sign panel on the far gable
            { spot: { x: 0, y: 2.0, z: zEnd + 0.14, sx: 4.4, sy: 0.7, sz: 0.1 }, color: "#1e293b" },
         ];
         const cyls: DecorPiece[] = [
            { spot: { x: -2.2, y: 1.2, z: -4.55, sx: 0.1, sy: 2.4, sz: 0.1 }, color: "#475569" },
            { spot: { x: 2.2, y: 1.2, z: -4.55, sx: 0.1, sy: 2.4, sz: 0.1 }, color: "#475569" },
         ];
         // glass strips down both wing faces, two per room
         const windows: LevelDecor["windows"] = [
            { spot: { x: 0, y: 2.0, z: zEnd + 0.2, sx: 3.4, sy: 0.22, sz: 0.06 }, color: "#7dd3fc", emissive: 0.5 },
         ];
         for (let i = 0; i < level.rooms; i++) {
            const side = roomSide(level, i);
            for (const dz of [1.9, 4.1]) {
               windows.push({ spot: { x: side * (outerX + 0.02), y: 1.55, z: i * ROOM_LEN + dz, sx: 0.06, sy: 0.8, sz: 1.0 }, color: "#9fc3dd", emissive: 0.18 });
            }
         }
         return { boxes, cyls, windows };
      }
      case "hotel": {
         const boxes: DecorPiece[] = [
            // the portico slab and the lit hotel sign over it
            { spot: { x: 0, y: 2.44, z: -4.0, sx: 5.4, sy: 0.16, sz: 1.7 }, color: "#3a2f2b" },
            { spot: { x: 0, y: 2.72, z: -4.35, sx: 2.6, sy: 0.34, sz: 0.12 }, color: "#2a211d" },
            // planter tubs flanking the porch
            { spot: { x: -2.05, y: 0.28, z: -2.6, sx: 0.62, sy: 0.56, sz: 1.1 }, color: "#4a3f3a" },
            { spot: { x: 2.05, y: 0.28, z: -2.6, sx: 0.62, sy: 0.56, sz: 1.1 }, color: "#4a3f3a" },
         ];
         const cyls: DecorPiece[] = [
            { spot: { x: -2.35, y: 1.2, z: -4.55, sx: 0.11, sy: 2.4, sz: 0.11 }, color: "#a1825c" },
            { spot: { x: 2.35, y: 1.2, z: -4.55, sx: 0.11, sy: 2.4, sz: 0.11 }, color: "#a1825c" },
            { spot: { x: -2.05, y: 0.82, z: -2.6, sx: 0.3, sy: 0.52, sz: 0.3 }, color: "#3f5a32" },
            { spot: { x: 2.05, y: 0.82, z: -2.6, sx: 0.3, sy: 0.52, sz: 0.3 }, color: "#3f5a32" },
         ];
         // every room's windows lit warm against the night
         const windows: LevelDecor["windows"] = [
            { spot: { x: 0, y: 2.74, z: -4.42, sx: 2.3, sy: 0.18, sz: 0.06 }, color: "#fcd34d", emissive: 1 },
            { spot: { x: 0, y: 1.5, z: zEnd + 0.02, sx: 1.4, sy: 0.85, sz: 0.06 }, color: "#fcd34d", emissive: 0.9 },
         ];
         for (let i = 0; i < level.rooms; i++) {
            const side = roomSide(level, i);
            for (const dz of [2.1, 3.9]) {
               windows.push({ spot: { x: side * (outerX + 0.02), y: 1.55, z: i * ROOM_LEN + dz, sx: 0.06, sy: 0.75, sz: 0.85 }, color: "#fcd34d", emissive: 0.85 });
            }
         }
         return { boxes, cyls, windows };
      }
      case "warehouse": {
         const boxes: DecorPiece[] = [
            // the loading dock across the far end and a roller-door frame on the gable
            { spot: { x: 0, y: 0.55, z: zEnd + 1.35, sx: 7.0, sy: 1.1, sz: 1.7 }, color: "#6b6963" },
            { spot: { x: -1.5, y: 1.3, z: zEnd + 0.16, sx: 0.28, sy: 2.6, sz: 0.24 }, color: "#4b5563" },
            { spot: { x: 1.5, y: 1.3, z: zEnd + 0.16, sx: 0.28, sy: 2.6, sz: 0.24 }, color: "#4b5563" },
            { spot: { x: 0, y: 2.62, z: zEnd + 0.16, sx: 3.3, sy: 0.32, sz: 0.24 }, color: "#4b5563" },
            // pallets beside the porch
            { spot: { x: -2.35, y: 0.07, z: -2.7, sx: 1.0, sy: 0.14, sz: 1.0 }, color: "#8a6b3d" },
            { spot: { x: -2.35, y: 0.21, z: -2.7, sx: 0.9, sy: 0.14, sz: 0.9 }, color: "#a5824f" },
            { spot: { x: 2.35, y: 0.07, z: -2.7, sx: 1.0, sy: 0.14, sz: 1.0 }, color: "#8a6b3d" },
         ];
         const cyls: DecorPiece[] = [];
         // barrels along the pavement
         for (const [x, color] of [[-5.6, "#b91c1c"], [-4.9, "#334155"], [4.9, "#334155"], [5.6, "#b91c1c"], [6.3, "#8a6b3d"]] as const) {
            cyls.push({ spot: { x, y: 0.43, z: -4.5, sx: 0.64, sy: 0.86, sz: 0.64 }, color });
         }
         // high clerestory strips on the wide bays, glowing in the sunset
         const windows: LevelDecor["windows"] = [];
         for (let i = 0; i < level.rooms; i += 2) {
            const side = roomSide(level, i);
            windows.push({ spot: { x: side * (outerX + 0.02), y: 1.95, z: i * ROOM_LEN + 3, sx: 0.06, sy: 0.45, sz: 2.6 }, color: "#fdba74", emissive: 0.4 });
         }
         return { boxes, cyls, windows };
      }
      default:
         return NO_DECOR;
   }
}
