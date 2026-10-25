// Tower Climb's look. Pure data: one palette, the sky, and every decorative position.
// Gameplay places (slab tops, the column, the runner) stay put. No React, no three.js.
import type { LightingPreset } from "@/arcade3d/core/types";
import type { LevelId } from "@/arcade3d/types";
import { AREA } from "./camera";

/**
 * The fitted play column, relative to the climb anchor F (maxHeight). Decor stays strictly
 * behind it: every spot and the mountain mesh has z below PLAY.z0, so nothing can sit
 * between the camera (on +z) and a ledge, a coin or the runner.
 */
export const PLAY = {
   x0: AREA.min.x, x1: AREA.max.x, y0: AREA.min.y, y1: AREA.max.y, z0: AREA.min.z, z1: AREA.max.z,
} as const;

/** Linear fog. `near` is past the fitted column at every size, so the climb stays crisp. */
export const FOG = { near: 32, far: 96 } as const;

/** Sky dome radius, inside the camera's far plane (400). */
export const SKY_RADIUS = 180;

/**
 * Distant mountain card. A flat wall at `z` (every vertex of the mesh is at or behind
 * FIELD_Z, which is behind the column). Bottom and side rays of the fitted view land on it;
 * the top of the picture stays sky.
 */
export const BACKDROP = { z: -32, x0: -120, x1: 120, y0: -70, y1: 6.5 } as const;

/** Near edge of the mountain mesh. Strictly behind PLAY.z0. */
export const FIELD_Z = -8;

export const CLOUD_DRIFT = 1.8;
/** Puff mesh fits inside this radius before the spot's scale. */
export const CLOUD_RADIUS = 1;
export const ROCK_RADIUS = 0.5;
export const BIRD_RADIUS = 0.45;
export const BIRD_BOB = 0.22;

export const BIRDS = { count: 5, x: -1.2, y: 8.6, z: -14, radiusX: 4.2, radiusZ: 2.4 } as const;

export const COLORS = {
   skyTop: "#2a6eae",
   sky: "#c5e6f8",
   background: "#c5e6f8",
   fog: "#c5e6f8",
   // sunlit sandstone core behind the route, darker than the ledges so the runner reads
   shaft: "#6a5140",
   shaftDark: "#4a382e",
   shaftMortar: "#3a2c24",
   stone: "#d9c4a4",
   stoneDark: "#a88860",
   stoneCap: "#f3e6cf",
   // route colours the instructions name: cyan static slabs, violet moving slabs
   slab: "#12b4d4",
   slabDeep: "#0c7f99",
   slabCap: "#e7f7fb",
   moving: "#a78bfa",
   movingDeep: "#5b3d9e",
   movingCap: "#e4d8ff",
   wood: "#c4844a",
   woodDark: "#7a4e28",
   ledge: "#9a7048",
   gold: "#f0c14a",
   goldDeep: "#c48a22",
   spur: "#f08a3c",
   spurDeep: "#c2612a",
   spurCap: "#ffe0c2",
   cracked: "#e15b4c",
   crackedDeep: "#a33b32",
   crack: "#4a2428",
   hazard: "#ff6b4a",
   cloud: "#fffaf3",
   rock: "#c4b09a",
   rockDark: "#7d6a58",
   mountain: "#7d9a72",
   mountainFar: "#a9c0d0",
   mountainSnow: "#f4f7f4",
   bird: "#3d322c",
   hoodie: "#ef995c",
   skin: "#f3d5b6",
   visor: "#19364b",
   cap: "#ffd35d",
   pants: "#283951",
   shoe: "#ecf1ef",
   spring: "#b6e34a",
   coil: "#f0c431",
   springArrow: "#f8fafc",
   rocketBody: "#e7eef4",
   rocketFin: "#e11d48",
   nozzle: "#fb923c",
   wind: "#7dd3fc",
} as const;

export interface LevelLook {
   lighting: LightingPreset;
   skyTop: string;
   sky: string;
   background: string;
   fog: string;
}

/** Scenery only. Level 1 is the bright day tower; the lighting names match the level table. */
export const LEVEL_LOOKS: Record<LevelId, LevelLook> = {
   1: { lighting: "day", skyTop: COLORS.skyTop, sky: COLORS.sky, background: COLORS.background, fog: COLORS.fog },
   2: { lighting: "day", skyTop: "#3d82b8", sky: "#d5eef6", background: "#d5eef6", fog: "#d5eef6" },
   3: { lighting: "sunset", skyTop: "#3a2a55", sky: "#f0b27a", background: "#f0b27a", fog: "#f0b27a" },
   4: { lighting: "night", skyTop: "#070b18", sky: "#152038", background: "#152038", fog: "#152038" },
   5: { lighting: "sunset", skyTop: "#2a2048", sky: "#e8a07a", background: "#e8a07a", fog: "#e8a07a" },
};

export interface DecorSpot {
   kind: "cloud" | "rock" | "rockDark";
   x: number;
   y: number;
   z: number;
   rotY: number;
   sx: number;
   sy: number;
   sz: number;
}

