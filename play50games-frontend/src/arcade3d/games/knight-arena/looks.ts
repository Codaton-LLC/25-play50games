// Knight Arena's look. Pure data: one palette, the fitted play square, and every decorative
// position. Gameplay (posts, hit radii, the knight, the camera box) stays in rules.ts / Scene.tsx.
// No React, no three.js. definition.environment is unchanged (levels.test.ts locks it); the scene
// asks useStageLighting for these sky and fog colours. Fog near / far stay the definition's.
import type { LightingPreset } from "../../core/types";
import type { LevelId } from "../../types";

/** The box useFittedView keeps on screen. Decor footprints stay outside it. */
export const PLAY_BOUNDS = { x0: -3.5, x1: 3.5, z0: -3.5, z1: 3.5, y0: 0, y1: 2.2 } as const;

/** Same numbers Scene.tsx passes to useFittedView. Pitch 60°, one yaw, lens shift. */
export const FIT = {
   pitch: (60 * Math.PI) / 180,
   yaws: [0] as const,
   focus: [{ x: 0, y: 0.5, z: 0 }] as const,
   fov: 45,
   padding: 12,
   shift: true as const,
};

/**
 * Meadow half-extent in metres. ShellStage's camera far is 400. A landscape phone with the
 * cookie banner open pulls the fit back until the ground under the screen is about ±200 m;
 * 260 covers that and the hit stays inside the far plane.
 */
export const GROUND = { half: 260, y: 0 } as const;

export const COLORS = {
   skyTop: "#3e5678",
   sky: "#f6c59a",
   fog: "#f6c59a",
   grass: "#6f8f3e",
   grassSun: "#d5e2a0",
   grassShade: "#3f6b32",
   sand: "#c4a474",
   sandMid: "#a8844e",
   sandDark: "#8a6840",
   stone: "#e4d7c4",
   stoneMid: "#b7a898",
   stoneDark: "#7a6e62",
   wood: "#8a4e28",
   woodMid: "#c4894e",
   woodLight: "#e2b07a",
   woodDark: "#5c3316",
   banner: "#1d4ed8",
   bannerDeep: "#1e3a8a",
   gold: "#f5c542",
   goldDeep: "#d97706",
   steel: "#e7eef6",
   steelMid: "#94a3b8",
   steelDark: "#475569",
   tent: "#f6e6c8",
   tentStripe: "#9f1239",
   plaster: "#f4efe6",
   roof: "#9a3412",
   rake: "#a16207",
} as const;

/**
 * Runtime sky and fog colour per level. `lighting` matches the definition's preset, so the sun
 * does not change. Fog colours are lighter than the definition's dark violets: near/far cannot
 * move (core), and a dark fog was eating the yard on tall phones.
 */
export interface LevelLook {
   lighting: LightingPreset;
   skyTop: string;
   sky: string;
   background: string;
   fog: string;
}

export const LEVEL_LOOKS: Record<LevelId, LevelLook> = {
   1: { lighting: "sunset", skyTop: COLORS.skyTop, sky: COLORS.sky, background: COLORS.fog, fog: COLORS.fog },
   2: { lighting: "day", skyTop: "#7eb6d6", sky: "#d7ebf8", background: "#d7ebf8", fog: "#c5e0f2" },
   3: { lighting: "sunset", skyTop: "#4c2d4a", sky: "#f0b48a", background: "#f0b48a", fog: "#f0b48a" },
   4: { lighting: "night", skyTop: "#070b16", sky: "#243044", background: "#0b1020", fog: "#243044" },
   5: { lighting: "sunset", skyTop: "#3a2844", sky: "#d08a72", background: "#d08a72", fog: "#d08a72" },
};

