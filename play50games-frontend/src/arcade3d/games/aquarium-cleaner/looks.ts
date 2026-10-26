// One palette, the follow camera, and the cosmetic spots. Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { createRng } from "@/arcade3d/core/math";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type AquariumLevel } from "./levels";
import { BASKET_R, COLUMN_R, HATCH_R, basketOf, columnOf, entryOf, hatchOf, tankHalf, type Run } from "./rules";

export const COLORS = {
   sand: "#f5deb3",
   sandDark: "#d9b98a",
   sandLine: "#e8cfa0",
   water: "#0f766e",
   glass: "#99f6e4",
   glassPane: "#5eead4",
   frame: "#99f6e4",
   algae: "#4d7c0f",
   algaeDark: "#365314",
   accent: "#2dd4bf",
   hatchOpen: "#4ade80",
   hatchShut: "#f87171",
   hatchPlate: "#334155",
   column: "#bae6fd",
   ring: "#7dd3fc",
   bubble: "#e0f2fe",
   gaugeOn: "#4ade80",
   gaugeOff: "#f59e0b",
   suit: "#f59e0b",
   fallbackRock: "#78716c",
   fallbackRockTop: "#a8a29e",
   fallbackCastle: "#a8a29e",
   fallbackCastleRoof: "#f472b6",
   fallbackFilter: "#94a3b8",
   fallbackFilterTop: "#475569",
   fallbackBottle: "#38bdf8",
   fallbackBottleCap: "#f8fafc",
   fallbackBasket: "#22c55e",
   fallbackFish: "#fb923c",
   fallbackShark: "#64748b",
   fallbackShark2: "#e2e8f0",
   fallbackCoral: "#f472b6",
   fallbackCoral2: "#fb7185",
   tank: "#facc15",
   tankBand: "#334155",
} as const;

export const PITCH = (50 * Math.PI) / 180;
export const YAWS = [0] as const;
export const FOV = 48;
export const FOLLOW = 1;
export const LOOK_AHEAD = 0.6;
/** What must stay on screen around the diver (m): a bigger tank scrolls under the camera. */
export const WINDOW = { w: 8, d: 11 } as const;
export const DAMPING = 4;
/** Glass height and the frame's thickness. */
export const GLASS_H = 3.2;
export const FRAME_T = 0.1;

export function fog(level: AquariumLevel): [string, number, number] {
   return [level.background, 42, 120];
}

export function tankBox(level: AquariumLevel): AABB {
   const { hx, hz } = tankHalf(level);
   return { min: { x: -hx, y: 0, z: -hz }, max: { x: hx, y: 2.4, z: hz } };
}

/** The window around the camera aim that the fit keeps on screen. */
export function windowBox(level: AquariumLevel): AABB {
   const w = Math.min(level.width, WINDOW.w) / 2;
   const d = Math.min(level.depth, WINDOW.d) / 2;
   return { min: { x: -w, y: 0, z: -d }, max: { x: w, y: 2.4, z: d } };
}

/** Where the camera aim may go: the tank shrunk by half the window, so the glass never leaves the frame. */
export function aimBounds(level: AquariumLevel): AABB {
   const { hx, hz } = tankHalf(level);
   const w = Math.min(level.width, WINDOW.w) / 2;
   const d = Math.min(level.depth, WINDOW.d) / 2;
   return { min: { x: -(hx - w), y: 0, z: -(hz - d) }, max: { x: hx - w, y: 2.4, z: hz - d } };
}

export function lookAtFor(level: AquariumLevel): [number, number, number] {
   return [0, 0.6, 0];
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

/** Whole tank in frame, biased toward the diver. Portrait picks the other yaw. */
export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      const level = LEVELS[id];
      const area = windowBox(level);
      view = {
         area,
         pitch: PITCH,
         yaws: YAWS,
         focus: [{ x: 0, y: 0.6, z: 0 }],
         margin: { top: 0.03, right: 0.02, bottom: 0.05, left: 0.02 },
         padding: 8,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(id, view);
   }
   return view;
}

/** The sand texture covers this many metres before it repeats. */
export const SAND_TILE_M = 4;

/** The aquarium hall round the tank: how far its floor reaches, its tile size, the plinth and the back wall. */
export const HALL = { reach: 150, tile: 2, plinthH: 0.45, frontH: 0.15, plinthW: 0.6, wallGap: 9, wallH: 5 } as const;

/** Per-level tint multiplied into the sand texture (night and the tunnel read darker and cooler). */
export function sandTint(level: AquariumLevel): string {
   return level.lighting === "night" ? "#9fb6c8" : level.lighting === "indoor" ? "#d9e6de" : "#ffffff";
}

/** The faint colour under the water surface. */
export function waterTint(level: AquariumLevel): string {
   return level.lighting === "night" ? "#1e3a8a" : "#0891b2";
}

