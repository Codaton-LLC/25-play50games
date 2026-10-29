// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero (mouse drag, two fingers, keys). The camera
// is also the aim: a throw flies where the camera looks (rules.ts: heading = yaw + pi), so the orbit
// starts behind the hero looking north into the courtyard, a little above his head. The intro's
// fly-through (core/intro) circles the courtyard and ends on exactly the orbit's first pose.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import { COLUMN_H } from "./assets";
import type { Course } from "./course";

const DEG = Math.PI / 180;
export const FOV = 55;
export const FOV_PORTRAIT = 68;

/** The orbit's tuning: behind the hero (yaw 0 = the camera on +z, looking north), low enough to aim along. */
export function discOrbit(course: Course): Partial<OrbitSettings> {
   return { yaw: 0, pitch: (course.boss ? 16 : 13) * DEG, distance: 6.5, minDistance: 3, maxDistance: 16, autoFollow: false };
}

/** How much farther the orbit stands on a portrait screen. */
export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.35 * portrait;
}

/** How far over the pivot the camera looks: up the courtyard, so the targets fill the view. */
export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.9 + 0.4 * portrait;
}

/** The pivot: over the hero's shoulders. */
export function heroPivot(h: { x: number; z: number }, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = h.x;
   out.y = 1.6;
   out.z = h.z;
   return out;
}

/** The orbit's first pose (the intro ends on it). */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const o = discOrbit(course);
   const d = (o.distance ?? 6.5) * orbitScale(aspect);
   const p = heroPivot({ x: course.startX, z: course.startZ }, { x: 0, y: 0, z: 0 });
   const cam = orbitPosition(p.x, p.y, p.z, o.yaw ?? 0, o.pitch ?? 0, d, { x: 0, y: 0, z: 0 });
   return { position: [cam.x, cam.y, cam.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** The fly-through: high over the pavilion, round the courtyard (level 5: past Mother Snapper), to the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const b = course.boss;
   return [
      { position: [14, 16, -24], lookAt: [0, 2, -6] },
      b ? { position: [-9, 7, -2], lookAt: [b.x, 5, b.z] } : { position: [-12, 6, -6], lookAt: [0, 1, -8] },
      { position: [course.startX, 3.5, course.startZ + 7], lookAt: [course.startX, 2.2, course.startZ - 2] },
   ];
}

/**
 * The orbit camera's collision: the columns near the camera. The courtyard walls are low (2.4 m) and
 * the camera rides over them, so a view from outside the yard is never pulled in onto the hero.
 */
export function courseSolids(c: Course, x: number, z: number, out: AABB[]): number {
   let n = 0;
   for (const col of c.columns) {
      if (n >= out.length) break;
      if (Math.hypot(col.x - x, col.z - z) > 14) continue;
      const o = out[n++];
      o.min.x = col.x - col.r;
      o.max.x = col.x + col.r;
      o.min.y = 0;
      o.max.y = COLUMN_H;
      o.min.z = col.z - col.r;
      o.max.z = col.z + col.r;
   }
   return n;
}
