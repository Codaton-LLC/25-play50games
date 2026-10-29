// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero; it starts (and its auto-follow swings
// back) behind and above the grinder, high enough to read the next switch and its branch over the
// hero's head. Its pivot leads down the line (more at speed) and keeps the grid's middle in view. The
// snowfield is its solid box. The intro's fly-through (core/intro) ends exactly on playCamera.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import { GRID, laneX } from "./network";
import { hallBoxes, type Course, type RailRun, type SolidBox } from "./rules";

const DEG = Math.PI / 180;

/** The orbit camera's tuning for this game (menu2/camera createOrbit): behind the runner. */
export const RAIL_ORBIT: Partial<OrbitSettings> = {
   yaw: 0,
   pitch: 21 * DEG,
   distance: 8.2,
   minDistance: 3.5,
   maxDistance: 16,
};

export const FOV = 58;
export const FOV_PORTRAIT = 70;

/** 0 on a landscape screen, 1 on a phone held upright. */
export function portraitAmount(aspect: number): number {
   return Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
}

/** How much farther the orbit stands on a portrait screen (OrbitCamera distanceScale): the lanes stay in view. */
export function orbitScale(aspect: number, lanes = 3): number {
   return 1 + portraitAmount(aspect) * (0.25 + 0.12 * lanes);
}

/** The camera looks this far above the pivot. */
export function orbitLookUp(aspect: number): number {
   return 0.5 + 0.3 * portraitAmount(aspect);
}

/**
 * The orbit's pivot: the hero's chest, pulled towards the hall's middle (so the whole door wall reads),
 * led down the hall (more at speed).
 */
export function orbitPivot(hx: number, hy: number, hz: number, v: number, out: { x: number; y: number; z: number }, lead = 1): { x: number; y: number; z: number } {
   // the lead and the pull to the middle only while the camera looks down the hall (lead = cos of the
   // orbit's yaw, 0 from the side or the front): seen from the side the hero stays in the middle
   const k = Math.max(0, Math.min(1, lead));
   out.x = hx * (1 - 0.45 * k);
   out.y = 1.2 + hy * 0.5;
   out.z = hz - (3 + Math.max(0, v - 10) * 0.2) * k;
   return out;
}

/** The auto-follow's travel: straight down the hall (-z). */
export function orbitTravel(v: number, out: { x: number; z: number }): { x: number; z: number } {
   out.x = 0;
   out.z = -Math.max(1, v);
   return out;
}

/** The orbit camera's first pose at the start (the intro ends on it). */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const p = orbitPivot(laneX(1), 0, course.startZ, course.speed, { x: 0, y: 0, z: 0 });
   // the Scene's pivot: an upright phone keeps the hall's middle
   p.x *= 1 - 0.5 * portraitAmount(aspect);
   const c = orbitPosition(p.x, p.y, p.z, RAIL_ORBIT.yaw ?? 0, RAIL_ORBIT.pitch ?? 0, (RAIL_ORBIT.distance ?? 7) * orbitScale(aspect, GRID), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

const SCRATCH: SolidBox[] = [];
const SOLID_REACH = 30;

/** The camera's solid boxes near z (the floor); returns how many. */
export function courseSolids(run: RailRun, z: number, out: AABB[]): number {
   const k = hallBoxes(run.course, z, SOLID_REACH, SCRATCH);
   let n = 0;
   for (let i = 0; i < k && n < out.length; i++) {
      const s = SCRATCH[i];
      const b = out[n++];
      b.min.x = s.minX;
      b.max.x = s.maxX;
      b.min.y = s.minY;
      b.max.y = s.maxY;
      b.min.z = s.minZ;
      b.max.z = s.maxZ;
   }
   return n;
}

/**
 * The fly-through: high over the valley looking back down the line from beyond the first switches, low
 * along the rails past the first switch, then round to the hero at the start (then playCamera).
 */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const j0 = course.junctions.length ? course.junctions[0].z : course.startZ - 60;
   const j1 = course.junctions.length > 1 ? course.junctions[1].z : j0 - 60;
   return [
      { position: [course.half + 10, 18, j1 - 20], lookAt: [0, 0, j0 + 30] },
      { position: [-course.half + 1, 2.6, j0 - 12], lookAt: [0, 0.8, j0 + 30] },
      { position: [0, 4.5, course.startZ - 14], lookAt: [0, 1.0, course.startZ + 8] },
   ];
}
