// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): free to turn round the hero (mouse drag, two fingers, keys), and when left alone it
// swings back behind the walk (autoFollow). It tilts slowly with the needle (the card: up to 6 deg).
// The fly-through (core/intro) sweeps down the gorge from the far side and ends on the orbit's first pose.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import { linkPoint, type Course } from "./course";

const DEG = Math.PI / 180;
export const FOV = 58;
export const FOV_PORTRAIT = 70;
/** the most the camera rolls with the needle (rad) */
export const TILT_MAX = 6 * DEG;

/** The camera's yaw behind a walk heading (dx, dz): it sits at pivot + (sin yaw, cos yaw) * d. */
export function yawBehind(dx: number, dz: number): number {
   return Math.atan2(-dx, -dz);
}

/** The orbit's tuning: behind the first link, a little above, swinging behind the walk when left alone. */
export function tightOrbit(course: Course): Partial<OrbitSettings> {
   const l = course.links[course.links[course.start].next];
   return { yaw: yawBehind(l.dx, l.dz), pitch: (course.arenaStart >= 0 ? 20 : 17) * DEG, distance: 6, minDistance: 3, maxDistance: 14, autoFollow: true, autoFollowDelay: 1.6, autoFollowRate: 1.6, autoFollowMinSpeed: 0.4, autoFollowFullSpeed: 2 };
}

/** How much farther the orbit stands on a portrait screen. */
export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.4 * portrait;
}

/** How far over the pivot the camera looks (ahead along the rope). */
export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.4 + 0.3 * portrait;
}

/** The roll for a needle `lean` (-1.6..1.6): the camera tips with it, capped at TILT_MAX. */
export function tiltFor(lean: number): number {
   return -Math.max(-1, Math.min(1, lean)) * TILT_MAX;
}

/** The pivot: over the hero's shoulders. */
export function heroPivot(p: { x: number; y: number; z: number }, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = p.x;
   out.y = p.y + 1.5;
   out.z = p.z;
   return out;
}

/** The orbit's first pose (the intro ends on it). */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const o = tightOrbit(course);
   const d = (o.distance ?? 6) * orbitScale(aspect);
   const start = course.links[course.start];
   const at = linkPoint(start, 0.5, { x: 0, y: 0, z: 0 });
   const p = heroPivot(at, { x: 0, y: 0, z: 0 });
   const cam = orbitPosition(p.x, p.y, p.z, o.yaw ?? 0, o.pitch ?? 0, d, { x: 0, y: 0, z: 0 });
   return { position: [cam.x, cam.y, cam.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** The fly-through: high over the far end of the gorge, down along the path, to the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const goal = course.links[course.goal];
   const mid = course.links[Math.floor(course.goal / 2)];
   const start = course.links[course.start];
   return [
      { position: [goal.bx + 10, goal.by + 12, goal.bz - 8], lookAt: [goal.bx, goal.by - 2, goal.bz] },
      { position: [mid.ax - 9, mid.ay + 3, mid.az + 2], lookAt: [mid.bx, mid.by, mid.bz] },
      { position: [start.ax + 2, start.ay + 4, start.az + 9], lookAt: [start.ax, start.ay + 1, start.az - 4] },
   ];
}