export const CLOUDS: readonly DecorSpot[] = [
   { kind: "cloud", x: -16, y: 10.2, z: -18, rotY: 0.2, sx: 3.4, sy: 1.15, sz: 2.1 },
   { kind: "cloud", x: -7, y: 12.4, z: -22, rotY: 0.8, sx: 2.8, sy: 1.0, sz: 1.8 },
   { kind: "cloud", x: 1.5, y: 11.2, z: -20, rotY: 0.4, sx: 3.6, sy: 1.2, sz: 2.2 },
   { kind: "cloud", x: 11, y: 10.6, z: -17, rotY: 1.1, sx: 3.1, sy: 1.05, sz: 1.9 },
   { kind: "cloud", x: 18, y: 13.1, z: -24, rotY: 0.6, sx: 2.6, sy: 0.95, sz: 1.7 },
   { kind: "cloud", x: -20, y: 8.4, z: -26, rotY: 1.4, sx: 2.9, sy: 1.0, sz: 1.8 },
];

export const ROCKS: readonly DecorSpot[] = [
   { kind: "rock", x: -8.5, y: 1.2, z: -11, rotY: 0.4, sx: 1.5, sy: 1.1, sz: 1.2 },
   { kind: "rock", x: -13, y: 3.4, z: -14, rotY: 1.2, sx: 1.1, sy: 0.85, sz: 0.9 },
   { kind: "rock", x: 7.8, y: 0.6, z: -12, rotY: 0.7, sx: 1.7, sy: 1.2, sz: 1.3 },
   { kind: "rock", x: 14, y: 2.8, z: -16, rotY: 2.1, sx: 1.3, sy: 1.0, sz: 1.1 },
   { kind: "rock", x: -6.5, y: 5.2, z: -13, rotY: 0.2, sx: 0.9, sy: 0.7, sz: 0.8 },
   { kind: "rock", x: 6.2, y: 4.4, z: -10.5, rotY: 1.6, sx: 0.85, sy: 0.65, sz: 0.75 },
   { kind: "rock", x: -17, y: -0.4, z: -18, rotY: 0.9, sx: 2.0, sy: 1.4, sz: 1.6 },
   { kind: "rock", x: 19, y: 1.1, z: -19, rotY: 2.4, sx: 1.8, sy: 1.3, sz: 1.5 },
   { kind: "rockDark", x: -10.5, y: -1.2, z: -15, rotY: 0.5, sx: 1.2, sy: 0.8, sz: 1.0 },
   { kind: "rockDark", x: 9.5, y: -0.6, z: -13.5, rotY: 1.8, sx: 1.4, sy: 0.9, sz: 1.1 },
   { kind: "rockDark", x: -15, y: 6.1, z: -17, rotY: 0.3, sx: 0.8, sy: 0.6, sz: 0.7 },
   { kind: "rockDark", x: 12.5, y: 6.4, z: -15.5, rotY: 2.2, sx: 0.75, sy: 0.55, sz: 0.65 },
   { kind: "rockDark", x: 4.8, y: -2.2, z: -11.5, rotY: 1.1, sx: 1.0, sy: 0.7, sz: 0.85 },
   { kind: "rockDark", x: -4.6, y: 2.2, z: -12.5, rotY: 0.8, sx: 0.7, sy: 0.55, sz: 0.6 },
];

export const DECOR: readonly DecorSpot[] = [...CLOUDS, ...ROCKS];

export function decorOf(kind: DecorSpot["kind"]): DecorSpot[] {
   return DECOR.filter((spot) => spot.kind === kind);
}

export function meshRadius(kind: DecorSpot["kind"]): number {
   return kind === "cloud" ? CLOUD_RADIUS : ROCK_RADIUS;
}

export interface Aabb {
   min: { x: number; y: number; z: number };
   max: { x: number; y: number; z: number };
}

/** World box of one spot. `driftX` is the cloud's horizontal travel (±CLOUD_DRIFT at the extremes). */
export function decorAabb(spot: DecorSpot, driftX = 0): Aabb {
   const r = meshRadius(spot.kind);
   const hx = r * spot.sx, hy = r * spot.sy, hz = r * spot.sz;
   return {
      min: { x: spot.x + driftX - hx, y: spot.y - hy, z: spot.z - hz },
      max: { x: spot.x + driftX + hx, y: spot.y + hy, z: spot.z + hz },
   };
}

export function overlapsPlay(box: Aabb): boolean {
   return box.max.x > PLAY.x0 && box.min.x < PLAY.x1
      && box.max.y > PLAY.y0 && box.min.y < PLAY.y1
      && box.max.z > PLAY.z0 && box.min.z < PLAY.z1;
}

export function birdPosition(index: number, angle: number, bob = 0): { x: number; y: number; z: number } {
   const spin = angle + index * ((Math.PI * 2) / BIRDS.count);
   return {
      x: BIRDS.x + Math.cos(spin) * BIRDS.radiusX,
      y: BIRDS.y + bob,
      z: BIRDS.z + Math.sin(spin) * BIRDS.radiusZ,
   };
}

