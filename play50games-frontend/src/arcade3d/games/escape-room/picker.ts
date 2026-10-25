// Badge hit test for Tiny Escape Room. Pure: no three.js objects, no allocation.
// A station or the door is inspected by tapping a camera-facing square above its anchor.
// The square's world size is chosen so it covers BADGE_PX css pixels at the current depth.
import { DOOR_ID, NONE, type EscapeRun } from "./rules";

export const BADGE_PX = 44;
export const MARKER_PX = 24;

/** The badge's fill and ring opacity: solid to inspect, see-through over loot that is on show. */
export const BADGE_LOOK = { fill: 0.92, ring: 1, takeFill: 0.2, takeRing: 0.5 } as const;

/**
 * Is the badge over station `id` the "take" badge of an opened, filled container? Its loot sits
 * right under it: the 44 px square is wider than a whole station on a phone (about 20 px per m).
 */
export function badgeShowsLoot(run: EscapeRun, id: number): boolean {
   if (id < 0 || id === DOOR_ID || id >= run.stations.length) return false;
   const item = run.layout.stations[id].item;
   return item !== NONE && run.stations[id].phase === "open" && run.items[item].visible;
}

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