/** Local half-extents of one decor mesh, before the spot's scale. y0/hy are fractions of sy. */
export const DECOR_LOCAL = {
   wall: { hx: 0.56, hz: 0.5, y0: 0, hy: 1.02 },
   tent: { hx: 0.7, hz: 0.7, y0: 0, hy: 0.92 },
   rack: { hx: 0.52, hz: 0.18, y0: 0, hy: 1.02 },
   house: { hx: 0.7, hz: 0.7, y0: 0, hy: 1.14 },
   hill: { hx: 1, hz: 1, y0: -0.12, hy: 1.92 },
   tuft: { hx: 0.44, hz: 0.44, y0: 0, hy: 0.72 },
   rock: { hx: 0.48, hz: 0.48, y0: -0.08, hy: 0.82 },
} as const;

export type DecorKind = keyof typeof DECOR_LOCAL;

export interface DecorSpot {
   kind: DecorKind;
   tone: 0 | 1;
   x: number;
   y: number;
   z: number;
   rotY: number;
   sx: number;
   sy: number;
   sz: number;
}

export interface DecorBox {
   min: { x: number; y: number; z: number };
   max: { x: number; y: number; z: number };
}

export function inPlayArea(x: number, z: number): boolean {
   return x >= PLAY_BOUNDS.x0 && x <= PLAY_BOUNDS.x1 && z >= PLAY_BOUNDS.z0 && z <= PLAY_BOUNDS.z1;
}

/** World box of one spot, including its yaw. The mesh in Decor.tsx stays inside DECOR_LOCAL. */
export function decorAABB(spot: DecorSpot): DecorBox {
   const local = DECOR_LOCAL[spot.kind];
   const c = Math.abs(Math.cos(spot.rotY));
   const s = Math.abs(Math.sin(spot.rotY));
   const hx = local.hx * spot.sx * c + local.hz * spot.sz * s;
   const hz = local.hx * spot.sx * s + local.hz * spot.sz * c;
   return {
      min: { x: spot.x - hx, y: spot.y + local.y0 * spot.sy, z: spot.z - hz },
      max: { x: spot.x + hx, y: spot.y + local.hy * spot.sy, z: spot.z + hz },
   };
}

export function boxHitsPlay(box: DecorBox): boolean {
   const overlapX = box.max.x >= PLAY_BOUNDS.x0 && box.min.x <= PLAY_BOUNDS.x1;
   const overlapZ = box.max.z >= PLAY_BOUNDS.z0 && box.min.z <= PLAY_BOUNDS.z1;
   return overlapX && overlapZ;
}

