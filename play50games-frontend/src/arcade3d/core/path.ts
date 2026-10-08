import type { Vec3Like as Vec3 } from "./collision";

export interface Path {
   readonly points: readonly Vec3[];
   readonly closed: boolean;
   readonly total: number;
   readonly lengths: Float64Array;
}
export interface PathOptions { closed?: boolean; smooth?: boolean; samples?: number }

/** Copies input; smooth paths use uniform Catmull-Rom sampled into a polyline. */
export function createPath(points: readonly Vec3[], options: PathOptions = {}): Path {
   if (points.length === 0) throw new RangeError("A path needs at least one point");
   const closed = options.closed ?? false;
   const samples = options.samples ?? 16;
   if (!Number.isInteger(samples) || samples < 1) throw new RangeError("samples must be a positive integer");
   const result: Vec3[] = [];
   const n = points.length;
   const segments = closed ? n : n - 1;
   const at = (i: number) => points[closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i))];
   if (options.smooth && n > 1) {
      for (let i = 0; i < segments; i++) {
         const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
         for (let j = 0; j < samples; j++) {
            const t = j / samples;
            result.push({ x: cat(a.x, b.x, c.x, d.x, t), y: cat(a.y, b.y, c.y, d.y, t), z: cat(a.z, b.z, c.z, d.z, t) });
         }
      }
      if (!closed) result.push({ ...points[n - 1] });
   } else for (const p of points) result.push({ x: p.x, y: p.y, z: p.z });
   const lengths = new Float64Array(result.length + (closed ? 1 : 0));
   for (let i = 1; i < lengths.length; i++) {
      const a = result[i - 1], b = result[i % result.length];
      lengths[i] = lengths[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
   }
   return { points: result, closed, lengths, total: lengths[lengths.length - 1] };
}

function cat(a: number, b: number, c: number, d: number, t: number): number {
   return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
}
function normalizeS(path: Path, s: number): number {
   if (!Number.isFinite(s)) return 0;
   return path.total === 0 ? 0 : path.closed ? ((s % path.total) + path.total) % path.total : Math.max(0, Math.min(path.total, s));
}
function segmentAt(path: Path, s: number): number {
   let lo = 0, hi = path.lengths.length - 1;
   while (lo + 1 < hi) {
      const mid = (lo + hi) >>> 1;
      if (path.lengths[mid] <= s) lo = mid; else hi = mid;
   }
   return lo;
}
export function pointAt(path: Path, s: number, out?: Vec3): Vec3 {
   const o = out ?? { x: 0, y: 0, z: 0 };
   s = normalizeS(path, s);
   const i = segmentAt(path, s), a = path.points[i], b = path.points[(i + 1) % path.points.length];
   const length = path.lengths[i + 1] - path.lengths[i];
   const t = length > 0 ? (s - path.lengths[i]) / length : 0;
   o.x = a.x + (b.x - a.x) * t; o.y = a.y + (b.y - a.y) * t; o.z = a.z + (b.z - a.z) * t;
   return o;
}
export function tangentAt(path: Path, s: number, out?: Vec3): Vec3 {
   const o = out ?? { x: 0, y: 0, z: 0 };
   let i = segmentAt(path, normalizeS(path, s));
   while (i > 0 && !(path.lengths[i + 1] > path.lengths[i])) i--;
   const a = path.points[i], b = path.points[(i + 1) % path.points.length];
   const x = b.x - a.x, y = b.y - a.y, z = b.z - a.z, length = Math.hypot(x, y, z);
   o.x = length ? x / length : 0; o.y = length ? y / length : 0; o.z = length ? z / length : 0;
   return o;
}
export function nearestS(path: Path, point: Vec3): number {
   let best = Infinity, s = 0;
   for (let i = 0; i < path.lengths.length - 1; i++) {
      const a = path.points[i], b = path.points[(i + 1) % path.points.length];
      const x = b.x - a.x, y = b.y - a.y, z = b.z - a.z, l2 = x * x + y * y + z * z;
      const t = l2 ? Math.max(0, Math.min(1, ((point.x - a.x) * x + (point.y - a.y) * y + (point.z - a.z) * z) / l2)) : 0;
      const d2 = (point.x - a.x - x * t) ** 2 + (point.y - a.y - y * t) ** 2 + (point.z - a.z - z * t) ** 2;
      if (d2 < best) { best = d2; s = path.lengths[i] + Math.sqrt(l2) * t; }
   }
   return normalizeS(path, s);
}
export interface RiderState { path: Path; s: number; position: Vec3; overflow?: number }
export function advance(state: RiderState, ds: number): RiderState {
   const distance = state.s + (Number.isFinite(ds) ? ds : 0);
   state.s = normalizeS(state.path, distance);
   state.overflow = state.path.closed ? 0 : distance - state.s;
   pointAt(state.path, state.s, state.position);
   return state;
}
export interface PathGraph { segments: Path[]; next(segment: number, choice: number): number | null }
/** One row per segment; choices are outgoing segment indices at its end; invalid choices return null. */
export function createPathGraph(segments: readonly Path[], junctions: readonly (readonly number[])[]): PathGraph {
   const paths = [...segments], links = junctions.map((row) => [...row]);
   return {
      segments: paths,
      next(segment, choice) {
         const next = links[segment]?.[choice];
         return Number.isInteger(segment) && Number.isInteger(choice) && next !== undefined && Number.isInteger(next) && next >= 0 && next < paths.length ? next : null;
      },
   };
}

/** Forward graph traversal. choose receives the ending segment index and returns an outgoing path index.
 * Missing links, reverse travel and zero-length cycles leave the unconsumed distance in overflow. */
export function advanceGraph(state: RiderState, graph: PathGraph, choose: (junction: number) => number, ds: number): RiderState {
   advance(state, ds);
   let zeroLengthHops = 0;
   while ((state.overflow ?? 0) > 0) {
      const index = graph.segments.indexOf(state.path);
      if (index < 0) break;
      const next = choose(index);
      let linked = false;
      for (let choice = 0; ; choice++) {
         const candidate = graph.next(index, choice);
         if (candidate === null) break;
         if (candidate === next) { linked = true; break; }
      }
      if (!linked) break;
      const path = graph.segments[next];
      if (path.total === 0) { if (++zeroLengthHops > graph.segments.length) break; }
      else zeroLengthHops = 0;
      const remaining = state.overflow ?? 0;
      state.path = path; state.s = 0;
      advance(state, remaining);
   }
   return state;
}
