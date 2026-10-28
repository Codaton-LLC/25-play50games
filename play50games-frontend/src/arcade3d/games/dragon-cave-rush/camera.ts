// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the cart; it starts (and recenters) behind and above
// the cart, and its auto-follow swings it back behind the rails quickly after a curve (the cart travels
// at 14-25 m/s, so the follow is faster than the default). The pivot is the hero over the cart, led a
// little along the rails. It stands farther back on a portrait screen. The cave's walls are no boxes:
// the tunnel is an open arch about 9 m wide round the rails and the orbit's max distance stays inside it.
// The intro's fly-through (core/intro) runs from the skull gate back down the cave to the start cart
// and ends exactly on playCamera.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import { lanePoint, type Course } from "./track";

const DEG = Math.PI / 180;

/** The orbit camera's tuning (menu2/camera createOrbit): yaw = the rails' heading puts it behind the cart. */
export const CAVE_ORBIT: Partial<OrbitSettings> = {
   yaw: 0,
   pitch: 20 * DEG,
   distance: 7.4,
   minDistance: 3.8,
   maxDistance: 13,
   autoFollow: true,
   autoFollowDelay: 1.2,
   autoFollowRate: 3.2,
   autoFollowMinSpeed: 3,
   autoFollowFullSpeed: 10,
   autoFollowMaxAngle: 150 * DEG,
};

export const FOV = 60;
export const FOV_PORTRAIT = 72;

/** How much farther the orbit stands on a portrait screen (aspect < 1): OrbitCamera distanceScale. */
export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.35 * portrait;
}

/** The camera looks this far above the pivot. */
export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.4 + 0.2 * portrait;
}

/** The pivot's height over the cart's rail point (the hero's chest in the cart). */
export const PIVOT_UP = 1.6;
/** The pivot leads the cart this far along the rails (m). */
export const PIVOT_LEAD = 2.5;

const P = { x: 0, y: 0, z: 0, h: 0 };

/** The orbit's pivot for a cart at s (lane offset d, height y over the centre line). */
export function orbitPivot(c: Course, s: number, d: number, y: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   lanePoint(c, s + PIVOT_LEAD, d, y + PIVOT_UP, P);
   out.x = P.x;
   out.y = P.y;
   out.z = P.z;
   return out;
}

/** The yaw behind the rails at s (the orbit's yaw for a recenter). */
export function yawAt(c: Course, s: number): number {
   lanePoint(c, s, 0, 0, P);
   return P.h;
}

/** The orbit camera's first pose at the start (the intro ends on it, so the hand-over is seamless). */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const p = orbitPivot(course, 0, 0, 0, { x: 0, y: 0, z: 0 });
   const yaw = yawAt(course, 0);
   const cam = orbitPosition(p.x, p.y, p.z, yaw, CAVE_ORBIT.pitch ?? 0, (CAVE_ORBIT.distance ?? 7) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [cam.x, cam.y, cam.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/**
 * The fly-through: from in front of the skull gate (or over the hoard loop on level 5), back along the
 * cave at a few points (each shot inside the tunnel, a little to the side and above the rails), to the
 * start (then playCamera).
 */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const shots: IntroKeyframe[] = [];
   const L = course.finishS;
   const at = (s: number, d: number, up: number) => {
      lanePoint(course, Math.max(0, Math.min(course.length, s)), d, up, P);
      return [P.x, P.y, P.z] as [number, number, number];
   };
   if (course.loop) {
      const lp = course.loop;
      const base = course.samples[Math.round(lp.s0 / 0.5) * 4 + 1];
      shots.push({ position: [lp.centre.x + lp.radius * 0.9, base + 18, lp.centre.z + lp.radius * 0.9], lookAt: [lp.centre.x, base + 2, lp.centre.z] });
   } else {
      shots.push({ position: at(L - 14, 3.5, 3.2), lookAt: at(L + 4, 0, 2.2) });
   }
   const marks = [0.62, 0.32, 0.08];
   let side = -1;
   for (const f of marks) {
      const s = (course.loop ? course.loop.s0 : L) * f;
      shots.push({ position: at(s - 10, side * 4, 4.2), lookAt: at(s + 8, 0, 1.2) });
      side = -side;
   }
   return shots;
}
