// Bee Garden: one palette, the follow view and the decor spots. Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import { createRng } from "@/arcade3d/core/math";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type BeeLevel } from "./levels";

export const COLORS = {
   lawn: "#65a30d",
   lawnFar: "#4d7c0f",
   garden: "#74b81c",
   gardenStripe: "#6cae17",
   kerb: "#a8a29e",
   kerbTop: "#d6d3d1",
   soil: "#a16207",
   soilDark: "#78350f",
   nectar: "#fbbf24",
   nectarCore: "#fef08a",
   hive: "#f59e0b",
   hiveAccent: "#b45309",
   hiveSlot: "#451a03",
   hivePad: "#fde68a",
   flowerA: "#f43f5e",
   flowerB: "#8b5cf6",
   flowerC: "#38bdf8",
   flowerCenter: "#fef08a",
   stem: "#15803d",
   branch: "#78350f",
   branchBark: "#451a03",
   web: "#f8fafc",
   webRing: "#e2e8f0",
   leaf: "#22c55e",
   leafDark: "#15803d",
   planter: "#ca8a04",
   wateringCan: "#0284c7",
   mushroomCap: "#dc2626",
   mushroomStem: "#fef3c7",
   accent: "#fbbf24",
} as const;

export interface LevelLook {
   background: string;
   fogColor: string;
   fogNear: number;
   fogFar: number;
   lighting: "day" | "sunset";
   beeTint: string;
   skyTop: string;
   skyBottom: string;
}

export const LEVEL_LOOKS: Record<LevelId, LevelLook> = {
   1: { background: "#7dd3fc", fogColor: "#bae6fd", fogNear: 40, fogFar: 110, lighting: "day", beeTint: "#fbbf24", skyTop: "#38bdf8", skyBottom: "#e0f2fe" },
   2: { background: "#86efac", fogColor: "#d9f99d", fogNear: 40, fogFar: 110, lighting: "day", beeTint: "#93c5fd", skyTop: "#0ea5e9", skyBottom: "#ecfccb" },
   // the greenhouse: a closer, milky fog is the glass
   3: { background: "#bbf7d0", fogColor: "#dcfce7", fogNear: 30, fogFar: 85, lighting: "day", beeTint: "#f8fafc", skyTop: "#86efac", skyBottom: "#f0fdf4" },
   4: { background: "#166534", fogColor: "#fdba74", fogNear: 40, fogFar: 115, lighting: "sunset", beeTint: "#a3e635", skyTop: "#7c2d12", skyBottom: "#fdba74" },
   5: { background: "#14532d", fogColor: "#bbf7d0", fogNear: 36, fogFar: 100, lighting: "day", beeTint: "#fcd34d", skyTop: "#0284c7", skyBottom: "#dcfce7" },
};

// ---------- camera ----------

export const FOV = 45;
export const PITCH = (55 * Math.PI) / 180;
export const LOOK_AHEAD = 2;
export const DAMPING = 4.5;

/** The playable rectangle (the bee's centre stays inside it). */
export function gardenBox(level: BeeLevel): AABB {
   return { min: { x: -level.width / 2, y: 0, z: -level.depth / 2 }, max: { x: level.width / 2, y: 1.6, z: level.depth / 2 } };
}

/** Half size of the window the follow camera keeps on screen around its aim: 9 x 11 m (a phone in portrait fits its width; a wide screen shows more garden at the same distance). */
export function viewWindow(level: BeeLevel): { x: number; z: number } {
   return { x: Math.min(level.width / 2, 4.5), z: Math.min(level.depth / 2, 5.5) };
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

/** A window around the aim point (the camera follows the bee with it), clear of the HUD and the controls. */
export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      const w = viewWindow(LEVELS[id]);
      view = {
         area: { min: { x: -w.x, y: 0, z: -w.z }, max: { x: w.x, y: 1.6, z: w.z } },
         pitch: PITCH,
         yaws: [0],
         fov: FOV,
         margin: { top: 0.04, right: 0.02, bottom: 0.04, left: 0.02 },
         padding: 6,
         shift: true,
      };
      VIEWS.set(id, view);
   }
   return view;
}