/**
 * The hall pieces round the tank, UNIT boxes scaled by the spot: a plinth under the back and side glass,
 * a lower lip along the open front (so it never hides the diver's feet from the camera), and a dim back
 * wall well behind the tank (the camera looks north, so it is only ever a backdrop).
 */
export function hallSpots(level: AquariumLevel): InstanceSpot[] {
   const { hx, hz } = tankHalf(level);
   const w = HALL.plinthW;
   const h = HALL.plinthH;
   return [
      { x: 0, y: h / 2, z: -hz - w / 2, sx: level.width + 2 * w, sy: h, sz: w },
      { x: -hx - w / 2, y: h / 2, z: 0, sx: w, sy: h, sz: level.depth },
      { x: hx + w / 2, y: h / 2, z: 0, sx: w, sy: h, sz: level.depth },
      { x: 0, y: HALL.frontH / 2, z: hz + w / 2, sx: level.width + 2 * w, sy: HALL.frontH, sz: w },
      { x: 0, y: HALL.wallH / 2, z: -hz - HALL.wallGap, sx: level.width + 2 * HALL.reach, sy: HALL.wallH, sz: 0.5 },
   ];
}

/** The glass frame: top rail and corner posts of the three glass sides, thin emissive boxes. UNIT size. */
export function frameSpots(level: AquariumLevel): InstanceSpot[] {
   const { hx, hz } = tankHalf(level);
   const t = FRAME_T;
   const h = GLASS_H;
   return [
      { x: 0, y: h, z: -hz, sx: level.width + t, sy: t, sz: t },
      { x: -hx, y: h, z: 0, sx: t, sy: t, sz: level.depth + t },
      { x: hx, y: h, z: 0, sx: t, sy: t, sz: level.depth + t },
      { x: -hx, y: h / 2, z: -hz, sx: t, sy: h, sz: t },
      { x: hx, y: h / 2, z: -hz, sx: t, sy: h, sz: t },
      { x: -hx, y: h / 2, z: hz, sx: t, sy: h, sz: t },
      { x: hx, y: h / 2, z: hz, sx: t, sy: h, sz: t },
      { x: 0, y: t / 2, z: -hz, sx: level.width + t, sy: t, sz: t },
      { x: -hx, y: t / 2, z: 0, sx: t, sy: t, sz: level.depth + t },
      { x: hx, y: t / 2, z: 0, sx: t, sy: t, sz: level.depth + t },
   ];
}

/**
 * Coral on the sand against the back glass and the corners (never in the middle: the camera looks
 * from the front, so a low coral behind the diver cannot hide him). Drawn at the asset's fit,
 * `scale` is the only size here. Cosmetic: never in rules.
 */
export function coralSpots(run: Run, count: number): InstanceSpot[] {
   const rng = createRng((run.seed ^ 0x5eac0) >>> 0);
   const spots: InstanceSpot[] = [];
   const { hx, hz } = run;
   const avoid = [entryOf(run.level), basketOf(run.level), columnOf(run.level), hatchOf(run.level)];
   for (let tries = 0; tries < count * 30 && spots.length < count; tries++) {
      const side = rng();
      const back = side < 0.6;
      const x = back ? -hx + 1 + (run.level.width - 2) * rng() : (side < 0.8 ? -1 : 1) * (hx - 0.9);
      const z = back ? -hz + 0.7 : -hz + 1 + (run.level.depth * 0.55) * rng();
      if (run.algae.some((a) => Math.hypot(a.x - x, a.z - z) < 2.2)) continue;
      if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < 3)) continue;
      if (run.solids.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 0.9)) continue;
      if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 1.6)) continue;
      spots.push({ x, y: 0, z, rotY: rng() * Math.PI * 2, scale: 0.8 + rng() * 0.5 });
   }
   return spots;
}

/** Where a fish school circles: a band at the back and the sides, high above the sand. */
export interface School {
   cx: number;
   cz: number;
   rx: number;
   rz: number;
   y: number;
   speed: number;
   phase: number;
   count: number;
}

export function schoolsOf(run: Run): School[] {
   const rng = createRng((run.seed ^ 0xf15b) >>> 0);
   const { hx, hz } = run;
   const out: School[] = [];
   const n = run.level.width > 22 ? 3 : 2;
   for (let i = 0; i < n; i++) {
      const left = i % 2 === 0;
      out.push({
         cx: (left ? -1 : 1) * (hx * (0.35 + rng() * 0.4)),
         cz: -hz + 2 + rng() * 1.2,
         rx: 2.4 + rng() * 1.4,
         rz: 0.9 + rng() * 0.6,
         y: 2.5 + rng() * 0.8,
         speed: 0.35 + rng() * 0.25,
         phase: rng() * Math.PI * 2,
         count: 6,
      });
   }
   return out;
}

export const ZONES = (run: Run) => ({
   entry: run.entry,
   basket: { ...run.basket, r: BASKET_R },
   column: { ...run.column, r: COLUMN_R },
   hatch: { ...run.hatch, r: HATCH_R },
});
