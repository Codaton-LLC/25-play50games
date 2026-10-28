// Orbit camera collision (ported from menu2/camera; pure, no three.js, no allocation): a sphere cast from the pivot towards
// the camera against the game's solid boxes, approximated by a ray against each box grown by the
// camera's radius (the Minkowski box; its rounded edges are a little generous, which only pulls in
// a hair early). The camera then sits just in front of the first hit, so a platform or wall between
// the camera and the hero never hides the hero. `stepOrbitClip` eases the result: in at once, out slowly.
import type { AABB } from "@/arcade3d/core/collision";

/**
 * Where the segment from (ox, oy, oz) along the unit direction (dx, dy, dz) for `length` m first
 * enters `box` grown by `radius`: the distance along it (0..length), or -1 for no hit. A segment that
 * starts inside the grown box does not count (the hero stands next to that box: it cannot block).
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
   // starts inside: tMin stayed 0 because every slab already contained the origin
   const inside = ox >= x0 && ox <= x1 && oy >= y0 && oy <= y1 && oz >= z0 && oz <= z1;
   if (inside) return -1;
   return tMin;
}

export interface ClipOptions {
   /** the camera's radius (m): how far it keeps from a surface. Default 0.3 */
   radius?: number;
   /** never closer to the pivot than this (m). Default 1.2 */
   minDistance?: number;
   /**
    * a box the ray enters closer to the pivot than this (m) is beside the hero (it stands against a
    * wall or a parked van), not between the hero and the camera: it does not pull the camera in.
    * Default 0 (every box counts, as in Menu 2)
    */
   ignoreNear?: number;
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
   const near = options.ignoreNear ?? 0;
   let best = distance;
   const n = Math.min(count, boxes.length);
   for (let i = 0; i < n; i++) {
      const t = rayBoxDistance(px, py, pz, dx, dy, dz, best, boxes[i], radius);
      if (t >= near && t < best) best = t;
   }
   return Math.max(minDistance, best);
}

/**
 * Eases the drawn distance `current` towards the clipped `target`: a shorter target is taken at once
 * (the hero is never hidden, not even for a frame), a longer one comes back at `rate` (1/s).
 */
export function stepOrbitClip(current: number, target: number, dt: number, rate = 3): number {
   if (!Number.isFinite(current) || target <= current) return target;
   return current + (target - current) * (1 - Math.exp(-rate * Math.max(0, dt)));
}
