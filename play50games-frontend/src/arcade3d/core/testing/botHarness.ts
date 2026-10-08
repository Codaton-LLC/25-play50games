// Bot harness for rules tests: a walkable grid on the ground plane, a Dijkstra path over it, a
// path follower, and a run loop that drives the real store exactly like the canvas (RunClock, then
// useRunFrame's dt). Owned by Claude. For vitest only: runtime code never imports core/testing
// (botHarness.test.ts checks that). Pure: no three.js, React or DOM; the store type is type-only.
// core/README.md "Testing helpers: botHarness" has an example.
import type { StoreApi } from "zustand/vanilla";
import { createRng } from "../math";
import { advanceRunClock, playedFrameDt } from "../frameLoop";
import type { ArcadeStore } from "../useArcadeStore";

// ---------- the grid ----------

export interface GridSpec {
   /** cell size (m) */
   cell: number;
   /** the grid covers x in [-halfX, halfX] and z in [-halfZ, halfZ] */
   halfX: number;
   halfZ: number;
}

export interface Grid extends GridSpec {
   nx: number;
   nz: number;
   /** nx * nz nodes, node n = i * nz + j */
   size: number;
   x(n: number): number;
   z(n: number): number;
   /** the node nearest to (x, z), not clamped to the grid */
   node(x: number, z: number): number;
}

export function createGrid(spec: GridSpec): Grid {
   const { cell, halfX, halfZ } = spec;
   const nx = Math.round((2 * halfX) / cell) + 1;
   const nz = Math.round((2 * halfZ) / cell) + 1;
   return {
      cell,
      halfX,
      halfZ,
      nx,
      nz,
      size: nx * nz,
      x: (n) => -halfX + Math.floor(n / nz) * cell,
      z: (n) => -halfZ + (n % nz) * cell,
      node: (x, z) => Math.round((x + halfX) / cell) * nz + Math.round((z + halfZ) / cell),
   };
}

/** 1 where `walkable(x, z)` holds for the node's centre (the game decides: bounds, props, margins). */
export function freeGrid(grid: Grid, walkable: (x: number, z: number) => boolean): Uint8Array {
   const free = new Uint8Array(grid.size);
   for (let n = 0; n < grid.size; n++) free[n] = walkable(grid.x(n), grid.z(n)) ? 1 : 0;
   return free;
}

