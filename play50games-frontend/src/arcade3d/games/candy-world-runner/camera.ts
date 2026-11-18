// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the runner; it starts (and its auto-follow swings it
// back) behind the runner looking down the road (north, -z). It pulls back as you grow (the card: +1.2 m
// per size) and stands farther back on a portrait screen. The pivot leads the runner down the road. The
// intro flies from high over the candy castle at the end back down the road to the start.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import type { Course } from "./course";

const DEG = Math.PI / 180;

export const CANDY_ORBIT: Partial<OrbitSettings> = {
   yaw: 0,
   pitch: 20 * DEG,
   distance: 7,
   minDistance: 4,
   maxDistance: 16,
   autoFollow: true,
   autoFollowDelay: 1.2,
   autoFollowRate: 2.5,
   autoFollowMinSpeed: 3,
   autoFollowFullSpeed: 8,
};

export const FOV = 60;
export const FOV_PORTRAIT = 72;
/** the camera pulls back this much per size step (the card) */
export const PULL_PER_SIZE = 1.2;

export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.35 * portrait;
}

export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.3 + 0.25 * portrait;
}

/** The orbit's distance at a (drawn) size scale 0.7-1.4: +1.2 m per size step. */
export function distanceFor(sizeLevel: number): number {
   return (CANDY_ORBIT.distance ?? 7) + PULL_PER_SIZE * sizeLevel;
}

/** The pivot: over the runner, led down the road. */
export function orbitPivot(x: number, h: number, s: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = x * 0.6;
   out.y = h + 1.3;
   out.z = -s - 4;
   return out;
}

export function playCamera(course: Course, aspect: number): IntroKeyframe {
   void course;
   const p = orbitPivot(0, 0, 0, { x: 0, y: 0, z: 0 });
   const c = orbitPosition(p.x, p.y, p.z, 0, CANDY_ORBIT.pitch ?? 0, distanceFor(0) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** High over the castle at the end, then down the road (two thirds, one third), to the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const f = course.finishS;
   return [
      { position: [14, 22, -f + 10], lookAt: [0, 4, -f - 8] },
      { position: [-10, 9, -f * 0.6], lookAt: [0, 1, -f * 0.6 - 20] },
      { position: [9, 6, -f * 0.25], lookAt: [0, 1, -f * 0.25 - 18] },
   ];
}
