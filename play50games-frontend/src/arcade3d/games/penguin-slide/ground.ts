// Penguin Slide ground and side scenery, pure and allocation-free (no three, no React).
//
// The snow field and the side scenery live in the track's own world coordinates, so they scroll
// with the track exactly like the trees: Track.tsx draws the track in world coordinates under one
// group that puts the penguin's current track point at the origin, facing -z. `trackFrame` is that
// transform, `toView` applies it to a point.
//
// Ground: one strip per generated chunk (rows along s, columns across d), filled only when a chunk
// is generated, never per frame. Height: the track centre minus `GROUND.sink` inside the flat
// corridor, then falling `GROUND.slope` per metre, with a small world-anchored roll that only dips.
// It is the same surface as Terrain.tsx `createTerrainSampler` (the view-space reference the
// decor tests check), anchored to the track instead of to the camera.
//
// Side scenery: every drift, spire and rock spot of looks.ts DECOR keeps its lateral offset and is
// laid along the track every `SCENERY.period` metres (`SCENERY.copies` copies). A copy keeps its
// track distance while the penguin slides past, and jumps one period ahead once it falls
// `SCENERY.behind` metres behind (recycled), so a fixed pool covers the whole visible stretch.
import { COURSE, chunkAt, corridorAt, sampleTrack, type Chunk, type Run } from "./rules";

export interface Point3 {
   x: number;
   y: number;
   z: number;
}

export const GROUND = {
   /** flat under and right beside the track: |d - corridor| <= flat */
   flat: 5.2,
   /** the flat corridor sits this far under the track surface */
   sink: 0.35,
   /** outside the corridor the snow falls this much per metre */
   slope: 0.05,
   /** world-anchored roll amplitude (only ever lowers the snow) */
   roll: 0.15,
   /** rows per chunk strip (2.5 m apart over the 60 m chunk) */
   rows: 25,
   /** lateral offsets from the corridor, metres (the fog ends at 56 m) */
   cols: [-58, -42, -30, -21, -14, -9, -5.2, 0, 5.2, 9, 14, 21, 30, 42, 58] as const,
} as const;

export const SCENERY = {
   /** a spot repeats every period metres of track */
   period: 75,
   /** copies of each spot per period (spread evenly over it) */
   copies: 3,
   /** a copy this far behind the penguin is recycled one period ahead */
   behind: 15,
} as const;

/** The transform from track world coordinates to the view (penguin at the origin, facing -z). */
export interface TrackFrame {
   /** run.s and run.branch this frame was computed for (-1 = never) */
   s: number;
   branch: number;
   chunk: number;
   x: number;
   y: number;
   z: number;
   yaw: number;
   cos: number;
   sin: number;
}

export function createTrackFrame(): TrackFrame {
   return { s: -1, branch: 0, chunk: -1, x: 0, y: 0, z: 0, yaw: 0, cos: 1, sin: 0 };
}

/** Recomputes the frame only when run.s, the branch or the chunk changed (cheap to call per copy). */
export function trackFrame(run: Run, frame: TrackFrame, p: Point3, t: Point3): TrackFrame {
   const c = chunkAt(run, run.s);
   if (frame.s === run.s && frame.branch === run.branch && frame.chunk === c.index) return frame;
   sampleTrack(c, run.s - c.index * COURSE.chunk, 0, p, t, run.branch);
   frame.s = run.s;
   frame.branch = run.branch;
   frame.chunk = c.index;
   frame.x = p.x;
   frame.y = p.y;
   frame.z = p.z;
   frame.yaw = Math.atan2(t.x, t.z);
   frame.cos = Math.cos(frame.yaw);
   frame.sin = Math.sin(frame.yaw);
   return frame;
}

/** A track world point (as sampleTrack gives it) in view coordinates; the same map as rules worldAt. */
export function toView(frame: TrackFrame, wx: number, wy: number, wz: number, out: Point3): Point3 {
   const dx = wx - frame.x;
   const dz = wz - frame.z;
   out.x = frame.cos * dx - frame.sin * dz;
   out.y = wy - frame.y;
   out.z = -(frame.sin * dx + frame.cos * dz);
   return out;
}

/**
 * Ground height (world y) at track distance `s` (chunk-local) and lateral `d`; leaves the world
 * point of (s, d) in `p`. On a split chunk the lower of the two branches sets the height, so the
 * snow never rises above either branch.
 */
