// Frame-time statistics behind the perf probe (core/perfProbe.tsx). Pure, no allocation after
// createFrameStats(): a ring buffer of the last frame times and a scratch copy that is sorted in
// place when percentiles are asked for.

export interface FrameStats {
   /** last `capacity` frame times (ms), oldest overwritten */
   readonly ring: Float32Array;
   /** sorted copy for percentiles */
   readonly sorted: Float32Array;
   /** samples written so far (saturates at the capacity for percentiles) */
   count: number;
   /** next write index */
   next: number;
}

export function createFrameStats(capacity = 600): FrameStats {
   const n = Math.max(1, Math.floor(capacity));
   return { ring: new Float32Array(n), sorted: new Float32Array(n), count: 0, next: 0 };
}

export function pushFrame(stats: FrameStats, ms: number): void {
   if (!(ms >= 0) || !Number.isFinite(ms)) return;
   stats.ring[stats.next] = ms;
   stats.next = (stats.next + 1) % stats.ring.length;
   if (stats.count < stats.ring.length) stats.count += 1;
}

export interface FramePercentiles {
   p50: number;
   p95: number;
   max: number;
}

/**
 * p50, p95 and max of the samples in the ring, written into `out` (nearest-rank percentiles).
 * All 0 without samples.
 */
export function framePercentiles(stats: FrameStats, out: FramePercentiles): FramePercentiles {
   const n = stats.count;
   if (n === 0) {
      out.p50 = 0;
      out.p95 = 0;
      out.max = 0;
      return out;
   }
   const view = stats.sorted.subarray(0, n);
   view.set(stats.ring.subarray(0, n));
   view.sort();
   const rank = (p: number) => view[Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1))];
   out.p50 = rank(0.5);
   out.p95 = rank(0.95);
   out.max = view[n - 1];
   return out;
}

export function resetFrameStats(stats: FrameStats): void {
   stats.count = 0;
   stats.next = 0;
}
