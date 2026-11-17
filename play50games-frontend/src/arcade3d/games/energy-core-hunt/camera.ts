// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero (the stick then moves the hero relative to
// it); it starts (and its auto-follow swings it back) south of the hero looking north over the arena
// towards the core gate, high enough to read the cores round the hero (the card: "stable framing"), and
// stands farther back on a portrait screen. The intro circles the arena from high up and drops to the start.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import type { Course } from "./course";

const DEG = Math.PI / 180;

export const CORE_ORBIT: Partial<OrbitSettings> = {
   yaw: 0,
   pitch: 40 * DEG,
   distance: 9,
   minDistance: 4,
   maxDistance: 18,
   autoFollow: true,
   autoFollowDelay: 1.5,
   autoFollowRate: 2,
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
   return 0.2 + 0.25 * portrait;
}

/** The pivot: over the hero, a little ahead (north). */
export function orbitPivot(x: number, h: number, z: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = x;
   out.y = Math.min(h, 2.4) * 0.5 + 1.0;
   out.z = z - 1.5;
   return out;
}

export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const p = orbitPivot(course.start.x, 0, course.start.z, { x: 0, y: 0, z: 0 });
   const c = orbitPosition(p.x, p.y, p.z, 0, CORE_ORBIT.pitch ?? 0, (CORE_ORBIT.distance ?? 9) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** High over the gate, round the side, then down behind the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const H = course.half;
   return [
      { position: [0, H * 1.6, -H * 1.6], lookAt: [0, 0, 0] },
      { position: [H * 1.5, H * 1.0, 0], lookAt: [0, 0, 0] },
      { position: [-H * 0.6, H * 0.8, H * 1.4], lookAt: [0, 0, 0] },
   ];
}
