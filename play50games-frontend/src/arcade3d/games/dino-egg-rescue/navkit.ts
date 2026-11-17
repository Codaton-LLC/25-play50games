// Test-only navigation over a valley map (fairness.test.ts and the level bots; the game never imports
// it): a grid of the dino's free centre points (inside the clamp, clear of every solid by the dino's
// radius; logs count as solid, so nothing needs a dash), and Dijkstra travel times over it with the
// slow ground (mud, wading) priced in.
import { DINO, MUD, VALLEY_BOUNDS, obstacleDistance, wadingIn } from "./rules";
import { WATER, type ValleyMap } from "./maps";

export interface NavGrid {
   map: ValleyMap;
   cell: number;
   nx: number;
   nz: number;
   x0: number;
   z0: number;
   /** 1 = the dino's centre can stand here */
   free: Uint8Array;
   /** speed factor of the ground here (1, mud 0.5, wading 0.55) */
   slow: Float32Array;
}

export function navGrid(map: ValleyMap, cell = 0.25): NavGrid {
   const x0 = VALLEY_BOUNDS.min.x + DINO.radius;
   const z0 = VALLEY_BOUNDS.min.z + DINO.radius;
   const nx = Math.floor((VALLEY_BOUNDS.max.x - DINO.radius - x0) / cell) + 1;
   const nz = Math.floor((VALLEY_BOUNDS.max.z - DINO.radius - z0) / cell) + 1;
   const free = new Uint8Array(nx * nz);
   const slow = new Float32Array(nx * nz);
   for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
         const x = x0 + i * cell;
         const z = z0 + j * cell;
         let ok = 1;
         for (const o of map.obstacles) if (obstacleDistance(x, z, o) < DINO.radius) ok = 0;
         free[j * nx + i] = ok;
         let s = 1;
         for (const m of map.mud) if (Math.hypot(x - m.x, z - m.z) <= MUD.radius) s = MUD.speedMultiplier;
         if (s === 1 && wadingIn(map, x, z)) s = WATER.speedMultiplier;
         slow[j * nx + i] = s;
      }
   }
   return { map, cell, nx, nz, x0, z0, free, slow };
}

/** The nearest free cell index to (x, z) within `reach` metres, or -1. */
export function cellNear(g: NavGrid, x: number, z: number, reach = 0.6): number {
   let best = -1;
   let bestD = Infinity;
   const r = Math.ceil(reach / g.cell) + 1;
   const ci = Math.round((x - g.x0) / g.cell);
   const cj = Math.round((z - g.z0) / g.cell);
   for (let j = cj - r; j <= cj + r; j++) {
      for (let i = ci - r; i <= ci + r; i++) {
         if (i < 0 || j < 0 || i >= g.nx || j >= g.nz) continue;
         const k = j * g.nx + i;
         if (!g.free[k]) continue;
         const d = Math.hypot(g.x0 + i * g.cell - x, g.z0 + j * g.cell - z);
         if (d <= reach && d < bestD) {
            bestD = d;
            best = k;
         }
      }
   }
   return best;
}

const NEIGH: readonly [number, number, number][] = [
   [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
   [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/** Travel time (s) from `from` to every cell at `speed` m/s on firm ground (Infinity = unreachable). */
export function travelTimes(g: NavGrid, from: number, speed: number, out?: Float64Array): Float64Array {
   const n = g.nx * g.nz;
   const t = out ?? new Float64Array(n);
   t.fill(Infinity);
   if (from < 0) return t;
   // binary heap of [time, cell]
   const heapT: number[] = [];
   const heapK: number[] = [];
   const push = (tt: number, k: number) => {
      heapT.push(tt);
      heapK.push(k);
      let i = heapT.length - 1;
      while (i > 0) {
         const p = (i - 1) >> 1;
         if (heapT[p] <= heapT[i]) break;
         [heapT[p], heapT[i]] = [heapT[i], heapT[p]];
         [heapK[p], heapK[i]] = [heapK[i], heapK[p]];
         i = p;
      }
   };
   const pop = () => {
      const tt = heapT[0];
      const k = heapK[0];
      const lt = heapT.pop()!;
      const lk = heapK.pop()!;
      if (heapT.length > 0) {
         heapT[0] = lt;
         heapK[0] = lk;
         let i = 0;
         for (;;) {
            const l = 2 * i + 1;
            const r = l + 1;
            let m = i;
            if (l < heapT.length && heapT[l] < heapT[m]) m = l;
            if (r < heapT.length && heapT[r] < heapT[m]) m = r;
            if (m === i) break;
            [heapT[m], heapT[i]] = [heapT[i], heapT[m]];
            [heapK[m], heapK[i]] = [heapK[i], heapK[m]];
            i = m;
         }
      }
      return [tt, k] as const;
   };
   t[from] = 0;
   push(0, from);
   while (heapT.length > 0) {
      const [tt, k] = pop();
      if (tt > t[k]) continue;
      const i = k % g.nx;
      const j = (k - i) / g.nx;
      for (const [di, dj, w] of NEIGH) {
         const a = i + di;
         const b = j + dj;
         if (a < 0 || b < 0 || a >= g.nx || b >= g.nz) continue;
         const q = b * g.nx + a;
         if (!g.free[q]) continue;
         // a diagonal step needs both side cells free (no corner cutting through a trunk)
         if (di !== 0 && dj !== 0 && (!g.free[j * g.nx + a] || !g.free[b * g.nx + i])) continue;
         const v = speed * Math.min(g.slow[k], g.slow[q]);
         const nt = tt + (w * g.cell) / v;
         if (nt < t[q]) {
            t[q] = nt;
            push(nt, q);
         }
      }
   }
   return t;
}

export const cellX = (g: NavGrid, k: number) => g.x0 + (k % g.nx) * g.cell;
export const cellZ = (g: NavGrid, k: number) => g.z0 + Math.floor(k / g.nx) * g.cell;

/**
 * A waypoint for a bot at (x, z) heading down `field` (times to its target): walks the cheapest
 * neighbours `look` cells ahead. Returns the cell or -1 when the bot stands off the grid.
 */
export function waypoint(g: NavGrid, field: Float64Array, x: number, z: number, look = 4): number {
   let k = cellNear(g, x, z, 1.0);
   if (k < 0) return -1;
   for (let s = 0; s < look; s++) {
      const i = k % g.nx;
      const j = (k - i) / g.nx;
      let best = k;
      for (const [di, dj] of NEIGH) {
         const a = i + di;
         const b = j + dj;
         if (a < 0 || b < 0 || a >= g.nx || b >= g.nz) continue;
         const q = b * g.nx + a;
         if (field[q] < field[best]) best = q;
      }
      if (best === k) break;
      k = best;
   }
   return k;
}