/** True when the segment from `a` to `b` touches the box (ends included). */
export function segmentHitsBox(
   a: { x: number; y: number; z: number },
   b: { x: number; y: number; z: number },
   box: DecorBox,
): boolean {
   const delta = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
   let t0 = 0;
   let t1 = 1;
   for (const axis of ["x", "y", "z"] as const) {
      const min = box.min[axis];
      const max = box.max[axis];
      if (Math.abs(delta[axis]) < 1e-8) {
         if (a[axis] < min || a[axis] > max) return false;
      } else {
         let near = (min - a[axis]) / delta[axis];
         let far = (max - a[axis]) / delta[axis];
         if (near > far) {
            const swap = near;
            near = far;
            far = swap;
         }
         if (near > t0) t0 = near;
         if (far < t1) t1 = far;
         if (t0 > t1) return false;
      }
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

export function luminance(hex: string): number {
   const n = Number.parseInt(hex.slice(1), 16);
   return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function spot(
   kind: DecorKind,
   x: number,
   z: number,
   sx: number,
   sy: number,
   sz: number,
   rotY = 0,
   tone: 0 | 1 = 0,
): DecorSpot {
   return { kind, tone, x, y: 0, z, rotY, sx, sy, sz };
}

function buildDecor(): DecorSpot[] {
   const spots: DecorSpot[] = [
      // Curtain wall north of the yard, with a gate in the middle. Behind the play square.
      spot("wall", -7, -6.9, 3.3, 2.45, 1.15),
      spot("wall", -2.7, -6.9, 3.3, 2.45, 1.15),
      spot("wall", 2.7, -6.9, 3.3, 2.45, 1.15),
      spot("wall", 7, -6.9, 3.3, 2.45, 1.15),
      // Tents: south foreground (portrait's bottom edge) and the two flanks.
      spot("tent", 0, 7.3, 2.6, 1.9, 2.6, 0.4),
      spot("tent", -3.6, 7.6, 2.4, 1.75, 2.4, 1.1),
      spot("tent", 3.6, 7.6, 2.4, 1.75, 2.4, -0.6),
      spot("tent", -7.8, 0.4, 2.5, 1.85, 2.5, 0.8),
      spot("tent", 7.8, 0.2, 2.5, 1.85, 2.5, -0.4),
      spot("tent", -7.2, 3.8, 2.3, 1.7, 2.3, 0.2),
      spot("tent", 7.2, 3.6, 2.3, 1.7, 2.3, 1.4),
      spot("tent", -8.8, -5.6, 2.4, 1.8, 2.4, 0.5),
      spot("tent", 8.8, -5.4, 2.4, 1.8, 2.4, -1.2),
      // Weapon racks along the east and west, long side facing the camera.
      spot("rack", -6.35, 1.7, 2.15, 1.45, 0.85),
      spot("rack", 6.35, 1.7, 2.15, 1.45, 0.85, 0.05),
      spot("rack", -6.35, -1.7, 2.15, 1.45, 0.85, 0.15),
      spot("rack", 6.35, -1.5, 2.15, 1.45, 0.85, -0.1),
      // Village past the wall.
      spot("house", -7.2, -13.2, 2.4, 2.2, 2.4, 0.3),
      spot("house", -2.4, -12.4, 2.2, 2.05, 2.2, 1.2),
      spot("house", 2.6, -13, 2.5, 2.3, 2.5, 0.6),
      spot("house", 7.4, -12.6, 2.3, 2.1, 2.3, -0.4),
      spot("house", -4.8, -16.2, 2.6, 2.35, 2.6, 0.9),
      spot("house", 4.6, -16, 2.4, 2.15, 2.4, 0.2),
      // Hills beyond the village, the flanks, and the far south.
      spot("hill", 0, -21, 6.2, 1.5, 5.2, 0.2, 0),
      spot("hill", -11, -16, 5.4, 1.3, 4.6, 0.8, 1),
      spot("hill", 11, -16.5, 5.6, 1.4, 4.8, 0.4, 0),
      spot("hill", -18, -4, 5.2, 1.25, 4.4, 1.1, 1),
      spot("hill", 18, -2, 5.4, 1.35, 4.6, 0.3, 0),
      spot("hill", -16, 8, 5, 1.2, 4.4, 0.7, 1),
      spot("hill", 16, 9, 5.2, 1.3, 4.5, 1.5, 0),
      spot("hill", 0, 19, 6.4, 1.45, 5, 0.2, 1),
      spot("hill", -9, 16, 4.8, 1.15, 4.2, 0.9, 0),
      spot("hill", 9, 16.5, 5, 1.2, 4.3, 0.5, 1),
   ];
   // Grass tufts just outside the square, and a few rocks further out. Static: no drift.
   for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + 0.18;
      const radius = 6.45;
      const scale = 0.82 + (i % 3) * 0.08;
      spots.push(spot("tuft", Math.cos(angle) * radius, Math.sin(angle) * radius, scale, 0.7 + (i % 2) * 0.12, scale * 0.92, angle));
   }
   for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.4;
      const radius = 9.4;
      const scale = 0.75 + (i % 3) * 0.12;
      spots.push(spot("rock", Math.cos(angle) * radius, Math.sin(angle) * radius, scale, 0.55 + (i % 2) * 0.15, scale * 0.86, angle * 0.7, i % 2 === 0 ? 0 : 1));
   }
   for (const placed of spots) {
      if (inPlayArea(placed.x, placed.z) || boxHitsPlay(decorAABB(placed))) {
         throw new Error(`knight look: ${placed.kind} at ${placed.x.toFixed(2)}, ${placed.z.toFixed(2)} hits the play square`);
      }
   }
   return spots;
}

export const DECOR: readonly DecorSpot[] = buildDecor();

export function decorOf(kind: DecorKind, tone?: 0 | 1): DecorSpot[] {
   return DECOR.filter((item) => item.kind === kind && (tone === undefined || item.tone === tone));
}
