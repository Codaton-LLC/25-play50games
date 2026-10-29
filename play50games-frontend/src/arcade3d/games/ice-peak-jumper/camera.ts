// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero; it starts behind the hero looking up the
// first run (north, -z), and its auto-follow swings it behind the slide (slowly: on ice you often slide
// sideways to aim). The pivot is the hero's chest, led a little along the slide. It stands farther back
// on a portrait screen and widens its view +6 degrees above 7 m/s (the card's speed juice). The intro's
// fly-through (core/intro) starts high over the summit and comes down the climb to the start.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import type { Course } from "./course";

const DEG = Math.PI / 180;

export const PEAK_ORBIT: Partial<OrbitSettings> = {
   yaw: 0,
   pitch: 24 * DEG,
   distance: 8.5,
   minDistance: 4,
   maxDistance: 18,
   autoFollow: true,
   autoFollowDelay: 2,
   autoFollowRate: 1.2,
   autoFollowMinSpeed: 2.5,
   autoFollowFullSpeed: 8,
};

export const FOV = 58;
export const FOV_PORTRAIT = 70;
/** the view widens this much (degrees) at full slide, from 7 m/s (the card) */
export const FOV_SPEED = 6;

/** The field of view for an aspect at a slide speed (m/s). */
export function fovFor(aspect: number, speed: number): number {
   const base = aspect < 1 ? FOV_PORTRAIT : FOV;
   return base + FOV_SPEED * Math.max(0, Math.min(1, (speed - 7) / 2));
}

export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.35 * portrait;
}

export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.3 + 0.2 * portrait;
}

/** The orbit's pivot: the hero's chest, led along the slide (at most 2 m). */
export function orbitPivot(x: number, y: number, z: number, vx: number, vz: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = x + Math.max(-2, Math.min(2, vx * 0.2));
   out.y = y + 1.2;
   out.z = z + Math.max(-2, Math.min(2, vz * 0.2));
   return out;
}

/** The orbit camera's first pose at the start (the intro ends on it). */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const s = course.plats[course.start];
   const p = orbitPivot(s.x, s.y, s.z, 0, 0, { x: 0, y: 0, z: 0 });
   const c = orbitPosition(p.x, p.y, p.z, PEAK_ORBIT.yaw ?? 0, PEAK_ORBIT.pitch ?? 0, (PEAK_ORBIT.distance ?? 8) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** The fly-through: high over the summit, then down the climb (a third and two thirds), to the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const g = course.plats[course.goal];
   const r = course.route;
   const at = (f: number) => course.plats[r[Math.max(0, Math.min(r.length - 1, Math.round((r.length - 1) * f)))]];
   const a = at(0.66);
   const b = at(0.33);
   return [
      { position: [g.x + 16, g.y + 16, g.z + 16], lookAt: [g.x, g.y + 1, g.z] },
      { position: [a.x - 14, a.y + 9, a.z + 12], lookAt: [a.x, a.y, a.z] },
      { position: [b.x + 14, b.y + 7, b.z + 12], lookAt: [b.x, b.y, b.z] },
   ];
}
