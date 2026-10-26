// One palette, the follow camera and the lawn decor. Pure: no React, no three.js.
// Decor is built at unit size and scaled per spot (InstanceSpot), so one geometry serves every piece.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { createRng } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type DogLevel } from "./levels";
import { blanketOf, type Prop } from "./rules";

export const COLORS = {
   lawn: "#65a30d",
   parkGrass: "#4d7c0f",
   stripe: "#84cc16",
   path: "#d6d3d1",
   blanket: "#f59e0b",
   blanketEdge: "#fde68a",
   sand: "#f2d7a6",
   fence: "#f5f5f4",
   fenceCap: "#d6d3d1",
   dog: "#d6a15b",
   dogDark: "#92400e",
   dogNose: "#1c1917",
   owner: "#e7e5e4",
   ball: "#d9f99d",
   ballLine: "#f8fafc",
   stick: "#a16207",
   frisbee: "#f97316",
   frisbeeRim: "#fdba74",
   mower: "#dc2626",
   mowerDark: "#7f1d1d",
   fountain: "#cbd5e1",
   fountainWater: "#7dd3fc",
   bench: "#92400e",
   tree: "#166534",
   trunk: "#78350f",
   target: "#fbbf24",
} as const;

export const PITCH = (55 * Math.PI) / 180;
export const FOV = 46;
export const LOOK_AHEAD = 2;
export const DAMPING = 4;
/** Fog depth past its start; the start follows the fitted camera distance (fogFor). */
export const FOG_DEPTH = 45;
export const FOG_MIN_NEAR = 18;

export function lawnBox(level: DogLevel): AABB {
   return {
      min: { x: -level.width / 2 - 0.4, y: 0, z: -level.depth / 2 - 0.4 },
      max: { x: level.width / 2 + 0.4, y: 2.5, z: level.depth / 2 + 0.4 },
   };
}

export function lookAtFor(level: DogLevel): [number, number, number] {
   return [0, 0.4, blanketOf(level).z / 2];
}

/**
 * Half size of the window the follow camera keeps on screen around its aim. A phone in portrait gets
 * 5 x 7 m (the dog stays readable); landscape 8 x 7 m, which on L1 is most of the lawn.
 */
export function viewWindow(level: DogLevel, portrait: boolean): { x: number; z: number } {
   return { x: Math.min(level.width / 2, portrait ? 5 : 8), z: Math.min(level.depth / 2, 7) };
}

const VIEWS = new Map<string, FittedViewOptions>();

