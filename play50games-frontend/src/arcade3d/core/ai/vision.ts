import type { Vec3Like as Vec3, AABB } from "../collision";
export type Box = AABB;
/** Horizontal cone; yaw 0 faces +Z, positive yaw faces +X. Boundaries are visible. */
export function inViewCone(origin: Vec3, yaw: number, halfAngle: number, range: number, target: Vec3): boolean {
   const x = target.x - origin.x, z = target.z - origin.z, d = Math.hypot(x, z);
   if (range < 0 || halfAngle < 0 || d > range) return false;
   if (d === 0 || halfAngle >= Math.PI) return true;
   return (x * Math.sin(yaw) + z * Math.cos(yaw)) / d >= Math.cos(halfAngle) - 1e-14;
}
/** Segment versus closed XZ slabs: grazing a corner, or starting inside, blocks sight. */
export function hasLineOfSightXZ(a: Vec3, b: Vec3, blockers: readonly Box[]): boolean {
   for (let i = 0; i < blockers.length; i++) {
      const box = blockers[i];
      let lo = 0, hi = 1;
      const dx = b.x - a.x, dz = b.z - a.z;
      if (dx === 0) { if (a.x < box.min.x || a.x > box.max.x) continue; }
      else {
         const t0 = (box.min.x - a.x) / dx, t1 = (box.max.x - a.x) / dx;
         lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1));
      }
      if (dz === 0) { if (a.z < box.min.z || a.z > box.max.z) continue; }
      else {
         const t0 = (box.min.z - a.z) / dz, t1 = (box.max.z - a.z) / dz;
         lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1));
      }
      if (lo <= hi) return false;
   }
   return true;
}