/** Where the camera may aim: the garden shrunk by the window, so the view never leaves the garden by more than its border. */
export function aimBounds(level: BeeLevel): AABB {
   const w = viewWindow(level);
   const hx = Math.max(0, level.width / 2 - w.x + 1.5);
   const hz = Math.max(0, level.depth / 2 - w.z + 1.5);
   return { min: { x: -hx, y: 0, z: -hz }, max: { x: hx, y: 2, z: hz } };
}

// ---------- decor (outside the fly rectangle, never between the camera and the bee) ----------

/** The camera looks north (yaw 0) from the south: decor south of the garden stays below this height. */
export const SOUTH_DECOR_MAX_H = 0.7;

export interface DecorSpots {
   leaves: InstanceSpot[];
   mushrooms: InstanceSpot[];
   planters: InstanceSpot[];
   cans: InstanceSpot[];
   trees: InstanceSpot[];
}

/**
 * Seeded per level (the same garden every run). Every decor GLB is fitted to 1 m (its height; the
 * planter its length) in assets.ts, so a spot's `scale` is its size in metres.
 */
export function decorSpots(id: LevelId): DecorSpots {
   const level = LEVELS[id];
   const rng = createRng(4000 + id);
   const hx = level.width / 2;
   const hz = level.depth / 2;
   const out: DecorSpots = { leaves: [], mushrooms: [], planters: [], cans: [], trees: [] };
   const around = (count: number, inset: number, depth: number, side: "north" | "sides" | "all") => {
      const spots: { x: number; z: number }[] = [];
      for (let i = 0; i < count; i++) {
         const t = rng();
         const d = inset + rng() * depth;
         const pick = side === "north" ? 0 : side === "sides" ? 1 + (i % 2) : i % 4;
         if (pick === 0) spots.push({ x: (t * 2 - 1) * (hx + inset), z: -hz - d });
         else if (pick === 1) spots.push({ x: -hx - d, z: (t * 2 - 1) * hz });
         else if (pick === 2) spots.push({ x: hx + d, z: (t * 2 - 1) * hz });
         else spots.push({ x: (t * 2 - 1) * (hx + inset), z: hz + d });
      }
      return spots;
   };
   // big leaves on the east, west and north borders (tall), small ones on the south border
   for (const p of around(10 + id * 2, 0.9, 2.2, "all")) {
      const south = p.z > hz;
      out.leaves.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: south ? 0.45 + rng() * 0.2 : 0.9 + rng() * 0.6 });
   }
   for (const p of around(6 + id, 0.7, 2.5, "all")) out.mushrooms.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: 0.35 + rng() * 0.25 });
   // vegetable beds: planters along the sides (more on L2 and in the greenhouse)
   const planters = id === 2 || id === 3 ? 6 : 2;
   for (const p of around(planters, 1.4, 0.4, "sides")) out.planters.push({ ...p, y: 0, rotY: Math.PI / 2, scale: 1.6 });
   out.cans.push({ x: hx + 1.2, y: 0, z: hz - 1.0, rotY: -0.6, scale: 0.55 });
   out.cans.push({ x: -hx - 1.4, y: 0, z: -hz + 2.0, rotY: 2.2, scale: 0.5 });
   // L4-L5: a line of trees behind the north border and the sides (useQuality().decor trims them)
   if (id >= 4) for (const p of around(14, 3.0, 3.0, "north")) out.trees.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: 2.4 + rng() * 1.2 });
   if (id >= 4) for (const p of around(6, 3.5, 2.0, "sides")) if (p.z < hz - 3) out.trees.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: 2.2 + rng() * 1.0 });
   return out;
}

/** Soil bed under each flower: one instanced disc per flower. */
export function soilSpots(flowers: readonly { x: number; z: number }[]): InstanceSpot[] {
   return flowers.map((f) => ({ x: f.x, y: 0.012, z: f.z, scale: 1 }));
}
