// Robot Collector look (2026-10-25).
// Pure data & helpers: single COLORS palette, level themes, fog, surroundings decor layout,
// and camera occlusion verification math.
// No React, no Three.js scene creation: pure and testable.
import type { LightingPreset } from "@/arcade3d/core/types";
import type { LevelId } from "@/arcade3d/types";

// ---------- ONE unified COLORS palette ----------

export const COLORS = {
   // Atmosphere & sky dome
   skyTop: "#070d1e",
   skyBottom: "#131f37",
   fog: "#0b1220",

   // Floor & Ground (sci-fi recycling yard / robotics lab)
   floor: "#1a2234",
   floorTileAlt: "#222c42",
   floorLine: "#334155",
   lightStrip: "#06b6d4",
   lightStripGlow: "#22d3ee",
   floorTrim: "#f59e0b",
   outerFloor: "#0c101a",
   outerFloorGrid: "#161e2e",
   plinth: "#0f1422",
   plinthBevel: "#1e293b",

   // Start charging pad
   startPad: "#083344",
   startPadRing: "#06b6d4",
   startPadGlow: "rgba(6, 182, 212, 0.25)",

   // Walls & perimeter barrier
   wall: "#334155",
   wallBevel: "#475569",
   wallPanel: "#1e293b",
   wallTrim: "#f59e0b",
   wallGlow: "#0ea5e9",

   // Props: Crates (deliberate sci-fi cargo container)
   crate: "#d97706",
   crateFrame: "#b45309",
   crateMetal: "#94a3b8",
   crateGlow: "#fde68a",

   // Props: Barrels (coolant / energy drums)
   barrel: "#2563eb",
   barrelDark: "#1d4ed8",
   barrelRing: "#60a5fa",
   barrelLid: "#93c5fd",
   barrelGlow: "#38bdf8",

   // Robot (character & stand-in)
   robot: "#06b6d4",
   robotHead: "#f8fafc",
   robotDark: "#0f172a",
   robotEye: "#38bdf8",
   robotTip: "#f59e0b",
   robotChassis: "#334155",
   robotAccent: "#0d9488",
   lamp: "#e0f2fe",

   // Battery (energy cell)
   battery: "#22c55e",
   batteryGlow: "#4ade80",
   batteryDark: "#15803d",
   batteryBand: "#f0fdf4",
   batteryCap: "#e2e8f0",
   batteryTip: "#fbbf24",

   // Hazards (oil patches and conveyor belts)
   oil: "#09090b",
   oilGlow: "#7c3aed",
   belt: "#18181b",
   beltArrow: "#f59e0b",
   beltGuide: "#27272a",

   // Surroundings / Decor outside the play area
   decorWall: "#1e293b",
   decorWallAccent: "#334155",
   pipe: "#64748b",
   pipeJoint: "#94a3b8",
   screenFrame: "#0f172a",
   screenCyan: "#0284c7",
   screenGreen: "#16a34a",
   screenAmber: "#d97706",
   chargingBase: "#1e293b",
   chargingAccent: "#06b6d4",
   duct: "#273248",
   ductAccent: "#38bdf8",
} as const;

// ---------- Level atmosphere looks ----------

export interface LevelLook {
   lighting: LightingPreset;
   skyTop: string;
   skyBottom: string;
   fog: string;
   ground?: string;
   lamp?: number;
}

export const LEVEL_LOOKS: Record<LevelId, LevelLook> = {
   1: { lighting: "indoor", skyTop: "#070d1e", skyBottom: "#131f37", fog: "#0b1220" },
   2: { lighting: "day", skyTop: "#0f233f", skyBottom: "#1e3a5f", fog: "#13233a" },
   3: { lighting: "sunset", skyTop: "#1f102e", skyBottom: "#3b1747", fog: "#1f1530" },
   4: { lighting: "night", skyTop: "#03050a", skyBottom: "#0a0f1d", fog: "#05070d", lamp: 1.8 },
   5: { lighting: "sunset", skyTop: "#240a10", skyBottom: "#45121b", fog: "#2a0f14" },
};

/** Linear fog: starts past the perimeter wall so the lab floor remains crisp and high-contrast. */
export const FOG = { near: 35, far: 80 } as const;

// ---------- Play Area & Bounds ----------

