import { active, type Ghost } from "./rules";

// Drawn sheet (Ghosts.tsx): radius 0.5, from the 0.1 base to 0.1 + 1.45 (body,
// tail and bob), all scaled by 1.2 for the big ghost.
const RADIUS = 0.5, BASE = 0.1, HEIGHT = 1.45;
export interface AimRay { ox: number; oy: number; oz: number; dx: number; dy: number; dz: number }
const scaleOf = (g: Ghost) => g.kind === "big" ? 1.2 : 1;

/** Index of the nearest shown ghost whose drawn sheet the pointer ray crosses, or -1. */
export function pickGhost(ray: AimRay, ghosts: readonly Ghost[]): number {
   let best = -1, bestT = Infinity;
   const a = ray.dx * ray.dx + ray.dz * ray.dz;
   if (a < 1e-12) return -1;
   for (let k = 0; k < ghosts.length; k++) {
      const g = ghosts[k];
      if (!active(g) || g.mode === "hidden") continue;
      const s = scaleOf(g), r = RADIUS * s, fx = ray.ox - g.x, fz = ray.oz - g.z;
      const b = 2 * (fx * ray.dx + fz * ray.dz), c = fx * fx + fz * fz - r * r, disc = b * b - 4 * a * c;
      if (disc < 0) continue;
      const root = Math.sqrt(disc), t0 = Math.max(0, (-b - root) / (2 * a)), t1 = (-b + root) / (2 * a);
      if (t1 < 0) continue;
      const y0 = ray.oy + ray.dy * t0, y1 = ray.oy + ray.dy * t1, lo = BASE, hi = BASE + HEIGHT * s;
      if (Math.max(y0, y1) < lo || Math.min(y0, y1) > hi) continue;
      if (t0 < bestT) { bestT = t0; best = k; }
   }
   return best;
}
