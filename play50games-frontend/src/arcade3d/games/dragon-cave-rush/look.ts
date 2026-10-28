// Dragon Cave Rush's look: one palette (ash-grey rock warmed by ember light, violet crystal veins, the
// dragon's orange), the cave itself (a faceted rock tunnel that follows the rails, built once per level
// from the course: pure, tested in look.test.ts), and the per-level light (level 3 is dark).
import type { Course } from "./track";

export const COLORS = {
   background: "#120c0a",
   fog: "#1c1310",
   rockDark: "#2a2220",
   rock: "#463a35",
   rockWarm: "#6b4a36",
   crystal: "#6d4bb0",
   floor: "#2c2421",
   ember: "#f97316",
   breath: "#fb923c",
   ghost: "#c4b5fd",
   orb: "#ffe08a",
   lava: "#ff6a1a",
   danger: "#ef4444",
} as const;

export interface CaveLight {
   fog: { color: string; near: number; far: number };
   hemi: number;
   ambient: number;
   key: number;
}

/** The light per level: the dark Glow Tunnel (3) and the deep levels close in. */
export function caveLight(level: number, dark: boolean): CaveLight {
   if (dark) return { fog: { color: "#07060a", near: 10, far: 55 }, hemi: 0.25, ambient: 0.12, key: 0.25 };
   if (level >= 4) return { fog: { color: "#1f120c", near: 18, far: 90 }, hemi: 0.65, ambient: 0.3, key: 0.7 };
   return { fog: { color: COLORS.fog, near: 20, far: 100 }, hemi: 0.75, ambient: 0.35, key: 0.85 };
}

export function levelEnvironment(level: number, dark: boolean): { background: string; fog: [string, number, number]; lighting: "day" | "night" } {
   const l = caveLight(level, dark);
   return { background: dark ? "#050407" : COLORS.background, fog: [l.fog.color, l.fog.near, l.fog.far], lighting: "night" };
}

/** A small deterministic hash noise in 0..1. */
export function hash2(a: number, b: number): number {
   const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
   return s - Math.floor(s);
}

export interface CaveMesh {
   positions: Float32Array;
   colors: Float32Array;
   indices: Uint32Array;
}

const hex = (h: string): [number, number, number] => {
   const n = parseInt(h.slice(1), 16);
   return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/**
 * The cave round the rails: every RING m along the centre line a ring of rock (an arch from under the
 * floor on the right, over the roof, to under the floor on the left), pushed in and out by noise and
 * coloured rock / warm / crystal; the rings joined into one faceted tube. Level 5's loop is left open (a
 * cavern round Cindermaw). Pure: positions, vertex colours, indices.
 */
export function buildCave(c: Course, ring = 2.5, segments = 16): CaveMesh {
   const pos: number[] = [];
   const col: number[] = [];
   const idx: number[] = [];
   const rock = hex(COLORS.rock);
   const dark = hex(COLORS.rockDark);
   const warm = hex(COLORS.rockWarm);
   const crys = hex(COLORS.crystal);
   const n = Math.floor((c.length + 10) / ring);
   let prevStart = -1;
   for (let k = 0; k <= n; k++) {
      const s = k * ring - 5;
      const inLoop = !!c.loop && s > c.loop.s0 + 4 && s < c.loop.s1 - 4;
      if (inLoop) {
         prevStart = -1;
         continue;
      }
      const i = Math.max(0, Math.min(c.samples.length / 4 - 1, Math.round(Math.max(0, s) / 0.5)));
      const cx = c.samples[i * 4];
      const cy = c.samples[i * 4 + 1];
      const cz = c.samples[i * 4 + 2];
      const h = c.samples[i * 4 + 3];
      const rx = Math.cos(h);
      const rz = -Math.sin(h);
      const start = pos.length / 3;
      for (let j = 0; j <= segments; j++) {
         const phi = -0.22 * Math.PI + (j / segments) * 1.44 * Math.PI;
         const nz = hash2(k * 0.37, j * 1.91);
         const wob = 1 + (nz - 0.5) * 0.28;
         const lx = Math.cos(phi) * 9.2 * wob;
         const ly = 1.6 + Math.sin(phi) * 7.6 * wob;
         pos.push(cx + rx * lx, cy + ly, cz + rz * lx);
         const t = hash2(j * 0.71, k * 0.13);
         const base = ly < 1 ? warm : t > 0.9 ? crys : t > 0.45 ? rock : dark;
         const f = 0.85 + nz * 0.3;
         col.push(base[0] * f, base[1] * f, base[2] * f);
      }
      if (prevStart >= 0) {
         for (let j = 0; j < segments; j++) {
            const a = prevStart + j;
            const b = start + j;
            idx.push(a, b, a + 1, a + 1, b, b + 1);
         }
      }
      prevStart = start;
   }
   return { positions: Float32Array.from(pos), colors: Float32Array.from(col), indices: Uint32Array.from(idx) };
}

/** The cave floor under the rails: a strip 15 m wide following the centre line (one mesh). */
export function buildFloor(c: Course, ring = 2.5, half = 7.5): CaveMesh {
   const pos: number[] = [];
   const col: number[] = [];
   const idx: number[] = [];
   const fl = hex(COLORS.floor);
   const n = Math.floor((c.length + 10) / ring);
   for (let k = 0; k <= n; k++) {
      const s = Math.max(0, k * ring - 5);
      const i = Math.min(c.samples.length / 4 - 1, Math.round(s / 0.5));
      const cx = c.samples[i * 4];
      const cy = c.samples[i * 4 + 1] - 0.35;
      const cz = c.samples[i * 4 + 2];
      const h = c.samples[i * 4 + 3];
      const rx = Math.cos(h);
      const rz = -Math.sin(h);
      for (const side of [-1, 0, 1]) {
         const f = 0.8 + hash2(k, side) * 0.3;
         pos.push(cx + rx * side * half, cy - Math.abs(side) * 0.3, cz + rz * side * half);
         col.push(fl[0] * f, fl[1] * f, fl[2] * f);
      }
      if (k > 0) {
         const a = (k - 1) * 3;
         const b = k * 3;
         idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
      }
   }
   return { positions: Float32Array.from(pos), colors: Float32Array.from(col), indices: Uint32Array.from(idx) };
}

/** The dragon's breath flash 0..1 for the light (a breath lights the track ahead for 1.2 s: the card's Glow Tunnel). */
export function breathLight(msSinceFire: number): number {
   if (msSinceFire < 0) return 0;
   if (msSinceFire < 1200) return 1 - msSinceFire / 1600;
   return Math.max(0, 0.25 - (msSinceFire - 1200) / 1600);
}