export const ARENA_BOUNDS = {
   minX: -12,
   maxX: 12,
   minZ: -8,
   maxZ: 8,
   minY: 0,
   maxY: 1.8,
} as const;

export const WALL_THICKNESS = 0.4;
export const WALL_HEIGHT = 0.9;

/** The outer perimeter boundary (arena + wall thickness). */
export const PLAY_AREA_OUTER = {
   minX: ARENA_BOUNDS.minX - WALL_THICKNESS,
   maxX: ARENA_BOUNDS.maxX + WALL_THICKNESS,
   minZ: ARENA_BOUNDS.minZ - WALL_THICKNESS,
   maxZ: ARENA_BOUNDS.maxZ + WALL_THICKNESS,
} as const;

/** Checks if a point (x, z) lies inside the active playfield or perimeter wall. */
export function isInsidePlayArea(x: number, z: number): boolean {
   return (
      x >= PLAY_AREA_OUTER.minX &&
      x <= PLAY_AREA_OUTER.maxX &&
      z >= PLAY_AREA_OUTER.minZ &&
      z <= PLAY_AREA_OUTER.maxZ
   );
}

// ---------- Decor spots outside the play area ----------

export interface DecorSpot {
   x: number;
   y: number;
   z: number;
   rotY?: number;
   sx?: number;
   sy?: number;
   sz?: number;
}

export interface BoundingBox {
   minX: number;
   maxX: number;
   minY: number;
   maxY: number;
   minZ: number;
   maxZ: number;
}

// 1. Lab Walls: along the north background (z = -12.2) and west background (x = -15.6)
export const LAB_WALL_SPOTS: readonly DecorSpot[] = [
   // North wall panels (y = 2.2, height 4.4, width 3.8, depth 0.8)
   { x: -15.2, y: 2.2, z: -12.2, sx: 3.8, sy: 4.4, sz: 0.8 },
   { x: -11.4, y: 2.2, z: -12.2, sx: 3.8, sy: 4.4, sz: 0.8 },
   { x: -7.6, y: 2.2, z: -12.2, sx: 3.8, sy: 4.4, sz: 0.8 },
   { x: -3.8, y: 2.2, z: -12.2, sx: 3.8, sy: 4.4, sz: 0.8 },
   { x: 0, y: 2.2, z: -12.2, sx: 3.8, sy: 4.4, sz: 0.8 },
   { x: 3.8, y: 2.2, z: -12.2, sx: 3.8, sy: 4.4, sz: 0.8 },
   { x: 7.6, y: 2.2, z: -12.2, sx: 3.8, sy: 4.4, sz: 0.8 },
   { x: 11.4, y: 2.2, z: -12.2, sx: 3.8, sy: 4.4, sz: 0.8 },
   { x: 15.2, y: 2.2, z: -12.2, sx: 3.8, sy: 4.4, sz: 0.8 },
   // West wall panels (y = 2.2, height 4.4, width 0.8, depth 3.8)
   { x: -15.6, y: 2.2, z: -8.5, sx: 0.8, sy: 4.4, sz: 3.8 },
   { x: -15.6, y: 2.2, z: -4.7, sx: 0.8, sy: 4.4, sz: 3.8 },
   { x: -15.6, y: 2.2, z: -0.9, sx: 0.8, sy: 4.4, sz: 3.8 },
   { x: -15.6, y: 2.2, z: 2.9, sx: 0.8, sy: 4.4, sz: 3.8 },
   { x: -15.6, y: 2.2, z: 6.7, sx: 0.8, sy: 4.4, sz: 3.8 },
];

// 2. Wall Screens: glowing diagnostic monitors on the north lab wall
export const WALL_SCREEN_SPOTS: readonly DecorSpot[] = [
   { x: -11.4, y: 2.5, z: -11.75, sx: 1.8, sy: 1.1, sz: 0.15 },
   { x: -3.8, y: 2.5, z: -11.75, sx: 1.8, sy: 1.1, sz: 0.15 },
   { x: 3.8, y: 2.5, z: -11.75, sx: 1.8, sy: 1.1, sz: 0.15 },
   { x: 11.4, y: 2.5, z: -11.75, sx: 1.8, sy: 1.1, sz: 0.15 },
];

