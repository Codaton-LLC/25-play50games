// One palette, the follow camera, the corridor's walls and decor spots, and the label atlas layout.
// Pure: no React, no three.js. Decor boxes are unit cubes scaled by their spot (sx / sy / sz), never
// a sized geometry scaled again.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import type { HotelLevel } from "./levels";
import { DOOR_SPACING, ELEVATOR_Z, HALF_W, LOBBY_LEN, corridorLength, doorZ } from "./rules";

export const COLORS = {
   wall: "#44403c",
   wallUpper: "#57534e",
   wainscot: "#292524",
   carpet: "#7f1d1d",
   carpetDeep: "#5b1414",
   carpetBorder: "#d4a574",
   marble: "#e7e5e4",
   marbleVein: "#a8a29e",
   marbleDark: "#78716c",
   brass: "#d4a574",
   brassDeep: "#a16207",
   accent: "#fbbf24",
   glow: "#fde68a",
   void: "#2a2018",
   jacket: "#991b1b",
   trousers: "#1c1917",
   skin: "#f1d0b4",
   wood: "#7c2d12",
   woodDark: "#431407",
   leaf: "#3f6212",
   leafLight: "#65a30d",
   sofa: "#78716c",
   sofaCushion: "#a8a29e",
   guest: "#e7e5e4",
   guestTrim: "#44403c",
   suitcase: "#0f766e",
   padOff: "#3f3f46",
   ok: "#4ade80",
   label: "#fffbeb",
   labelInk: "#1c1917",
} as const;

/** The floors' colours: the door plates, the elevator panel, the key card and the HUD card. */
export const FLOOR_COLORS = ["#fbbf24", "#2dd4bf", "#a78bfa", "#fb7185"] as const;
export const floorColor = (floor: number) => FLOOR_COLORS[(Math.max(1, floor) - 1) % FLOOR_COLORS.length];

export const WALL_T = 0.18;
export const WALL_H = 2.8;
/** The two walls between the camera and the hall (the lobby end and the x -2 side) are low. */
export const LOW_WALL_H = 0.9;

// ---------- camera ----------

export const PITCH = (50 * Math.PI) / 180;
/**
 * Landscape looks across the hall from the low x -2 side (yaw -pi/2: the lobby on the left, the doors
 * facing the camera); portrait looks up the hall from the lobby end (yaw pi).
 */
export const YAWS = [-Math.PI / 2, Math.PI] as const;
export const FOV = 46;
/**
 * The follow camera keeps this much of the hall around the bellboy on screen (m along the hall): across
 * a landscape screen, and up a portrait one (shorter there, so the hall fills a phone's width).
 */
export const WINDOW_HALF_Z = 3.6;
export const PORTRAIT_HALF_Z = 2.3;
export const windowHalf = (portrait: boolean) => (portrait ? PORTRAIT_HALF_Z : WINDOW_HALF_Z);
export const LOOK_Y = 0.6;
export const LOOK_AHEAD = 1.2;
export const DAMPING = 4.5;

/** The window the camera keeps on screen, centred on its look point at rest. */
export function windowBox(portrait = false): AABB {
   return {
      min: { x: -HALF_W - WALL_T, y: 0, z: 0 },
      max: { x: HALF_W + WALL_T, y: WALL_H, z: windowHalf(portrait) * 2 },
   };
}

export const restLook = (portrait = false): [number, number, number] => [0, LOOK_Y, windowHalf(portrait)];

/** Where the look point may go: x 0, z from the lobby's window to the far end's. */
export function lookBounds(level: HotelLevel, portrait = false): AABB {
   const length = corridorLength(level);
   const half = windowHalf(portrait);
   let lo = half - 0.8;
   let hi = length - half + 0.8;
   if (lo > hi) lo = hi = length / 2;
   return { min: { x: 0, y: LOOK_Y, z: lo }, max: { x: 0, y: LOOK_Y, z: hi } };
}

