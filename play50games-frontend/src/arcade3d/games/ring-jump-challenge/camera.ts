// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero; it starts high behind the hero looking
// steeply down the shaft (the card: "top-down-ish, looking down the shaft"), its pivot sits a little
// under the hero so the rings ahead fill the middle of the screen, and it stands farther back on a
// portrait screen. The FOV opens with the fall speed (the card: 60° up to 80°). The intro's
// fly-through (core/intro) rises from the sea up the canyon and ends exactly on playCamera, the
// orbit's first pose.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import { V_SPREAD, VMAX, type Course } from "./rules";

const DEG = Math.PI / 180;

/** The orbit camera's tuning (menu2/camera createOrbit): yaw 0 behind the leap (stick up = towards -z). */
export const RING_ORBIT: Partial<OrbitSettings> = {
   yaw: 0,
   pitch: 64 * DEG,
   distance: 9,
   minDistance: 4.5,
   maxDistance: 20,
   minPitch: 5 * DEG,
   maxPitch: 80 * DEG,
   // a free-fall turns often: the auto-follow swings only on a steady glide across, and slowly
   autoFollowMinSpeed: 5,
   autoFollowFullSpeed: 9,
   autoFollowRate: 0.5,
};

/** How much farther the orbit stands on a portrait screen (aspect < 1): OrbitCamera distanceScale. */
export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.35 * portrait;
}

/** The camera looks this far above the pivot. */
export const LOOK_UP = 0;

/** The pivot sits this far under the hero's middle: the shaft below fills the screen's middle. */
export const PIVOT_DROP = 2.2;

/** The orbit's pivot: the hero's middle, dropped a little (a perched hero: a little more, to show the leap). */
export function orbitPivot(hx: number, hy: number, hz: number, perched: boolean, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = hx * (perched ? 0.85 : 1);
   out.y = hy + 0.7 - PIVOT_DROP - (perched ? 1.5 : 0);
   out.z = hz * (perched ? 0.85 : 1);
   return out;
}

export const FOV = 60;
export const FOV_PORTRAIT = 72;
export const FOV_SPEED_GAIN = 20;

/** The FOV for a fall speed (m/s, positive down): the base at a spread fall, +20° at the fastest dive. */
export function fovFor(base: number, fall: number): number {
   const k = Math.max(0, Math.min(1, (fall - V_SPREAD) / (VMAX - V_SPREAD)));
   return base + FOV_SPEED_GAIN * k;
}

/** The orbit camera's first pose at the start column (the intro ends on it). */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const p = orbitPivot(course.startX, course.top, course.startZ, true, { x: 0, y: 0, z: 0 });
   const c = orbitPosition(p.x, p.y, p.z, RING_ORBIT.yaw ?? 0, RING_ORBIT.pitch ?? 0, (RING_ORBIT.distance ?? 9) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + LOOK_UP, p.z] };
}

/**
 * The fly-through: from low over the sea (the target pad), up the shaft past two of the monuments,
 * out over the rim beside the start column (then playCamera).
 */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const R = course.radius;
   const top = course.top;
   const pad = course.pad;
   // two rings on the way up (close shots: the depth fog hides anything far down the shaft)
   const rings = course.rings.filter((r) => r.main).sort((a, b) => a.y - b.y);
   const low = rings[Math.floor(rings.length * 0.2)] ?? rings[0];
   const high = rings[Math.floor(rings.length * 0.7)] ?? rings[rings.length - 1];
   const shots: IntroKeyframe[] = [{ position: [pad.x + 7, pad.y + 9, pad.z + 11], lookAt: [pad.x, pad.y, pad.z] }];
   if (low) shots.push({ position: [low.x - R * 0.35, low.y + 14, low.z + R * 0.3], lookAt: [low.x, low.y, low.z] });
   if (high) shots.push({ position: [high.x + R * 0.35, high.y + 14, high.z - R * 0.3], lookAt: [high.x, high.y, high.z] });
   shots.push({ position: [0, top + 16, course.startZ + 14], lookAt: [course.startX, top, course.startZ - 6] });
   return shots;
}
