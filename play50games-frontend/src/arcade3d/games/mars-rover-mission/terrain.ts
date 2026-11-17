// Mars Rover Mission terrain: a visual height field (the rules stay flat 2D). Soft dunes on the plain,
// flattened around every ring, pad, prop and crevasse; beyond the plain the ground climbs into ridges,
// canyon walls or a crater rim, with terraced strata. Pure: no React, no three.js.
import type { LevelId } from "@/arcade3d/types";
import type { MarsLevel, TerrainKind } from "./levels";
import { BASE_PAD_RADIUS, CHARGER_PAD_RADIUS, SITE_RING_RADIUS, type Run } from "./rules";

export interface Flat {
   x: number;
   z: number;
   /** fully flat inside this radius, blending to the dunes over FLAT_BLEND metres */
   r: number;
}

export const FLAT_BLEND = 3;

/** Cliff height (m) beyond each side of the plain, the ramp's start and end distance outside it (m). */
export const CLIFFS: Record<TerrainKind, { north: number; side: number; south: number; from: number; to: number; dunes: number }> = {
   plains: { north: 6, side: 5, south: 3, from: 4, to: 18, dunes: 0.45 },
   canyon: { north: 15, side: 18, south: 6, from: 3, to: 12, dunes: 0.4 },
   crater: { north: 11, side: 11, south: 7, from: 3, to: 13, dunes: 0.35 },
   ruins: { north: 9, side: 8, south: 4, from: 4, to: 15, dunes: 0.4 },
};

const smooth = (a: number, b: number, x: number) => {
   const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
   return t * t * (3 - 2 * t);
};

/** Everything kept flat: rings, pads, the base, props, crevasses. */
export function flatsFor(run: Run): Flat[] {
   const flats: Flat[] = [];
   for (const s of run.sites) flats.push({ x: s.x, z: s.z, r: SITE_RING_RADIUS + 0.6 });
   for (const c of run.chargers) flats.push({ x: c.x, z: c.z, r: CHARGER_PAD_RADIUS + 0.6 });
   flats.push({ x: run.basePad.x, z: run.basePad.z, r: BASE_PAD_RADIUS + 0.8 });
   for (const p of run.props) flats.push({ x: p.x, z: p.z, r: p.radius + 0.6 });
   for (const c of run.crevasses) flats.push({ x: c.x, z: c.z, r: c.halfLength + c.halfWidth + 0.8 });
   return flats;
}

export type HeightFn = (x: number, z: number) => number;

/**
 * The height field of one run. `lanes` are the boulder lanes' x: the north cliff dips into a chute
 * above each, where the sliding rocks come down.
 */
export function makeHeight(level: MarsLevel, id: LevelId, flats: readonly Flat[], lanes: readonly number[] = []): HeightFn {
   const cliff = CLIFFS[level.terrain];
   const hw = level.width / 2;
   const hd = level.depth / 2;
   const p1 = id * 1.7;
   const p2 = id * 0.9 + 0.4;
   const dunes = (x: number, z: number) =>
      cliff.dunes * (0.62 * Math.sin(0.21 * x + 0.13 * z + p1) + 0.38 * Math.sin(-0.16 * x + 0.27 * z + p2)) +
      0.12 * Math.sin(0.55 * x + 0.41 * z + p1 * 2) * Math.sin(0.33 * x - 0.5 * z);
   return (x: number, z: number) => {
      let mask = 1;
      for (const f of flats) {
         const dx = x - f.x;
         const dz = z - f.z;
         const reach = f.r + FLAT_BLEND;
         if (dx * dx + dz * dz >= reach * reach) continue;
         mask *= smooth(f.r, reach, Math.sqrt(dx * dx + dz * dz));
         if (mask <= 0) break;
      }
      let h = dunes(x, z) * mask;
      // outside the plain: the ramp up the cliffs (rounded corners), terraced into strata
      const ox = Math.max(0, Math.abs(x) - hw);
      const oz = Math.max(0, Math.abs(z) - hd);
      const out = Math.hypot(ox, oz);
      if (out > 0) {
         // the side's height: north (z < 0), south (z > 0, the start's camera side) or east / west
         const sideW = ox / (ox + oz + 1e-9);
         const nsH = z < 0 ? cliff.north : cliff.south;
         let H = sideW * cliff.side + (1 - sideW) * nsH;
         // a chute above each boulder lane in the north wall
         if (z < 0) for (const lx of lanes) H *= 1 - 0.6 * Math.exp(-(((x - lx) / 2.6) ** 2));
         // the rim wanders along the perimeter
         H *= 0.8 + 0.2 * Math.sin(x * 0.09 + p1) * Math.cos(z * 0.08 + p2);
         const ramp = smooth(cliff.from, cliff.to, out);
         let c = H * ramp;
         // strata: flat ledges and steep risers
         const step = 1.6;
         const k = c / step;
         c = (Math.floor(k) + smooth(0.35, 0.65, k - Math.floor(k))) * step;
         if (level.terrain === "crater" && out > cliff.to) c -= Math.min(H * 0.45, (out - cliff.to) * 0.25);
         h += c + (out > cliff.to ? 0.6 * Math.sin(x * 0.07 + z * 0.05) : 0);
      }
      return h;
   };
}

/** Terrain normal-ish tilt at (x, z) for a body of half length a along heading yaw, half width b: pitch, roll (radians). */
export function tiltAt(height: HeightFn, x: number, z: number, yaw: number, a: number, b: number, out: { pitch: number; roll: number }) {
   const fx = Math.sin(yaw);
   const fz = Math.cos(yaw);
   const front = height(x + fx * a, z + fz * a);
   const back = height(x - fx * a, z - fz * a);
   // the rover's left is (fz, -fx)... its right is (-fz, fx) under the yaw convention (yaw 0 = +z, right = -x)
   const right = height(x - fz * b, z + fx * b);
   const left = height(x + fz * b, z - fx * b);
   out.pitch = Math.atan2(front - back, 2 * a);
   out.roll = Math.atan2(left - right, 2 * b);
   return out;
}
