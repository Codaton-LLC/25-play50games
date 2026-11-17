// Bee Garden: one palette, the follow view and the decor spots. Pure: no React, no three.js.
// Each level has its own scenery theme (flower / vegetable / greenhouse / forest / giant),
// ground colours, fog and set pieces so the five maps read differently (README "Levels").
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
   glass: "#e0f2fe",
   glassFrame: "#94a3b8",
   glassSill: "#64748b",
} as const;

/** The five named gardens: drives decor layout and set pieces (not scoring). */
export type GardenScenery = "flower" | "vegetable" | "greenhouse" | "forest" | "giant";

export interface LevelLook {
   background: string;
   fogColor: string;
   fogNear: number;
   fogFar: number;
   lighting: "day" | "sunset";
   beeTint: string;
   skyTop: string;
   skyBottom: string;
   /** mown lawn inside the kerb */
   garden: string;
   gardenStripe: string;
   /** far lawn under the fog */
   lawnFar: string;
   kerb: string;
   kerbTop: string;
   scenery: GardenScenery;
}

export const LEVEL_LOOKS: Record<LevelId, LevelLook> = {
   // Flower Garden: bright spring day (today's look)
   1: {
      background: "#7dd3fc", fogColor: "#bae6fd", fogNear: 40, fogFar: 110, lighting: "day", beeTint: "#fbbf24",
      skyTop: "#38bdf8", skyBottom: "#e0f2fe",
      garden: "#74b81c", gardenStripe: "#6cae17", lawnFar: "#4d7c0f", kerb: "#a8a29e", kerbTop: "#d6d3d1",
      scenery: "flower",
   },
   // Vegetable Garden: warm soil greens, vegetable beds
   2: {
      background: "#86efac", fogColor: "#d9f99d", fogNear: 40, fogFar: 110, lighting: "day", beeTint: "#93c5fd",
      skyTop: "#0ea5e9", skyBottom: "#ecfccb",
      garden: "#84cc16", gardenStripe: "#65a30d", lawnFar: "#3f6212", kerb: "#a16207", kerbTop: "#ca8a04",
      scenery: "vegetable",
   },
   // Greenhouse: milky close fog (= glass), pale indoor lawn
   3: {
      background: "#bbf7d0", fogColor: "#dcfce7", fogNear: 22, fogFar: 70, lighting: "day", beeTint: "#f8fafc",
      skyTop: "#86efac", skyBottom: "#f0fdf4",
      garden: "#a3e635", gardenStripe: "#84cc16", lawnFar: "#bbf7d0", kerb: "#94a3b8", kerbTop: "#e2e8f0",
      scenery: "greenhouse",
   },
   // Forest Flowers: sunset through the trees
   4: {
      background: "#166534", fogColor: "#fdba74", fogNear: 36, fogFar: 105, lighting: "sunset", beeTint: "#a3e635",
      skyTop: "#7c2d12", skyBottom: "#fdba74",
      garden: "#3f6212", gardenStripe: "#365314", lawnFar: "#14532d", kerb: "#57534e", kerbTop: "#78716c",
      scenery: "forest",
   },
   // Giant Garden: big day sky, soft fog, leaves lean in the breeze
   5: {
      background: "#14532d", fogColor: "#bbf7d0", fogNear: 36, fogFar: 100, lighting: "day", beeTint: "#fcd34d",
      skyTop: "#0284c7", skyBottom: "#dcfce7",
      garden: "#4d7c0f", gardenStripe: "#3f6212", lawnFar: "#166534", kerb: "#a8a29e", kerbTop: "#fde68a",
      scenery: "giant",
   },
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

// ---------- set pieces (visual only, outside the fly rectangle) ----------

/** Greenhouse glass shell: just outside the kerb. South wall is a low sill so the camera stays clear. */
export interface GreenhouseShell {
   halfX: number;
   halfZ: number;
   wallH: number;
   /** south sill height (camera side) */
   sillH: number;
}

/** Oversized bloom north of the garden (Giant Garden landmark). */
export interface GiantFlowerSpot {
   x: number;
   z: number;
   /** overall height in metres */
   height: number;
}

export interface SetPieces {
   greenhouse: GreenhouseShell | null;
   giantFlower: GiantFlowerSpot | null;
}

/** Per-level landmarks. Never inside the fly rectangle (tests). */
export function setPieces(id: LevelId): SetPieces {
   const level = LEVELS[id];
   const hx = level.width / 2;
   const hz = level.depth / 2;
   return {
      greenhouse: id === 3 ? { halfX: hx + 0.55, halfZ: hz + 0.55, wallH: 2.35, sillH: 0.42 } : null,
      // centred on the north border, well clear of the fly rectangle and of tree trunks
      giantFlower: id === 5 ? { x: 0, z: -hz - 5.2, height: 4.6 } : null,
   };
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
 * Level 1 keeps today's border scatter; 2–5 each get a theme layout matching the level name.
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

   if (id === 1) {
      // Flower Garden — today's layout (unchanged)
      for (const p of around(10 + id * 2, 0.9, 2.2, "all")) {
         const south = p.z > hz;
         out.leaves.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: south ? 0.45 + rng() * 0.2 : 0.9 + rng() * 0.6 });
      }
      for (const p of around(6 + id, 0.7, 2.5, "all")) out.mushrooms.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: 0.35 + rng() * 0.25 });
      for (const p of around(2, 1.4, 0.4, "sides")) out.planters.push({ ...p, y: 0, rotY: Math.PI / 2, scale: 1.6 });
      out.cans.push({ x: hx + 1.2, y: 0, z: hz - 1.0, rotY: -0.6, scale: 0.55 });
      out.cans.push({ x: -hx - 1.4, y: 0, z: -hz + 2.0, rotY: 2.2, scale: 0.5 });
      return out;
   }

   if (id === 2) {
      // Vegetable Garden — planter rows on every side, watering cans, sparse leaves
      for (const p of around(6, 1.0, 1.6, "all")) {
         const south = p.z > hz;
         out.leaves.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: south ? 0.4 + rng() * 0.15 : 0.7 + rng() * 0.35 });
      }
      for (const p of around(4, 0.8, 1.8, "north")) out.mushrooms.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: 0.3 + rng() * 0.2 });
      // vegetable beds: a tight row of planters along the east and west borders
      for (const p of around(10, 1.35, 0.35, "sides")) out.planters.push({ ...p, y: 0, rotY: Math.PI / 2, scale: 1.7 });
      for (const p of around(4, 1.5, 0.5, "north")) out.planters.push({ ...p, y: 0, rotY: 0, scale: 1.5 });
      out.cans.push({ x: hx + 1.3, y: 0, z: hz - 1.2, rotY: -0.5, scale: 0.55 });
      out.cans.push({ x: -hx - 1.5, y: 0, z: -hz + 1.5, rotY: 2.4, scale: 0.5 });
      out.cans.push({ x: hx + 1.6, y: 0, z: -hz + 3.0, rotY: 0.8, scale: 0.52 });
      out.cans.push({ x: -hx - 1.3, y: 0, z: hz - 2.5, rotY: -2.0, scale: 0.48 });
      return out;
   }

   if (id === 3) {
      // Greenhouse — planters under the glass walls, few outdoor leaves, no trees
      for (const p of around(5, 1.1, 1.2, "sides")) {
         out.leaves.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: 0.55 + rng() * 0.25 });
      }
      for (const p of around(5, 0.9, 1.4, "sides")) out.mushrooms.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: 0.32 + rng() * 0.18 });
      for (const p of around(8, 1.25, 0.3, "sides")) out.planters.push({ ...p, y: 0, rotY: Math.PI / 2, scale: 1.55 });
      out.cans.push({ x: hx + 1.15, y: 0, z: 0, rotY: -0.3, scale: 0.5 });
      out.cans.push({ x: -hx - 1.15, y: 0, z: 0, rotY: 2.8, scale: 0.5 });
      return out;
   }

   if (id === 4) {
      // Forest Flowers — dense tree line north + flanks, mushrooms under the canopy
      for (const p of around(10, 1.0, 2.0, "all")) {
         const south = p.z > hz;
         out.leaves.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: south ? 0.4 + rng() * 0.18 : 0.85 + rng() * 0.45 });
      }
      for (const p of around(12, 0.8, 2.8, "all")) {
         const south = p.z > hz;
         out.mushrooms.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: south ? 0.28 + rng() * 0.12 : 0.4 + rng() * 0.3 });
      }
      for (const p of around(2, 1.5, 0.4, "sides")) out.planters.push({ ...p, y: 0, rotY: Math.PI / 2, scale: 1.4 });
      out.cans.push({ x: hx + 1.4, y: 0, z: hz - 1.5, rotY: -0.7, scale: 0.5 });
      // dense forest belt north of the garden and along the flanks (never south)
      for (const p of around(22, 2.8, 4.0, "north")) out.trees.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: 2.6 + rng() * 1.4 });
      for (const p of around(12, 3.2, 2.5, "sides")) if (p.z < hz - 3) out.trees.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: 2.3 + rng() * 1.1 });
      return out;
   }

   // Giant Garden — tall leaves that lean in the breeze, a tree line, room for the giant bloom
   for (const p of around(16, 1.1, 2.6, "all")) {
      const south = p.z > hz;
      out.leaves.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: south ? 0.45 + rng() * 0.2 : 1.1 + rng() * 0.7 });
   }
   for (const p of around(8, 0.9, 2.2, "all")) out.mushrooms.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: 0.35 + rng() * 0.28 });
   for (const p of around(3, 1.5, 0.45, "sides")) out.planters.push({ ...p, y: 0, rotY: Math.PI / 2, scale: 1.6 });
   out.cans.push({ x: hx + 1.5, y: 0, z: hz - 1.8, rotY: -0.4, scale: 0.55 });
   out.cans.push({ x: -hx - 1.6, y: 0, z: -hz + 2.5, rotY: 2.1, scale: 0.5 });
   // tree line behind the giant flower (north) and the flanks; leave a gap at x≈0 for the bloom
   for (const p of around(16, 3.2, 3.5, "north")) {
      if (Math.abs(p.x) < 3.2) continue;
      out.trees.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: 2.5 + rng() * 1.3 });
   }
   for (const p of around(8, 3.5, 2.2, "sides")) if (p.z < hz - 3) out.trees.push({ ...p, y: 0, rotY: rng() * Math.PI * 2, scale: 2.4 + rng() * 1.0 });
   return out;
}

/** Soil bed under each flower: one instanced disc per flower. */
export function soilSpots(flowers: readonly { x: number; z: number }[]): InstanceSpot[] {
   return flowers.map((f) => ({ x: f.x, y: 0.012, z: f.z, scale: 1 }));
}