// 3. Overhead Conduit Pipes: horizontal industrial pipes running above the north lab wall
export const CONDUIT_PIPE_SPOTS: readonly DecorSpot[] = [
   { x: -11.4, y: 3.8, z: -11.6, rotY: Math.PI / 2, sx: 0.22, sy: 7.6, sz: 0.22 },
   { x: -3.8, y: 3.8, z: -11.6, rotY: Math.PI / 2, sx: 0.22, sy: 7.6, sz: 0.22 },
   { x: 3.8, y: 3.8, z: -11.6, rotY: Math.PI / 2, sx: 0.22, sy: 7.6, sz: 0.22 },
   { x: 11.4, y: 3.8, z: -11.6, rotY: Math.PI / 2, sx: 0.22, sy: 7.6, sz: 0.22 },
];

// 4. Idle Parked Robots: docked service droids on charging cradles outside the fence
export const IDLE_ROBOT_SPOTS: readonly DecorSpot[] = [
   { x: -13.8, y: 0.45, z: -5.5, rotY: Math.PI / 4, sx: 0.8, sy: 0.9, sz: 0.8 },
   { x: -13.8, y: 0.45, z: 4.5, rotY: -Math.PI / 6, sx: 0.8, sy: 0.9, sz: 0.8 },
   { x: 13.8, y: 0.45, z: -6.5, rotY: -Math.PI / 3, sx: 0.8, sy: 0.9, sz: 0.8 },
];

// 5. Charging Stations: wall-mounted power terminals
export const CHARGING_STATION_SPOTS: readonly DecorSpot[] = [
   { x: -14.8, y: 0.7, z: -2.0, rotY: Math.PI / 2, sx: 0.6, sy: 1.4, sz: 0.9 },
   { x: -14.8, y: 0.7, z: 1.5, rotY: Math.PI / 2, sx: 0.6, sy: 1.4, sz: 0.9 },
   { x: 14.8, y: 0.7, z: -3.5, rotY: -Math.PI / 2, sx: 0.6, sy: 1.4, sz: 0.9 },
];

// 6. Stacked Cargo Crates outside the play area
export const DECOR_CRATE_SPOTS: readonly DecorSpot[] = [
   // Northeast supply yard
   { x: 14.0, y: 0.6, z: -5.0, rotY: 0.1, sx: 1.2, sy: 1.2, sz: 1.2 },
   { x: 15.2, y: 0.6, z: -5.0, rotY: -0.05, sx: 1.2, sy: 1.2, sz: 1.2 },
   { x: 14.6, y: 1.7, z: -5.0, rotY: 0.25, sx: 1.05, sy: 1.05, sz: 1.05 },
   // Northwest supply yard
   { x: -14.0, y: 0.6, z: -9.5, rotY: -0.15, sx: 1.2, sy: 1.2, sz: 1.2 },
   { x: -15.2, y: 0.6, z: -9.5, rotY: 0.2, sx: 1.2, sy: 1.2, sz: 1.2 },
   { x: -14.6, y: 1.7, z: -9.5, rotY: 0.05, sx: 1.05, sy: 1.05, sz: 1.05 },
   // Far north yard
   { x: 6.0, y: 0.6, z: -10.5, rotY: 0.1, sx: 1.2, sy: 1.2, sz: 1.2 },
   { x: 7.2, y: 0.6, z: -10.5, rotY: -0.2, sx: 1.2, sy: 1.2, sz: 1.2 },
   { x: 6.6, y: 1.7, z: -10.5, rotY: 0.15, sx: 1.05, sy: 1.05, sz: 1.05 },
   // Southeast staging pallet
   { x: 14.2, y: 0.6, z: 4.5, rotY: 0.15, sx: 1.2, sy: 1.2, sz: 1.2 },
   { x: 15.4, y: 0.6, z: 4.5, rotY: -0.1, sx: 1.2, sy: 1.2, sz: 1.2 },
];

// 7. Ground Cable Ducts: low cable trays flush with the outer ground
export const CABLE_DUCT_SPOTS: readonly DecorSpot[] = [
   { x: 0, y: 0.03, z: -9.2, sx: 26, sy: 0.06, sz: 0.35 },
   { x: -13.0, y: 0.03, z: 0, sx: 0.35, sy: 0.06, sz: 18 },
   { x: 13.0, y: 0.03, z: 0, sx: 0.35, sy: 0.06, sz: 18 },
   { x: 0, y: 0.03, z: 9.2, sx: 26, sy: 0.06, sz: 0.35 },
];

