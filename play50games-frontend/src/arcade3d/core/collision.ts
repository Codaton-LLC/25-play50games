// Pure collision helpers for arcade games. Owned by Claude.
// No three.js import: they take anything with x/y/z (a THREE.Vector3 works), so they are cheap
// to call every frame and easy to unit-test. Pass `out` to reuse an object instead of creating one.

export interface Vec3Like {
   x: number;
   y: number;
   z: number;
}

/** Axis-aligned box. */
export interface AABB {
   min: Vec3Like;
   max: Vec3Like;
}

/** Box from its centre and half size (width/2, height/2, depth/2). */
export function aabbFromCenter(center: Vec3Like, half: Vec3Like, out?: AABB): AABB {
   const box = out ?? { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
   box.min.x = center.x - half.x;
   box.min.y = center.y - half.y;
   box.min.z = center.z - half.z;
   box.max.x = center.x + half.x;
   box.max.y = center.y + half.y;
   box.max.z = center.z + half.z;
   return box;
}

/** Boxes overlap (touching edges count). */
export function aabbOverlap(a: AABB, b: AABB): boolean {
   return (
      a.min.x <= b.max.x &&
      a.max.x >= b.min.x &&
      a.min.y <= b.max.y &&
      a.max.y >= b.min.y &&
      a.min.z <= b.max.z &&
      a.max.z >= b.min.z
   );
}

/** Point inside (or on the surface of) a box. */
export function pointInAabb(p: Vec3Like, box: AABB): boolean {
   return (
      p.x >= box.min.x &&
      p.x <= box.max.x &&
      p.y >= box.min.y &&
      p.y <= box.max.y &&
      p.z >= box.min.z &&
      p.z <= box.max.z
   );
}

export function distanceSq(a: Vec3Like, b: Vec3Like): number {
   const dx = a.x - b.x;
   const dy = a.y - b.y;
   const dz = a.z - b.z;
   return dx * dx + dy * dy + dz * dz;
}

/** Sphere / sphere overlap (touching counts). */
export function spheresOverlap(aCenter: Vec3Like, aRadius: number, bCenter: Vec3Like, bRadius: number): boolean {
   const r = aRadius + bRadius;
   return distanceSq(aCenter, bCenter) <= r * r;
}

/** Same as spheresOverlap but ignores height: circles on the ground plane (top-down games). */
export function circlesOverlapXZ(aCenter: Vec3Like, aRadius: number, bCenter: Vec3Like, bRadius: number): boolean {
   const dx = aCenter.x - bCenter.x;
   const dz = aCenter.z - bCenter.z;
   const r = aRadius + bRadius;
   return dx * dx + dz * dz <= r * r;
}

/** Closest point of a box to `p`. */
export function closestPointInAabb(p: Vec3Like, box: AABB, out?: Vec3Like): Vec3Like {
   const o = out ?? { x: 0, y: 0, z: 0 };
   o.x = Math.min(Math.max(p.x, box.min.x), box.max.x);
   o.y = Math.min(Math.max(p.y, box.min.y), box.max.y);
   o.z = Math.min(Math.max(p.z, box.min.z), box.max.z);
   return o;
}

/** Sphere / box overlap (touching counts). */
export function sphereAabbOverlap(center: Vec3Like, radius: number, box: AABB): boolean {
   const cx = Math.min(Math.max(center.x, box.min.x), box.max.x);
   const cy = Math.min(Math.max(center.y, box.min.y), box.max.y);
   const cz = Math.min(Math.max(center.z, box.min.z), box.max.z);
   const dx = center.x - cx;
   const dy = center.y - cy;
   const dz = center.z - cz;
   return dx * dx + dy * dy + dz * dz <= radius * radius;
}

/**
 * Pushes a sphere out of a box along the shortest way (walls, crates).
 * Returns the corrected centre; pass `out = center` to correct in place.
 * A sphere that does not touch the box is returned unchanged.
 */
export function resolveSphereAabb(center: Vec3Like, radius: number, box: AABB, out?: Vec3Like): Vec3Like {
   const o = out ?? { x: center.x, y: center.y, z: center.z };
   if (o !== center) {
      o.x = center.x;
      o.y = center.y;
      o.z = center.z;
   }
   const cx = Math.min(Math.max(center.x, box.min.x), box.max.x);
   const cy = Math.min(Math.max(center.y, box.min.y), box.max.y);
   const cz = Math.min(Math.max(center.z, box.min.z), box.max.z);
   const dx = center.x - cx;
   const dy = center.y - cy;
   const dz = center.z - cz;
   const distSq = dx * dx + dy * dy + dz * dz;
   if (distSq > radius * radius) return o;

   if (distSq > 1e-12) {
      // centre outside the box: push along the contact normal
      const dist = Math.sqrt(distSq);
      const push = (radius - dist) / dist;
      o.x = center.x + dx * push;
      o.y = center.y + dy * push;
      o.z = center.z + dz * push;
      return o;
   }

   // centre inside the box: leave through the nearest face
   let depth = center.x - box.min.x;
   let axis: "x" | "y" | "z" = "x";
   let value = box.min.x - radius;
   const consider = (d: number, a: "x" | "y" | "z", v: number) => {
      if (d < depth) {
         depth = d;
         axis = a;
         value = v;
      }
   };
   consider(box.max.x - center.x, "x", box.max.x + radius);
   consider(center.y - box.min.y, "y", box.min.y - radius);
   consider(box.max.y - center.y, "y", box.max.y + radius);
   consider(center.z - box.min.z, "z", box.min.z - radius);
   consider(box.max.z - center.z, "z", box.max.z + radius);
   o[axis] = value;
   return o;
}

/**
 * Keeps a point (optionally a sphere of `margin` radius) inside bounds, e.g. the play area.
 * Returns the clamped point; pass `out = point` to clamp in place.
 */
export function clampToBounds(point: Vec3Like, bounds: AABB, margin = 0, out?: Vec3Like): Vec3Like {
   const o = out ?? { x: 0, y: 0, z: 0 };
   o.x = clampAxis(point.x, bounds.min.x + margin, bounds.max.x - margin);
   o.y = clampAxis(point.y, bounds.min.y + margin, bounds.max.y - margin);
   o.z = clampAxis(point.z, bounds.min.z + margin, bounds.max.z - margin);
   return o;
}

/** min > max (bounds smaller than the margin) pins the value to the middle. */
function clampAxis(value: number, min: number, max: number): number {
   if (min > max) return (min + max) / 2;
   return value < min ? min : value > max ? max : value;
}

/** Horizontal (x/z) distance from a point to a box; 0 inside. E.g. spawn clearance from props. */
export function distanceToBoxXZ(x: number, z: number, box: AABB): number {
   const dx = Math.max(box.min.x - x, 0, x - box.max.x);
   const dz = Math.max(box.min.z - z, 0, z - box.max.z);
   return Math.hypot(dx, dz);
}

/** True when clampToBounds would move the point. */
export function isOutOfBounds(point: Vec3Like, bounds: AABB, margin = 0): boolean {
   return (
      point.x < bounds.min.x + margin ||
      point.x > bounds.max.x - margin ||
      point.y < bounds.min.y + margin ||
      point.y > bounds.max.y - margin ||
      point.z < bounds.min.z + margin ||
      point.z > bounds.max.z - margin
   );
}
