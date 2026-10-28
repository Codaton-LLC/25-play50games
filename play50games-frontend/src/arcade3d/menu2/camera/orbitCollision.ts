// Orbit camera collision (pure, no three.js, no allocation): a sphere cast from the pivot towards
// the camera against the game's solid boxes, approximated by a ray against each box grown by the
// camera's radius (the Minkowski box; its rounded edges are a little generous, which only pulls in
// a hair early). The camera then sits just in front of the first hit, so a platform or wall between
// the camera and the hero never hides the hero. `stepOrbitClip` eases the result: in at once, out slowly.
import type { AABB } from "@/arcade3d/core/collision";
import { orbitDirection } from "./orbit";

/**
 * Where the segment from (ox, oy, oz) along the unit direction (dx, dy, dz) for `length` m first
 * enters `box` grown by `radius`: the distance along it (0..length), or -1 for no hit. A segment that
 * starts inside the box itself does not count (the pivot is in the stone: nothing to pull in front
 * of). One that starts only inside the grown margin (the hero stands against a wall) is tested
 * against the box itself, so a turn towards that wall still stops at its face instead of passing
 * through it.
 */
export function rayBoxDistance(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, length: number, box: AABB, radius: number): number {
   let tMin = 0;
   let tMax = length;
   // x slab
   const x0 = box.min.x - radius;
   const x1 = box.max.x + radius;
   if (Math.abs(dx) < 1e-12) {
      if (ox < x0 || ox > x1) return -1;
   } else {
      let a = (x0 - ox) / dx;
      let b = (x1 - ox) / dx;
      if (a > b) {
         const t = a;
         a = b;
         b = t;
      }
      if (a > tMin) tMin = a;
      if (b < tMax) tMax = b;
      if (tMin > tMax) return -1;
   }
   const y0 = box.min.y - radius;
   const y1 = box.max.y + radius;
   if (Math.abs(dy) < 1e-12) {
      if (oy < y0 || oy > y1) return -1;
   } else {
      let a = (y0 - oy) / dy;
      let b = (y1 - oy) / dy;
      if (a > b) {
         const t = a;
         a = b;
         b = t;
      }
      if (a > tMin) tMin = a;
      if (b < tMax) tMax = b;
      if (tMin > tMax) return -1;
   }
   const z0 = box.min.z - radius;
   const z1 = box.max.z + radius;
   if (Math.abs(dz) < 1e-12) {
      if (oz < z0 || oz > z1) return -1;
   } else {
      let a = (z0 - oz) / dz;
      let b = (z1 - oz) / dz;
      if (a > b) {
         const t = a;
         a = b;
         b = t;
      }
      if (a > tMin) tMin = a;
      if (b < tMax) tMax = b;
      if (tMin > tMax) return -1;
   }
   // starts inside the grown box: tMin stayed 0 because every slab already contained the origin
   const inside = ox >= x0 && ox <= x1 && oy >= y0 && oy <= y1 && oz >= z0 && oz <= z1;
   if (inside) return radius > 0 ? rayBoxDistance(ox, oy, oz, dx, dy, dz, length, box, 0) : -1;
   return tMin;
}

export interface ClipOptions {
   /** the camera's radius (m): how far it keeps from a surface. Default 0.3 */
   radius?: number;
   /** never closer to the pivot than this (m) while that is clear. Default 1.2 */
   minDistance?: number;
   /**
    * When a box is nearer than minDistance (the hero against a wall in a narrow trench), the camera
    * may come in to this (m) rather than sit inside the stone. Default minDistance (never closer).
    */
   squeeze?: number;
   /**
    * When the view is blocked closer than minDistance, the camera may rise (pitch up, radians) to at
    * most this pitch to see over the wall instead of squeezing against it (OrbitCamera, liftOrbitPitch).
    * Default none.
    */
   liftTo?: number;
}

/**
 * The longest camera distance (<= `distance`) from the pivot along the unit direction (dx, dy, dz)
 * that no box in `boxes[0..count)` blocks. Cheap: one slab test per box.
 */
export function clipOrbitDistance(
   px: number,
   py: number,
   pz: number,
   dx: number,
   dy: number,
   dz: number,
   distance: number,
   boxes: readonly AABB[],
   count: number = boxes.length,
   options: ClipOptions = {},
): number {
   const radius = options.radius ?? 0.3;
   const minDistance = Math.min(distance, options.minDistance ?? 1.2);
   const squeeze = Math.min(minDistance, Math.max(0, options.squeeze ?? minDistance));
   let best = distance;
   const n = Math.min(count, boxes.length);
   for (let i = 0; i < n; i++) {
      const t = rayBoxDistance(px, py, pz, dx, dy, dz, best, boxes[i], radius);
      if (t >= 0 && t < best) best = t;
   }
   return best >= minDistance ? best : Math.max(squeeze, best);
}

/**
 * Eases the drawn distance `current` towards the clipped `target`: a shorter target is taken at once
 * (the hero is never hidden, not even for a frame), a longer one comes back at `rate` (1/s).
 */
export function stepOrbitClip(current: number, target: number, dt: number, rate = 3): number {
   if (!Number.isFinite(current) || target <= current) return target;
   return current + (target - current) * (1 - Math.exp(-rate * Math.max(0, dt)));
}

const LIFT_DIR = { x: 0, y: 0, z: 0 };

/**
 * The pitch to draw at when a wall blocks the view: `pitch` itself while the view is clear to at
 * least max(minDistance, 0.6 x distance); otherwise the lowest pitch up to `liftTo` (in `steps`) that
 * is, or failing that the one that sees farthest. Pure; no allocation.
 */
export function liftOrbitPitch(
   px: number,
   py: number,
   pz: number,
   yaw: number,
   pitch: number,
   distance: number,
   boxes: readonly AABB[],
   count: number,
   options: ClipOptions,
   steps = 8,
): number {
   const liftTo = options.liftTo;
   if (liftTo === undefined || !(liftTo > pitch)) return pitch;
   const enough = Math.min(distance, Math.max(options.minDistance ?? 1.2, distance * 0.6));
   const clearAt = (p: number) => {
      orbitDirection(yaw, p, LIFT_DIR);
      return clipOrbitDistance(px, py, pz, LIFT_DIR.x, LIFT_DIR.y, LIFT_DIR.z, distance, boxes, count, options);
   };
   let best = clearAt(pitch);
   if (best >= enough) return pitch;
   let bestPitch = pitch;
   for (let i = 1; i <= steps; i++) {
      const p = pitch + ((liftTo - pitch) * i) / steps;
      const d = clearAt(p);
      if (d >= enough) return p;
      if (d > best + 1e-6) {
         best = d;
         bestPitch = p;
      }
   }
   return bestPitch;
}
