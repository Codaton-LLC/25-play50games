// Badge hit test for Tiny Escape Room. Pure: no three.js objects, no allocation.
// A station or the door is inspected by tapping a camera-facing square above its anchor.
// The square's world size is chosen so it covers BADGE_PX css pixels at the current depth.

export const BADGE_PX = 44;
export const MARKER_PX = 24;

/** World length of a css-pixel sprite facing the camera. fovDeg is the vertical field of view. */
export function screenSpriteSize(depth: number, fovDeg: number, canvasHeight: number, cssPx: number): number {
   if (!(depth > 0) || !(canvasHeight > 0) || !(cssPx > 0)) return 0;
   return (cssPx * 2 * depth * Math.tan((fovDeg * Math.PI) / 360)) / canvasHeight;
}

/**
 * Does the ray (origin + t * direction) hit the camera-facing square?
 * normal / right / up are unit axes of the billboard. half is half the world side.
 * A hit behind the camera (t <= 0) or off the square is a miss. Nothing is allocated.
 */
export function hitsBillboard(
   ox: number, oy: number, oz: number,
   dx: number, dy: number, dz: number,
   px: number, py: number, pz: number,
   nx: number, ny: number, nz: number,
   rx: number, ry: number, rz: number,
   ux: number, uy: number, uz: number,
   half: number,
): boolean {
   const denom = dx * nx + dy * ny + dz * nz;
   if (!(Math.abs(denom) > 1e-8)) return false;
   const t = ((px - ox) * nx + (py - oy) * ny + (pz - oz) * nz) / denom;
   if (!(t > 0)) return false;
   const hx = ox + dx * t - px;
   const hy = oy + dy * t - py;
   const hz = oz + dz * t - pz;
   const lx = hx * rx + hy * ry + hz * rz;
   const ly = hx * ux + hy * uy + hz * uz;
   return Math.abs(lx) <= half + 1e-6 && Math.abs(ly) <= half + 1e-6;
}
