// One palette, the follow view and the spots the Scene draws. Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import { createRng } from "@/arcade3d/core/math";
import { LEVELS, type MansionLevel } from "./levels";
import { ROOM_D, ROOM_W, WALL_H, type Prop, type PropKind, type Run } from "./rules";

export const COLORS = {
   wall: "#4b423c",
   wallTrim: "#a8a29e",
   wallBack: "#5b4a3f",
   floor: "#6b4a33",
   floorPlank: "#7a573c",
   floorSeam: "#3f2a1c",
   grounds: "#2a3b2a",
   gravel: "#6b6560",
   hedge: "#2f5130",
   hedgeTop: "#3f6b3f",
   lantern: "#fbbf24",
   moon: "#c7d2fe",
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

/**
 * Half size of the window kept on screen round the aim. Landscape: a room and a half. Portrait (a phone held
 * upright): a narrow window a little more than one room wide, so the camera comes in close and the detective
 * reads clearly (the wide window put a 390 x 844 camera 2.5x further back, into the fog).
 */
export function viewWindow(level: MansionLevel, portrait = false): { x: number; z: number } {
   const w = portrait ? { x: 3.6, z: 5.0 } : { x: 5.2, z: 4.4 };
   return { x: Math.min(w.x, (level.cols * ROOM_W) / 2 + 0.5), z: Math.min(w.z, (level.rows * ROOM_D) / 2 + 0.5) };
}

const VIEWS = new Map<string, FittedViewOptions>();

/** The close follow view: a window round the aim point, clear of the HUD, the key ring and the controls. */
export function viewFor(id: LevelId, portrait = false): FittedViewOptions {
   const key = `${id}${portrait ? "p" : "l"}`;
   let view = VIEWS.get(key);
   if (!view) {
      const w = viewWindow(LEVELS[id], portrait);
      view = {
         area: { min: { x: -w.x, y: 0, z: -w.z }, max: { x: w.x, y: 1.8, z: w.z } },
         pitch: PITCH,
         yaws: [0],
         margin: { top: 0.04, right: 0.03, bottom: 0.05, left: 0.03 },
         padding: 8,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(key, view);
   }
   return view;
}

/** Where the camera may aim: the building shrunk by the window (the view never drifts far off the house). */
export function aimBounds(level: MansionLevel, portrait = false): AABB {
   const win = viewWindow(level, portrait);
   const w = level.cols * ROOM_W;
   const d = level.rows * ROOM_D;
   const hx = Math.max(0, w / 2 - win.x + 1);
   const hz = Math.max(0, d / 2 - win.z + 1);
   return { min: { x: w / 2 - hx, y: 0.9, z: d / 2 - hz }, max: { x: w / 2 + hx, y: 0.9, z: d / 2 + hz } };
}

/** The environment's fog start (index.tsx: FOG_NEAR to the level's fogFar). */
export const FOG_NEAR = 10;

/**
 * Fog measured from the fitted camera: it starts past the aim (camera distance + half the window), so the
 * detective and the near half of the window are never fogged on any screen, and keeps the level's own depth
 * (fogFar - FOG_NEAR: L4 stays the closest). Never nearer than the environment's values.
 */
export function fogFor(level: MansionLevel, distance: number, portrait = false): { near: number; far: number } {
   const near = Math.max(FOG_NEAR, distance + viewWindow(level, portrait).z * 0.5);
   return { near, far: near + (level.fogFar - FOG_NEAR) };
}

// ---------- the grounds: never between the camera and the house ----------
// The camera looks north (-z) from the south (+z): south of the house only the low hedge stands; the trees
// line the north, west and east sides beyond the gravel apron.

/** Camera-side (south) decor stays below this height (m). */
export const SOUTH_DECOR_MAX_H = 0.7;
/** The hedge runs this far outside the walls (past the 1.5 m gravel apron). */
export const HEDGE_GAP = 2.2;
/** Trees stand at least this far outside the walls. */
export const TREE_GAP = 4;

export interface GroundsSpots {
   /** hedge blocks, a unit cube scaled per spot (sx / sy / sz) */
   hedges: InstanceSpot[];
   /** trees fitted to 1 m in assets.ts: the spot's scale is the height */
   trees: InstanceSpot[];
}

/** Seeded per level: a clipped hedge round the grounds and a ring of trees on three sides. */
export function groundsSpots(id: LevelId): GroundsSpots {
   const level = LEVELS[id];
   const rng = createRng(3900 + id);
   const w = level.cols * ROOM_W;
   const d = level.rows * ROOM_D;
   const hedges: InstanceSpot[] = [];
   const h = 0.6;
   const t = 0.5;
   const x0 = -HEDGE_GAP, x1 = w + HEDGE_GAP, z0 = -HEDGE_GAP, z1 = d + HEDGE_GAP;
   // four sides, the south (camera) side with a gap at the middle like a garden gate
   hedges.push({ x: (x0 + x1) / 2, y: h / 2, z: z0, sx: x1 - x0 + t, sy: h, sz: t });
   hedges.push({ x: x0, y: h / 2, z: (z0 + z1) / 2, sx: t, sy: h, sz: z1 - z0 + t });
   hedges.push({ x: x1, y: h / 2, z: (z0 + z1) / 2, sx: t, sy: h, sz: z1 - z0 + t });
   const gate = 1.6;
   hedges.push({ x: (x0 + w / 2 - gate) / 2, y: h / 2, z: z1, sx: w / 2 - gate - x0, sy: h, sz: t });
   hedges.push({ x: (w / 2 + gate + x1) / 2, y: h / 2, z: z1, sx: x1 - (w / 2 + gate), sy: h, sz: t });
   const trees: InstanceSpot[] = [];
   const add = (x: number, z: number) => trees.push({ x, y: 0, z, rotY: rng() * Math.PI * 2, scale: 3.2 + rng() * 1.6 });
   // north row and a second row behind it
   for (let x = x0 - 2; x <= x1 + 2; x += 3.2 + rng() * 1.2) add(x, -TREE_GAP - rng() * 2.5);
   for (let x = x0; x <= x1; x += 4.5 + rng() * 2) add(x, -TREE_GAP - 4 - rng() * 3);
   // west and east sides, down to the house's south wall (never on the camera side)
   for (let z = z0; z <= d; z += 3.4 + rng() * 1.4) {
      add(-TREE_GAP - rng() * 2.5, z);
      add(w + TREE_GAP + rng() * 2.5, z);
   }
   return { hedges, trees };
}

/** Is this wall the back (north, z <= 0) exterior wall? */
export const isBackWall = (b: AABB) => b.max.z <= 0 && b.min.z < 0;

/** Wall boxes as instance spots (unit cube scaled per spot), at their drawn height. */
/**
 * The camera's solids in priority order (core/camera takes VIEW_SOLIDS_MAX boxes): every wall first,
 * then the furniture largest footprint first, so if the list is ever too long the big pieces stay.
 * `solids` is walls followed by furniture (rules.ts), so the furniture is the part after the walls.
 */
export function cameraSolidList(walls: readonly AABB[], solids: readonly AABB[]): AABB[] {
   const area = (b: AABB) => (b.max.x - b.min.x) * (b.max.z - b.min.z);
   const furniture = solids.slice(walls.length).sort((a, b) => area(b) - area(a));
   return [...walls, ...furniture];
}

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