export function groundY(c: Chunk, s: number, d: number, p: Point3, t: Point3, q: Point3): number {
   let top: number;
   if (c.branches) {
      sampleTrack(c, s, d, q, t, d > 0 ? -1 : 1);
      sampleTrack(c, s, d, p, t);
      top = Math.min(p.y, q.y);
   } else {
      sampleTrack(c, s, d, p, t);
      top = p.y;
   }
   const dist = Math.abs(d - corridorAt(c, s));
   if (dist <= GROUND.flat) return top - GROUND.sink;
   const roll = Math.sin(p.x * 0.08) * Math.cos(p.z * 0.06) * GROUND.roll;
   return top - GROUND.sink - (dist - GROUND.flat) * GROUND.slope + Math.min(0, roll);
}

/** Float count of one chunk strip's position (or colour) buffer: two triangles per grid cell. */
export function stripFloats(): number {
   return (GROUND.rows - 1) * (GROUND.cols.length - 1) * 6 * 3;
}

export interface StripScratch {
   p: Point3;
   t: Point3;
   q: Point3;
   /** rows × cols × [x, y, z, drop] */
   grid: Float64Array;
}

export function createStripScratch(): StripScratch {
   return {
      p: { x: 0, y: 0, z: 0 },
      t: { x: 0, y: 0, z: 0 },
      q: { x: 0, y: 0, z: 0 },
      grid: new Float64Array(GROUND.rows * GROUND.cols.length * 4),
   };
}

/** Snow tones by how far a face sits under the corridor: soft, shaded, icy hollow. */
export function toneOf(drop: number): 1 | 2 | 3 {
   if (drop < 0.8) return 1;
   if (drop < 2) return 2;
   return 3;
}

/**
 * Writes one chunk's ground strip into `positions` / `colors` (track world coordinates with z
 * negated, the layout Track.tsx uses) in place. `tones[k]` is the RGB of tone k. No allocation.
 */
export function fillStrip(
   c: Chunk,
   positions: Float32Array,
   colors: Float32Array,
   tones: readonly (readonly [number, number, number])[],
   scratch: StripScratch,
): void {
   const cols = GROUND.cols.length;
   const grid = scratch.grid;
   for (let row = 0; row < GROUND.rows; row++) {
      const s = (COURSE.chunk * row) / (GROUND.rows - 1);
      const corridor = corridorAt(c, s);
      for (let col = 0; col < cols; col++) {
         const d = corridor + GROUND.cols[col];
         const y = groundY(c, s, d, scratch.p, scratch.t, scratch.q);
         const g = (row * cols + col) * 4;
         grid[g] = scratch.p.x;
         grid[g + 1] = y;
         grid[g + 2] = -scratch.p.z;
         grid[g + 3] = Math.abs(GROUND.cols[col]) <= GROUND.flat ? 0 : (scratch.p.y - GROUND.sink) - y;
      }
   }
   let k = 0;
   const put = (row: number, col: number, tone: readonly [number, number, number]) => {
      const g = (row * cols + col) * 4;
      positions[k] = grid[g];
      positions[k + 1] = grid[g + 1];
      positions[k + 2] = grid[g + 2];
      colors[k] = tone[0];
      colors[k + 1] = tone[1];
      colors[k + 2] = tone[2];
      k += 3;
   };
   const dropOf = (row: number, col: number) => grid[(row * cols + col) * 4 + 3];
   for (let row = 0; row < GROUND.rows - 1; row++) {
      for (let col = 0; col < cols - 1; col++) {
         const a = tones[toneOf((dropOf(row, col) + dropOf(row + 1, col) + dropOf(row, col + 1)) / 3)];
         put(row, col, a);
         put(row + 1, col, a);
         put(row, col + 1, a);
         const b = tones[toneOf((dropOf(row, col + 1) + dropOf(row + 1, col) + dropOf(row + 1, col + 1)) / 3)];
         put(row, col + 1, b);
         put(row + 1, col, b);
         put(row + 1, col + 1, b);
      }
   }
}

/**
 * Track distance of one scenery copy: the spot's own distance `base` (from its looks.ts z), shifted
 * by whole periods so it lies in [runS - behind, runS - behind + period). Copy `copy` of `copies`
 * is offset by copy / copies of a period.
 */
export function sceneryS(base: number, copy: number, runS: number): number {
   const start = runS - SCENERY.behind;
   const anchor = base + (copy * SCENERY.period) / SCENERY.copies;
   const offset = anchor - start;
   const wrapped = offset - Math.floor(offset / SCENERY.period) * SCENERY.period;
   return start + wrapped;
}

/** Last track distance the generated chunks cover. */
export function trackEnd(run: Run): number {
   return (run.chunks[2].index + 1) * COURSE.chunk;
}
