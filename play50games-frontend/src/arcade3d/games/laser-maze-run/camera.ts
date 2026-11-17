// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero (the stick then moves the hero relative to
// it); it starts (and its auto-follow swings it back) behind the hero looking down the corridor (north,
// -z), high enough to read the beams of the next room (the card: "tuned to keep the next interaction
// visible"), and stands farther back on a portrait screen. The intro flies from high over the exit back
// down the vault to the start.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import type { Course } from "./course";

const DEG = Math.PI / 180;

export const LASER_ORBIT: Partial<OrbitSettings> = {
   yaw: 0,
   pitch: 34 * DEG,
   distance: 8,
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

export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.35 * portrait;
}

export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.3 + 0.25 * portrait;
}

/** The pivot: over the runner, led down the track. */
export function orbitPivot(x: number, h: number, s: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = x * 0.7;
   out.y = Math.min(h, 2.4) * 0.5 + 1.1;
   out.z = -s - 2.5;
   return out;
}

export function playCamera(course: Course, aspect: number): IntroKeyframe {
   void course;
   const p = orbitPivot(0, 0, 0, { x: 0, y: 0, z: 0 });
   const c = orbitPosition(p.x, p.y, p.z, 0, LASER_ORBIT.pitch ?? 0, (LASER_ORBIT.distance ?? 8) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** High over the exit, then back down the vault (two thirds, one third), to the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const f = course.finishS;
   return [
      { position: [10, 18, -f + 6], lookAt: [0, 1, -f - 4] },
      { position: [-6, 9, -f * 0.6], lookAt: [0, 0.5, -f * 0.6 - 10] },
      { position: [5, 7, -f * 0.25], lookAt: [0, 0.5, -f * 0.25 - 10] },
   ];
}