export function birdAabb(index: number, angle: number, bob = 0): Aabb {
   const p = birdPosition(index, angle, bob);
   const r = BIRD_RADIUS;
   return {
      min: { x: p.x - r, y: p.y - r, z: p.z - r },
      max: { x: p.x + r, y: p.y + r, z: p.z + r },
   };
}

/** True when the segment from `a` to `b` touches the box (closed). */
export function segmentHitsBox(
   a: { x: number; y: number; z: number },
   b: { x: number; y: number; z: number },
   box: Aabb,
): boolean {
   let t0 = 0, t1 = 1;
   const axes = ["x", "y", "z"] as const;
   for (const k of axes) {
      const d = b[k] - a[k];
      if (Math.abs(d) < 1e-9) {
         if (a[k] < box.min[k] || a[k] > box.max[k]) return false;
         continue;
      }
      let tNear = (box.min[k] - a[k]) / d;
      let tFar = (box.max[k] - a[k]) / d;
      if (tNear > tFar) { const swap = tNear; tNear = tFar; tFar = swap; }
      if (tNear > t0) t0 = tNear;
      if (tFar < t1) t1 = tFar;
      if (t0 > t1) return false;
   }
   return true;
}

function channel(c: number): number {
   const s = c / 255;
   return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG contrast of two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
   const lum = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
   };
   const hi = Math.max(lum(a), lum(b));
   const lo = Math.min(lum(a), lum(b));
   return (hi + 0.05) / (lo + 0.05);
}

export interface ColoredMesh {
   positions: Float32Array;
   colors: Float32Array;
}

function rgbOf(hex: string): [number, number, number] {
   const n = Number.parseInt(hex.slice(1), 16);
   return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const FAR = rgbOf(COLORS.mountainFar);
const NEAR = rgbOf(COLORS.mountain);
const SNOW = rgbOf(COLORS.mountainSnow);
const ROCK = rgbOf(COLORS.rock);

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
   const k = t < 0 ? 0 : t > 1 ? 1 : t;
   return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** Low under the column, rising toward the sides. The near edge stays below the play box. */
export function mountainHeight(x: number, z: number): number {
   const side = Math.min(1, Math.abs(x) / 22);
   const dist = Math.min(1, (FIELD_Z - z) / 18);
   const roll = 0.5 + 0.5 * Math.sin(x * 0.19) * Math.cos(z * 0.23);
   return -5.5 + side * side * 12 + dist * 1.4 + roll * (1.2 + side * 2.4);
}

function fieldTone(y: number): [number, number, number] {
   if (y > 6.5) return SNOW;
   if (y > 2) return ROCK;
   return NEAR;
}

function wallTone(x: number, y: number): [number, number, number] {
   const ridge = 0.5 + 0.5 * Math.sin(x * 0.11);
   if (y > 3) return mix(FAR, SNOW, (y - 3) / 6);
   if (ridge > 0.74 && y > -2) return ROCK;
   return y > -8 ? FAR : mix(NEAR, FAR, 0.45);
}

function pushTri(
   pos: number[], col: number[],
   ax: number, ay: number, az: number,
   bx: number, by: number, bz: number,
   cx: number, cy: number, cz: number,
   tone: [number, number, number],
): void {
   pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
   for (let k = 0; k < 3; k++) col.push(tone[0], tone[1], tone[2]);
}

/**
 * One mesh: a painted wall filling the lower view, and a low-poly range in front of it.
 * Every vertex is at z <= FIELD_Z, behind the play column.
 */
export function buildBackdrop(): ColoredMesh {
   const pos: number[] = [];
   const col: number[] = [];
   const { z, x0, x1, y0, y1 } = BACKDROP;
   const cols = 16, rows = 8;
   for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
         const xa = x0 + (x1 - x0) * i / cols;
         const xb = x0 + (x1 - x0) * (i + 1) / cols;
         const ya = y0 + (y1 - y0) * j / rows;
         const yb = y0 + (y1 - y0) * (j + 1) / rows;
         const tone = wallTone((xa + xb) / 2, (ya + yb) / 2);
         // normal +z (toward the camera on +z)
         pushTri(pos, col, xa, ya, z, xb, ya, z, xa, yb, z, tone);
         pushTri(pos, col, xb, ya, z, xb, yb, z, xa, yb, z, tone);
      }
   }
   const step = 5;
   const zNear = FIELD_Z;
   const zFar = -28;
   for (let zz = zFar; zz < zNear - 1e-6; zz += step) {
      for (let xx = x0; xx < x1 - 1e-6; xx += step) {
         const x2 = Math.min(x1, xx + step);
         const z2 = Math.min(zNear, zz + step);
         const h00 = mountainHeight(xx, zz);
         const h10 = mountainHeight(x2, zz);
         const h01 = mountainHeight(xx, z2);
         const h11 = mountainHeight(x2, z2);
         const tone = fieldTone((h00 + h10 + h01 + h11) / 4);
         // CCW from above
         pushTri(pos, col, xx, h00, zz, xx, h01, z2, x2, h10, zz, tone);
         pushTri(pos, col, x2, h10, zz, xx, h01, z2, x2, h11, z2, tone);
      }
   }
   return { positions: Float32Array.from(pos), colors: Float32Array.from(col) };
}
