// Where the world stands: the tower stations every cable runs between, the sea stacks under them and
// the scenery around the course. Pure (no three.js, no React), seeded, so tests can check that no
// prop ever stands in the riders' corridor. Visual only: the rules never read this file.
//
// A station s (0..sections) stands where span s starts and span s-1 lands: its floor runs from the
// launch point z0(s) back to the landing mat at z0(s) + 6, on top of a sea stack (L1-2: a pine
// headland, L3-5: a bare rock pillar). Two watch towers carry the cable gantry over the launch.
import { createRng } from "../../core/math";
import type { LevelId } from "../../types";
import { LEVELS, type ZipLevel } from "./levels";
import { cablePoint, deckPoint } from "./rules";

/** The sea surface (m). The lowest a rider ever hangs is about 0 m (the L5 plunge). */
export const SEA_Y = -4;
/** The hero hangs this far under its cable (rules.ts: hero = cable - 2.15). */
export const HANG = 2.15;
/** Gantry towers stand this far either side of the course centre line. */
export const GANTRY_X = 4.6;
/** The towers stand this far behind the launch point (z). */
export const TOWER_DZ = 1.8;
/** The rear anchor frame: posts at +-ANCHOR_X, this far behind the landing mat's centre. */
export const ANCHOR_X = 4.4;
export const ANCHOR_DZ = 2.1;
/** Stack tops are superellipses |x/rx|^4 + |z/rz|^4 = 1 (a rounded rectangle). */
export const STACK_POWER = 4;
export const insideStack = (st: { cx: number; cz: number; rx: number; rz: number }, x: number, z: number) =>
   Math.abs((x - st.cx) / st.rx) ** STACK_POWER + Math.abs((z - st.cz) / st.rz) ** STACK_POWER < 1;

export interface Station {
   index: number;
   /** the launch point of span `index` (absent on the final station) */
   start: { x: number; y: number; z: number } | null;
   /** the landing of span `index - 1` (absent on station 0), at the deck's rest position */
   land: { x: number; y: number; z: number } | null;
   /** the floor the start stands on, and the landing floor (they differ on L5's lighthouse) */
   startY: number;
   landY: number;
   /** the stack's footprint centre and half sizes (x, z) at the top */
   cx: number;
   cz: number;
   rx: number;
   rz: number;
   final: boolean;
}

export const spanZ = (c: ZipLevel, s: number) => -s * (c.length + 8);

export function stations(c: ZipLevel): Station[] {
   const out: Station[] = [];
   for (let s = 0; s <= c.sections; s++) {
      const start = s < c.sections ? cablePoint(c, s, 0, 0) : null;
      if (start) start.y -= HANG;
      const land = s > 0 ? deckPoint(c, s - 1, 0) : null;
      if (land) land.x = 0;
      const startY = start ? start.y : land!.y;
      const landY = land ? land.y : startY;
      const z0 = spanZ(c, s);
      const zMin = start ? z0 - 1 : land!.z - 4;
      const zMax = land ? land.z + 2.4 : z0 + 3.5;
      out.push({ index: s, start, land, startY, landY, cx: 0, cz: (zMin + zMax) / 2, rx: 6.9, rz: (zMax - zMin) / 2, final: s === c.sections });
   }
   return out;
}

/** The highest floor of a station (the stack's top). */
export const stationTop = (st: Station) => Math.max(st.startY, st.landY);

/** A sample of every rider path (all lanes, every span): the hero hangs from cable - HANG to the cable. */
export function riderPath(c: ZipLevel, step = 1 / 48): { x: number; y: number; z: number }[] {
   const out: { x: number; y: number; z: number }[] = [];
   for (let s = 0; s < c.sections; s++) for (let lane = 0; lane < 5; lane++) for (let u = 0; u <= 1 + 1e-9; u += step) out.push(cablePoint(c, s, lane, u));
   return out;
}

export interface Spot {
   x: number;
   y: number;
   z: number;
   scale: number;
   rotY: number;
   /** visual radius (m) used by the corridor test */
   r: number;
   /** visual height above y (m) */
   h: number;
}

export interface Scenery {
   /** pines on the headlands (L1-2) and on the background cliffs */
   pines: Spot[];
   /** boulders at the stack feet, in the surf */
   boulders: Spot[];
   /** big tropical cliff islands far out on both sides */
   cliffs: Spot[];
   /** marker buoys bobbing on the sea */
   buoys: Spot[];
   /** lighthouses on far stacks (L3-5) and the L5 lantern towers */
   lighthouses: Spot[];
   /** small sea stacks far out with nothing on them (depth layers) */
   farStacks: Spot[];
}

const PINE_H = 7;
const LIGHTHOUSE_H = 16;