const STEPS: ReadonlyArray<readonly [number, number, number]> = [
   [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
   [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/** Dijkstra (binary heap) over free nodes, 8 neighbours, no cut corners: the node path from -> to, [] if none. */
export function findPath(grid: Grid, free: Uint8Array, from: number, to: number): number[] {
   const { nx, nz } = grid;
   const cost = new Float64Array(grid.size).fill(Infinity);
   const prev = new Int32Array(grid.size).fill(-1);
   const heap: Array<[number, number]> = [];
   const push = (c: number, n: number) => {
      heap.push([c, n]);
      for (let i = heap.length - 1; i > 0; ) {
         const p = (i - 1) >> 1;
         if (heap[p][0] <= heap[i][0]) break;
         [heap[p], heap[i]] = [heap[i], heap[p]];
         i = p;
      }
   };
   const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
         heap[0] = last;
         for (let i = 0; ; ) {
            const l = 2 * i + 1;
            const r = l + 1;
            let m = i;
            if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
            if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
            if (m === i) break;
            [heap[m], heap[i]] = [heap[i], heap[m]];
            i = m;
         }
      }
      return top;
   };
   if (from < 0 || from >= grid.size || to < 0 || to >= grid.size) return [];
   cost[from] = 0;
   push(0, from);
   while (heap.length) {
      const [c, n] = pop();
      if (n === to) break;
      if (c > cost[n]) continue;
      const i = Math.floor(n / nz);
      const j = n % nz;
      for (const [di, dj, w] of STEPS) {
         const ni = i + di;
         const nj = j + dj;
         if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
         const m = ni * nz + nj;
         if (!free[m] || !free[ni * nz + j] || !free[i * nz + nj]) continue;
         if (c + w < cost[m]) {
            cost[m] = c + w;
            prev[m] = n;
            push(cost[m], m);
         }
      }
   }
   const path: number[] = [];
   for (let n = to; n >= 0; n = prev[n]) path.unshift(n);
   return path[0] === from ? path : [];
}

/** The free node nearest to (x, z) within `maxDist` (m), else the node under (x, z). */
export function nearestFree(grid: Grid, free: Uint8Array, x: number, z: number, maxDist = 2): number {
   let best = grid.node(x, z);
   let bestD = Infinity;
   for (let n = 0; n < grid.size; n++) {
      if (!free[n]) continue;
      const d = Math.hypot(grid.x(n) - x, grid.z(n) - z);
      if (d < bestD && d < maxDist) {
         bestD = d;
         best = n;
      }
   }
   return best;
}

export interface PathFollower {
   /** the goal point (m) the path leads to */
   goalX: number;
   goalZ: number;
   path: number[];
   /** the node being walked to */
   k: number;
}

/** A follower from (x, z) to the goal over the free grid (an empty path walks straight at the goal). */
export function followPath(grid: Grid, free: Uint8Array, x: number, z: number, goalX: number, goalZ: number): PathFollower {
   return { goalX, goalZ, path: findPath(grid, free, nearestFree(grid, free, x, z), nearestFree(grid, free, goalX, goalZ)), k: 0 };
}

/**
 * The unit direction from (x, z) along the follower's path (writes `out`): it passes a node once
 * within `pass` (m) of it, and heads for the goal itself after the last node.
 */
export function steer(grid: Grid, f: PathFollower, x: number, z: number, out: { dirX: number; dirZ: number }, pass = 0.6): void {
   while (f.k < f.path.length - 1 && Math.hypot(grid.x(f.path[f.k]) - x, grid.z(f.path[f.k]) - z) < pass) f.k++;
   const last = f.k >= f.path.length - 1;
   const dx = (last ? f.goalX : grid.x(f.path[f.k])) - x;
   const dz = (last ? f.goalZ : grid.z(f.path[f.k])) - z;
   const len = Math.hypot(dx, dz) || 1;
   out.dirX = dx / len;
   out.dirZ = dz / len;
}

// ---------- frames and the run loop ----------

/** Every frame `ms` long. */
export const fixedFrames = (ms: number) => () => ms / 1000;

/** Seeded random frame lengths in [min, max) seconds (default 4-50 ms). */
export function randomFrames(seed: number, min = 0.004, max = 0.05): () => number {
   const rng = createRng(seed);
   return () => min + rng() * (max - min);
}

export interface SimulateOptions {
   durationMs?: number;
   lives?: number;
   resultDelayMs?: number;
   /** the next frame's length (s), as R3F's delta */
   frame: () => number;
   /** the game's useRunFrame body: dt (s, > 0) and the run's play time (s) after it */
   step: (dt: number, time: number, store: StoreApi<ArcadeStore>) => void;
   /** safety stop (default 1e6 frames): throws instead of looping forever */
   maxFrames?: number;
}

/**
 * One run on `store` (a fresh `createArcadeStore()`): configure, ready, start, then each frame
 * advanceRunClock and, while playing, `step(playedFrameDt, elapsedMs / 1000)` until the phase is
 * "over" (the game's own end() or the timer). Returns the final state.
 */
export function simulateRun(store: StoreApi<ArcadeStore>, options: SimulateOptions): ArcadeStore {
   const { frame, step, maxFrames = 1e6 } = options;
   store.getState().configure({ durationMs: options.durationMs, lives: options.lives, resultDelayMs: options.resultDelayMs });
   store.getState().markReady();
   store.getState().start();
   for (let f = 0; store.getState().phase !== "over"; f++) {
      if (f >= maxFrames) throw new Error(`simulateRun: still ${store.getState().phase} after ${maxFrames} frames`);
      advanceRunClock(store, frame());
      const dt = playedFrameDt(store.getState());
      if (dt > 0) step(dt, store.getState().elapsedMs / 1000, store);
   }
   return store.getState();
}