/** A window around the aim (the camera follows the dog with it), one yaw, clear of the HUD and the controls. */
export function viewFor(id: LevelId, portrait = false): FittedViewOptions {
   const key = `${id}:${portrait}`;
   let view = VIEWS.get(key);
   if (!view) {
      const w = viewWindow(LEVELS[id], portrait);
      view = {
         area: { min: { x: -w.x, y: 0, z: -w.z }, max: { x: w.x, y: 1.2, z: w.z } },
         pitch: PITCH,
         yaws: [0],
         margin: { top: 0.03, right: 0.02, bottom: 0.05, left: 0.02 },
         padding: 8,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(key, view);
   }
   return view;
}

/** Where the aim may go: the lawn less the window, plus a little, so the view never runs far past the fence. */
export function aimBounds(level: DogLevel, portrait: boolean): AABB {
   const w = viewWindow(level, portrait);
   const hx = Math.max(0, level.width / 2 - w.x + 1.5);
   const hz = Math.max(0, level.depth / 2 - w.z + 1.5);
   return { min: { x: -hx, y: 0, z: -hz }, max: { x: hx, y: 2, z: hz } };
}

/** The fog starts half a window past the aim at the fitted distance, never nearer than FOG_MIN_NEAR. */
export function fogFor(level: DogLevel, distance: number, portrait: boolean): { near: number; far: number } {
   const near = Math.max(FOG_MIN_NEAR, distance + viewWindow(level, portrait).z * 0.5);
   return { near, far: near + FOG_DEPTH };
}

// ---------- decor: outside the fence, never between the camera and the lawn ----------
// The camera looks north (-z) from the south: south of the fence only low things stand.

export const SOUTH_DECOR_MAX_H = 0.7;

export interface DecorSpots {
   trees: InstanceSpot[];
   bushes: InstanceSpot[];
   tents: InstanceSpot[];
   tunnels: InstanceSpot[];
   hurdles: InstanceSpot[];
}

/** Seeded per level; every decor GLB is fitted to 1 m, so a spot's `scale` is its size. */
export function decorSpots(id: LevelId): DecorSpots {
   const level = LEVELS[id];
   const rng = createRng(7100 + id);
   const hw = level.width / 2;
   const hd = level.depth / 2;
   const out: DecorSpots = { trees: [], bushes: [], tents: [], tunnels: [], hurdles: [] };
   // a tree line behind the north fence and down both sides (not the south: the camera side)
   for (let x = -hw - 4; x <= hw + 4; x += 4.5) out.trees.push({ x: x + (rng() - 0.5), y: 0, z: -hd - 3 - rng() * 2, rotY: rng() * 6.28, scale: 3.2 + rng() * 1.4 });
   for (let z = -hd; z <= hd - 4; z += 5) {
      out.trees.push({ x: -hw - 3.2 - rng() * 1.5, y: 0, z: z + rng(), rotY: rng() * 6.28, scale: 3 + rng() * 1.2 });
      out.trees.push({ x: hw + 3.2 + rng() * 1.5, y: 0, z: z + rng(), rotY: rng() * 6.28, scale: 3 + rng() * 1.2 });
   }
   // low bushes along the outside of the fence, the south row included (they stay under 0.7 m)
   for (let x = -hw + 1; x <= hw - 1; x += 3) out.bushes.push({ x: x + rng() * 0.6, y: 0, z: hd + 1.4, rotY: rng() * 6.28, scale: 1.1 + rng() * 0.3 });
   for (let z = -hd + 2; z <= hd - 2; z += 4) {
      out.bushes.push({ x: -hw - 1.3, y: 0, z, rotY: rng() * 6.28, scale: 1.4 + rng() * 0.4 });
      out.bushes.push({ x: hw + 1.3, y: 0, z, rotY: rng() * 6.28, scale: 1.4 + rng() * 0.4 });
   }
   if (id === 5) {
      // the festival: striped tents and an agility course behind the north fence
      for (const x of [-hw * 0.6, 0, hw * 0.6]) out.tents.push({ x, y: 0, z: -hd - 2.2, rotY: 0, scale: 2.6 });
      out.tunnels.push({ x: -hw * 0.3, y: 0, z: -hd - 5.5, rotY: Math.PI / 2, scale: 2.4 });
      out.hurdles.push({ x: hw * 0.3, y: 0, z: -hd - 5.5, rotY: 0, scale: 1.4 });
      out.hurdles.push({ x: hw * 0.3 + 2.2, y: 0, z: -hd - 5.5, rotY: 0, scale: 1.4 });
   }
   return out;
}

/** The picket fence: one instanced picket every metre and a half around the lawn. */
export function fenceSpots(level: DogLevel): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   const h = 1.1;
   const hw = level.width / 2;
   const hd = level.depth / 2;
   const step = 1.2;
   const add = (x: number, z: number) => spots.push({ x, y: h / 2, z, sx: 0.08, sy: h, sz: 0.08 });
   for (let x = -hw; x <= hw + 1e-9; x += step) {
      add(x, -hd);
      add(x, hd);
   }
   for (let z = -hd; z <= hd + 1e-9; z += step) {
      add(-hw, z);
      add(hw, z);
   }
   return spots;
}

/** Two rails between the pickets on every side (unit boxes scaled per spot). */
export function railSpots(level: DogLevel): InstanceSpot[] {
   const hw = level.width / 2;
   const hd = level.depth / 2;
   const spots: InstanceSpot[] = [];
   for (const y of [0.45, 0.9]) {
      spots.push({ x: 0, y, z: -hd, sx: level.width, sy: 0.06, sz: 0.05 });
      spots.push({ x: 0, y, z: hd, sx: level.width, sy: 0.06, sz: 0.05 });
      spots.push({ x: -hw, y, z: 0, sx: 0.05, sy: 0.06, sz: level.depth });
      spots.push({ x: hw, y, z: 0, sx: 0.05, sy: 0.06, sz: level.depth });
   }
   return spots;
}

/** Mowing stripes: thin lighter strips along z, one per two metres. */
export function stripeSpots(level: DogLevel): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (let x = -level.width / 2 + 1; x < level.width / 2; x += 2) {
      spots.push({ x, y: 0.004, z: 0, sx: 0.9, sy: 0.008, sz: level.depth });
   }
   return spots;
}

/** The sand strip along the south edge on the beach park (L4). */
export function sandSpots(level: DogLevel): InstanceSpot[] {
   return [{ x: 0, y: 0.006, z: level.depth / 2 - 0.9, sx: level.width, sy: 0.012, sz: 1.8 }];
}

/** A flat blanket disc at the south centre, drawn as a unit cylinder scaled to the pad. */
export function blanketSpot(level: DogLevel): InstanceSpot {
   const b = blanketOf(level);
   return { x: b.x, y: 0.01, z: b.z, sx: 1.5 * 2, sy: 0.02, sz: 1.5 * 2 };
}

export function propSpots(props: readonly Prop[]): InstanceSpot[] {
   return props.map((p) => ({ x: p.x, y: 0, z: p.z, sx: p.r * 2, sy: 0.6, sz: p.r * 2 }));
}
