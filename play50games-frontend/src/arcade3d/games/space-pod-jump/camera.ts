// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): it looks at the play plane from +z (yaw 0) and the player turns it freely round the hero.
// On top of it the Scene rolls the view so the local "down" (the body the hero stands on or falls to) is
// the bottom of the screen, never faster than 25 degrees a second (the card's motion-sickness limit),
// and a HUD switch keeps "up" fixed instead. The intro's fly-through (core/intro) ends on playCamera.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import type { Course } from "./rules";

const DEG = Math.PI / 180;

export const POD_ORBIT: Partial<OrbitSettings> = {
   yaw: 0,
   pitch: 6 * DEG,
   distance: 17,
   minDistance: 7,
   maxDistance: 40,
};

export const FOV = 52;
export const FOV_PORTRAIT = 66;
/** the camera roll's top speed (rad/s): the card's 25 degrees a second */
export const ROLL_RATE = 25 * DEG;

export function portraitAmount(aspect: number): number {
   return Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
}

/** How much farther the orbit stands on a portrait screen. */
export function orbitScale(aspect: number): number {
   return 1 + portraitAmount(aspect) * 0.45;
}

export function orbitLookUp(_aspect: number): number {
   return 0;
}

/** The orbit's pivot: the hero, led a little along its motion (a flight shows more of where it goes). */
export function orbitPivot(hx: number, hy: number, vx: number, vy: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = hx + vx * 0.35;
   out.y = hy + vy * 0.35;
   out.z = 0;
   return out;
}

/** The auto-follow's travel: never swing round (the play plane is seen from +z). */
export function orbitTravel(out: { x: number; z: number }): { x: number; z: number } {
   out.x = 0;
   out.z = -1;
   return out;
}

/** One step of the camera roll towards `want` (rad), at most ROLL_RATE x dt (wrapped). */
export function stepRoll(roll: number, want: number, dt: number): number {
   let d = (want - roll) % (2 * Math.PI);
   if (d > Math.PI) d -= 2 * Math.PI;
   if (d < -Math.PI) d += 2 * Math.PI;
   const m = ROLL_RATE * dt;
   return roll + (d > m ? m : d < -m ? -m : d);
}

export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const p = orbitPivot(course.startX, course.startY, 0, 0, { x: 0, y: 0, z: 0 });
   const c = orbitPosition(p.x, p.y, p.z, POD_ORBIT.yaw ?? 0, POD_ORBIT.pitch ?? 0, (POD_ORBIT.distance ?? 17) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y, p.z] };
}

/** The fly-through: wide over the whole system from the dock's side, past the first bodies, down to the hero. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const d = course.dock;
   const mx = (course.startX + d.x) / 2;
   return [
      { position: [d.x + 10, 8, 70], lookAt: [mx, 0, 0] },
      { position: [course.startX + 18, 6, 30], lookAt: [course.startX + 6, 0, 0] },
      { position: [course.startX, course.startY + 4, 22], lookAt: [course.startX, course.startY, 0] },
   ];
}