export function scenery(level: LevelId): Scenery {
   const c = LEVELS[level];
   const rnd = createRng(0x21b0 + level * 977);
   const sts = stations(c);
   const pines: Spot[] = [];
   const boulders: Spot[] = [];
   const cliffs: Spot[] = [];
   const buoys: Spot[] = [];
   const lighthouses: Spot[] = [];
   const farStacks: Spot[] = [];
   const coast = level <= 2;
   for (const st of sts) {
      const top = stationTop(st);
      // pines on the headland's outer rim, never over the deck floor (|x| > 5.6)
      if (coast) {
         for (const side of [-1, 1]) {
            const n = 1 + Math.floor(rnd() * 2);
            for (let k = 0; k < n; k++) {
               const s = 0.8 + rnd() * 0.5;
               pines.push({ x: side * (7.2 + rnd() * 1.4), y: top - 0.6, z: st.cz + (rnd() - 0.5) * st.rz * 1.4, scale: s, rotY: rnd() * 6.28, r: 2.6 * s, h: PINE_H * s });
            }
         }
      }
      // surf boulders round the stack foot
      for (let k = 0; k < 2; k++) {
         const a = rnd() * Math.PI * 2;
         const s = 3 + rnd() * 3;
         boulders.push({ x: Math.cos(a) * (st.rx + 4 + rnd() * 3), y: SEA_Y - 0.6, z: st.cz + Math.sin(a) * (st.rz + 4 + rnd() * 3), scale: s, rotY: rnd() * 6.28, r: s, h: s * 0.5 });
      }
   }
   const first = sts[0].cz + 40;
   const last = sts[sts.length - 1].cz - 60;
   // depth layers either side: big cliff islands (far), small stacks (middle), buoys (near, on the water)
   for (let z = first; z > last; z -= 70 + rnd() * 30) {
      for (const side of [-1, 1]) {
         const s = 26 + rnd() * 18;
         cliffs.push({ x: side * (70 + rnd() * 50), y: SEA_Y - 1, z: z + rnd() * 30, scale: s, rotY: rnd() * 6.28, r: s, h: s * 0.67 });
      }
   }
   for (let z = first; z > last; z -= 34 + rnd() * 20) {
      const side = rnd() < 0.5 ? -1 : 1;
      const s = 0.8 + rnd() * 0.6;
      const x = side * (26 + rnd() * 26);
      if (level >= 3 && rnd() < 0.45) lighthouses.push({ x, y: SEA_Y + 9 * s, z, scale: s, rotY: rnd() * 6.28, r: 3 * s, h: LIGHTHOUSE_H * s });
      farStacks.push({ x, y: SEA_Y, z, scale: s, rotY: rnd() * 6.28, r: 5 * s, h: 9 * s });
      if (coast) pines.push({ x, y: SEA_Y + 9 * s - 0.4, z, scale: s * 1.1, rotY: rnd() * 6.28, r: 2.8 * s, h: PINE_H * s });
   }
   for (let z = first; z > last; z -= 30 + rnd() * 16) {
      const side = rnd() < 0.5 ? -1 : 1;
      buoys.push({ x: side * (10 + rnd() * 16), y: SEA_Y, z, scale: 1 + rnd() * 0.4, rotY: rnd() * 6.28, r: 1.2, h: 2.6 });
   }
   return { pines, boulders, cliffs, buoys, lighthouses, farStacks };
}

/**
 * The L5 lighthouse the Volt Eel coils round in phase 2: beside the spiral span's landing, its
 * lantern gallery level with the landing floor, so the gill sits just over the release point.
 */
export function bossLighthouse(c: ZipLevel): { x: number; y: number; z: number; height: number } | null {
   if (!c.boss) return null;
   const st = stations(c)[4];
   return { x: 11, y: SEA_Y, z: st.land!.z - 1, height: st.landY + 6 - SEA_Y };
}

/** Squared distance from p to the segment ab in xz. */
function segDist2(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
   const dx = bx - ax;
   const dz = bz - az;
   const l = dx * dx + dz * dz || 1;
   const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l));
   const x = ax + dx * t - px;
   const z = az + dz * t - pz;
   return x * x + z * z;
}

/** How far (m, xz) a prop's top-reaching cylinder clears the riders' corridor; < 0 = it intrudes. */
export function corridorClearance(c: ZipLevel, spot: Spot, path = riderPath(c)): number {
   let best = Infinity;
   for (let i = 0; i < path.length; i++) {
      const p = path[i];
      // only where the prop is tall enough to reach the hanging rider (feet at cable - HANG - 0.5)
      if (spot.y + spot.h < p.y - HANG - 0.5) continue;
      best = Math.min(best, Math.sqrt(segDist2(spot.x, spot.z, p.x, p.z, p.x, p.z)) - spot.r);
   }
   return best;
}
