// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): free to turn round the hero (mouse drag, two fingers, keys), and when left alone it
// swings back behind the way he runs (autoFollow). It sits a little high so the cube sets below read.
// The fly-through (core/intro) sweeps over the field from the goal and ends on the orbit's first pose.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import type { Course } from "./course";

const DEG = Math.PI / 180;
export const FOV = 60;
export const FOV_PORTRAIT = 72;

/** The orbit's tuning: behind the start, looking north up the field. */
export function neonOrbit(course: Course): Partial<OrbitSettings> {
   return { yaw: 0, pitch: (course.boss ? 30 : 26) * DEG, distance: 8, minDistance: 3.5, maxDistance: 18, autoFollow: true, autoFollowDelay: 1.8, autoFollowRate: 1.4, autoFollowMinSpeed: 1, autoFollowFullSpeed: 4 };
}

export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.35 * portrait;
}

export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.6 + 0.4 * portrait;
}

/** The pivot: over the hero's shoulders. */
export function heroPivot(p: { x: number; y: number; z: number }, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = p.x;
   out.y = p.y + 1.3;
   out.z = p.z;
   return out;
}

/** The orbit's first pose (the intro ends on it). */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const o = neonOrbit(course);
   const d = (o.distance ?? 8) * orbitScale(aspect);
   const s = course.cubes[course.start];
   const p = heroPivot({ x: s.x, y: s.top, z: s.z }, { x: 0, y: 0, z: 0 });
   const cam = orbitPosition(p.x, p.y, p.z, o.yaw ?? 0, o.pitch ?? 0, d, { x: 0, y: 0, z: 0 });
   return { position: [cam.x, cam.y, cam.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** The fly-through: high over the goal (or Flipframe), down the field, to the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const g = course.boss ? { x: course.boss.x, top: 6, z: course.boss.z } : course.cubes[course.goal];
   const s = course.cubes[course.start];
   const mx = (g.x + s.x) / 2;
   const mz = (g.z + s.z) / 2;
   return [
      { position: [g.x + 12, g.top + 14, g.z - 10], lookAt: [g.x, g.top, g.z] },
      { position: [mx - 14, 9, mz], lookAt: [mx, 1, mz] },
      { position: [s.x, s.top + 5, s.z + 10], lookAt: [s.x, s.top + 1, s.z - 4] },
   ];
}