/** All decor spots combined for validation and occlusion checks. */
export function allDecorSpots(): Array<{ name: string; spot: DecorSpot; box: BoundingBox }> {
   const list: Array<{ name: string; spot: DecorSpot; box: BoundingBox }> = [];
   const add = (name: string, spots: readonly DecorSpot[], defaultSize: [number, number, number]) => {
      for (let i = 0; i < spots.length; i++) {
         const s = spots[i];
         const sx = s.sx ?? defaultSize[0];
         const sy = s.sy ?? defaultSize[1];
         const sz = s.sz ?? defaultSize[2];
         list.push({
            name: `${name}-${i}`,
            spot: s,
            box: {
               minX: s.x - sx / 2,
               maxX: s.x + sx / 2,
               minY: s.y - sy / 2,
               maxY: s.y + sy / 2,
               minZ: s.z - sz / 2,
               maxZ: s.z + sz / 2,
            },
         });
      }
   };
   add("labWall", LAB_WALL_SPOTS, [3.8, 4.4, 0.8]);
   add("wallScreen", WALL_SCREEN_SPOTS, [1.8, 1.1, 0.15]);
   add("conduitPipe", CONDUIT_PIPE_SPOTS, [0.22, 7.6, 0.22]);
   add("idleRobot", IDLE_ROBOT_SPOTS, [0.8, 0.9, 0.8]);
   add("chargingStation", CHARGING_STATION_SPOTS, [0.6, 1.4, 0.9]);
   add("decorCrate", DECOR_CRATE_SPOTS, [1.2, 1.2, 1.2]);
   add("cableDuct", CABLE_DUCT_SPOTS, [1, 0.06, 1]);
   return list;
}

// ---------- WCAG Contrast Helper ----------

function toLinear(c: number): number {
   const s = c / 255;
   return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(hexA: string, hexB: string): number {
   const lum = (hex: string) => {
      const n = Number.parseInt(hex.replace("#", ""), 16);
      const r = toLinear((n >> 16) & 255);
      const g = toLinear((n >> 8) & 255);
      const b = toLinear(n & 255);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
   };
   const l1 = Math.max(lum(hexA), lum(hexB));
   const l2 = Math.min(lum(hexA), lum(hexB));
   return (l1 + 0.05) / (l2 + 0.05);
}

// ---------- Occlusion Testing Helper ----------

export interface Point3D {
   x: number;
   y: number;
   z: number;
}

/**
 * Tests whether the line segment from camera to target point intersects an axis-aligned bounding box.
 * Returns true if the segment hits the box (i.e. occlusion occurs).
 */
export function segmentIntersectsBox(start: Point3D, end: Point3D, box: BoundingBox): boolean {
   const dx = end.x - start.x;
   const dy = end.y - start.y;
   const dz = end.z - start.z;

   let tMin = 0;
   let tMax = 1;

   // X axis
   if (Math.abs(dx) < 1e-9) {
      if (start.x < box.minX || start.x > box.maxX) return false;
   } else {
      let t1 = (box.minX - start.x) / dx;
      let t2 = (box.maxX - start.x) / dx;
      if (t1 > t2) {
         const tmp = t1;
         t1 = t2;
         t2 = tmp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return false;
   }

   // Y axis
   if (Math.abs(dy) < 1e-9) {
      if (start.y < box.minY || start.y > box.maxY) return false;
   } else {
      let t1 = (box.minY - start.y) / dy;
      let t2 = (box.maxY - start.y) / dy;
      if (t1 > t2) {
         const tmp = t1;
         t1 = t2;
         t2 = tmp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return false;
   }

   // Z axis
   if (Math.abs(dz) < 1e-9) {
      if (start.z < box.minZ || start.z > box.maxZ) return false;
   } else {
      let t1 = (box.minZ - start.z) / dz;
      let t2 = (box.maxZ - start.z) / dz;
      if (t1 > t2) {
         const tmp = t1;
         t1 = t2;
         t2 = tmp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return false;
   }

   return true;
}