const VIEWS = new Map<string, FittedViewOptions>();

/**
 * The window from its one rest look point: the camera keeps that offset wherever it follows. A
 * landscape canvas looks across the hall (yaw -pi/2), a portrait one up it (yaw pi).
 */
export function viewFor(id: LevelId, portrait = false): FittedViewOptions {
   const key = `${id}:${portrait}`;
   let view = VIEWS.get(key);
   if (!view) {
      const [x, y, z] = restLook(portrait);
      view = {
         area: windowBox(portrait),
         pitch: PITCH,
         yaws: [portrait ? YAWS[1] : YAWS[0]],
         focus: [{ x, y, z }],
         margin: { top: 0.06, right: 0.02, bottom: 0.04, left: 0.02 },
         padding: 6,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(key, view);
   }
   return view;
}

// ---------- walls and decor ----------

/** Wall boxes (unit cubes scaled per spot): the tall door wall and far end, the low near walls. */
export function wallSpots(level: HotelLevel): InstanceSpot[] {
   const length = corridorLength(level);
   const out: InstanceSpot[] = [];
   const add = (x: number, z: number, sx: number, sy: number, sz: number) => out.push({ x, y: sy / 2, z, sx, sy, sz });
   add(HALF_W + WALL_T / 2, length / 2, WALL_T, WALL_H, length + WALL_T * 2);
   add(0, length + WALL_T / 2, HALF_W * 2 + WALL_T * 2, WALL_H, WALL_T);
   add(-HALF_W - WALL_T / 2, length / 2, WALL_T, LOW_WALL_H, length + WALL_T * 2);
   add(0, -WALL_T / 2, HALF_W * 2 + WALL_T * 2, LOW_WALL_H, WALL_T);
   return out;
}

/** Dark wainscot panels and brass rails on the door wall's corridor face. */
export function trimSpots(level: HotelLevel): { wainscot: InstanceSpot[]; brass: InstanceSpot[] } {
   const length = corridorLength(level);
   const face = HALF_W - 0.01;
   return {
      wainscot: [
         { x: face, y: 0.5, z: length / 2, sx: 0.02, sy: 1, sz: length },
         { x: -HALF_W + 0.01, y: LOW_WALL_H / 2, z: length / 2, sx: 0.02, sy: LOW_WALL_H, sz: length },
      ],
      brass: [
         { x: face - 0.012, y: 1.02, z: length / 2, sx: 0.03, sy: 0.05, sz: length },
         { x: face - 0.012, y: WALL_H - 0.06, z: length / 2, sx: 0.04, sy: 0.12, sz: length },
         { x: -HALF_W + 0.01, y: LOW_WALL_H + 0.03, z: length / 2, sx: WALL_T + 0.06, sy: 0.06, sz: length + WALL_T * 2 },
         { x: 0, y: LOW_WALL_H + 0.03, z: -WALL_T / 2, sx: HALF_W * 2 + WALL_T * 2, sy: 0.06, sz: WALL_T + 0.06 },
      ],
   };
}

/** Wall sconces on the door wall between the doors (the count follows useQuality().decor in the Scene). */
export function sconceSpots(level: HotelLevel): InstanceSpot[] {
   const out: InstanceSpot[] = [{ x: HALF_W - 0.06, y: 1.95, z: 2.4, sx: 0.1, sy: 0.32, sz: 0.2 }];
   for (let i = 0; i < level.doors - 1; i++) out.push({ x: HALF_W - 0.06, y: 1.95, z: doorZ(i) + DOOR_SPACING / 2, sx: 0.1, sy: 0.32, sz: 0.2 });
   return out;
}

/** Door frames (brass, unit cubes): two jambs and a head per door, plus the elevator's. */
export function frameSpots(level: HotelLevel): InstanceSpot[] {
   const out: InstanceSpot[] = [];
   const frame = (z: number, half: number, h: number) => {
      out.push({ x: HALF_W - 0.03, y: h / 2, z: z - half, sx: 0.08, sy: h, sz: 0.08 });
      out.push({ x: HALF_W - 0.03, y: h / 2, z: z + half, sx: 0.08, sy: h, sz: 0.08 });
      out.push({ x: HALF_W - 0.03, y: h + 0.04, z, sx: 0.08, sy: 0.08, sz: half * 2 + 0.08 });
   };
   for (let i = 0; i < level.doors; i++) frame(doorZ(i), 0.6, 2.14);
   frame(ELEVATOR_Z, 0.78, 2.34);
   return out;
}

export function doorSpots(level: HotelLevel): InstanceSpot[] {
   return Array.from({ length: level.doors }, (_, i) => ({ x: HALF_W - 0.09, y: 0, z: doorZ(i) }));
}

/** The carpet runner from the lobby to the far wall, and the marble lobby. */
export function floorRects(level: HotelLevel): { runner: { z0: number; z1: number }; lobby: { z0: number; z1: number } } {
   return { runner: { z0: LOBBY_LEN - 0.3, z1: corridorLength(level) }, lobby: { z0: 0, z1: LOBBY_LEN - 0.3 } };
}

// ---------- the label atlas ----------

/** One canvas for every door number, the elevator panel and the trolley's key card. */
export const ATLAS = { width: 1024, height: 512, cols: 4, rows: 4 } as const;
/** cells 0..5 the doors, 6 the elevator panel, 7 the key card */
export const ELEVATOR_CELL = 6;
export const CARD_CELL = 7;

/** UV rectangle of one atlas cell (u0, v0, u1, v1; v up as in three.js). */
export function cellUv(cell: number): [number, number, number, number] {
   const col = cell % ATLAS.cols;
   const row = Math.floor(cell / ATLAS.cols);
   const u0 = col / ATLAS.cols;
   const u1 = (col + 1) / ATLAS.cols;
   const v1 = 1 - row / ATLAS.rows;
   const v0 = 1 - (row + 1) / ATLAS.rows;
   return [u0, v0, u1, v1];
}

export function cellPx(cell: number): { x: number; y: number; w: number; h: number } {
   const w = ATLAS.width / ATLAS.cols;
   const h = ATLAS.height / ATLAS.rows;
   return { x: (cell % ATLAS.cols) * w, y: Math.floor(cell / ATLAS.cols) * h, w, h };
}

/** A quad in the label geometry: centre, the text's right and up directions (unit), size (m), its cell. */
export interface LabelQuad {
   c: [number, number, number];
   right: [number, number, number];
   up: [number, number, number];
   w: number;
   h: number;
   cell: number;
}

/**
 * Every door's two number plates: one on the wall over the door (facing the corridor) and a mat on
 * the floor in front of it, read the right way up from the camera's yaw. Digits 0.4 m+ tall on the mats.
 */
export function labelQuads(level: HotelLevel, yaw: number): LabelQuad[] {
   const out: LabelQuad[] = [];
   // on the floor the text's up points away from the camera: yaw -pi/2 (camera at -x) = +x; yaw pi = +z
   const away: [number, number, number] = [-Math.sin(yaw), 0, -Math.cos(yaw)];
   const right: [number, number, number] = [-away[2], 0, away[0]];
   for (let i = 0; i < level.doors; i++) {
      const z = doorZ(i);
      out.push({ c: [HALF_W - 0.025, 2.42, z], right: [0, 0, 1], up: [0, 1, 0], w: 0.7, h: 0.35, cell: i });
      out.push({ c: [HALF_W - 0.95, 0.012, z], right, up: away, w: 1.1, h: 0.55, cell: i });
   }
   out.push({ c: [HALF_W - 0.025, 2.58, ELEVATOR_Z], right: [0, 0, 1], up: [0, 1, 0], w: 0.6, h: 0.3, cell: ELEVATOR_CELL });
   return out;
}
