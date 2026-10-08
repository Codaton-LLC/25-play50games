// The point history behind <Trail> (Trail.tsx). Pure, no allocation after createTrailHistory():
// points are kept newest first in one Float32Array (x, y, z triplets).

export interface TrailHistory {
   readonly capacity: number;
   readonly points: Float32Array;
   /** points in use (newest at index 0) */
   count: number;
   /** fraction of a point waiting to be dropped from the tail while the target stands still */
   shrink: number;
}

export function createTrailHistory(capacity: number): TrailHistory {
   const n = Math.max(2, Math.floor(capacity));
   return { capacity: n, points: new Float32Array(n * 3), count: 0, shrink: 0 };
}

/**
 * Follows the target to (x, y, z): a new point once it is `minDistance` from the newest one (the
 * oldest falls off a full history), otherwise the newest point moves with it and the tail shrinks
 * at `fadeRate` points per second (dt in s), so a standing target's trail fades away.
 */
export function followTrail(
   history: TrailHistory,
   x: number,
   y: number,
   z: number,
   minDistance: number,
   fadeRate: number,
   dt: number
): void {
   const p = history.points;
   if (history.count === 0) {
      p[0] = x;
      p[1] = y;
      p[2] = z;
      history.count = 1;
      history.shrink = 0;
      return;
   }
   // index 0 is the live end (the target); a point is fixed behind it once the target is
   // minDistance from the newest fixed point (index 1, or the lone anchor)
   const ref = history.count > 1 ? 3 : 0;
   const moved = Math.hypot(x - p[ref], y - p[ref + 1], z - p[ref + 2]);
   if (moved >= minDistance) {
      const keep = Math.min(history.count, history.capacity - 1);
      p.copyWithin(3, 0, keep * 3);
      history.count = keep + 1;
      history.shrink = 0;
   } else if (history.count === 1) {
      return; // a lone point is the anchor: it waits for the target to move away
   } else if (dt > 0) {
      history.shrink += fadeRate * dt;
      while (history.shrink >= 1 && history.count > 1) {
         history.count -= 1;
         history.shrink -= 1;
      }
   }
   p[0] = x;
   p[1] = y;
   p[2] = z;
}

export function clearTrail(history: TrailHistory): void {
   history.count = 0;
   history.shrink = 0;
}
