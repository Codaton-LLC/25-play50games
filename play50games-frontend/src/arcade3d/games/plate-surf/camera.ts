// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero; it starts (and its auto-follow swings
// back) behind the rider and a little out over the trough, so the face rises on the right with the lip
// on top and the line ahead is in view. Its pivot leads down the line; the wave's body and the sea
// (rules.ts waveBoxes) and the rocks keep it in front of the water. The intro's fly-through (core/intro)
// ends exactly on playCamera, the orbit's first pose.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import { FACE_W } from "./waves";
import { SPAWN_X, rockBoxes, waveBoxes, type Course, type SolidBox, type SurfRun } from "./rules";

const DEG = Math.PI / 180;

/** The start yaw: behind the rider, out over the trough (-x) by this much. */
export const CAMERA_SIDE_YAW = -20 * DEG;

/** The orbit camera's tuning for this game (menu2/camera createOrbit). */
export const SURF_ORBIT: Partial<OrbitSettings> = {
   yaw: CAMERA_SIDE_YAW,
   pitch: 20 * DEG,
   distance: 7.6,
   minDistance: 4,
   maxDistance: 18,
};

/** How much farther the orbit stands on a portrait screen (aspect < 1): OrbitCamera distanceScale. */
export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.45 * portrait;
}

/** The camera looks this far above the pivot. */
export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.2 + 0.2 * portrait;
}

/**
 * The orbit's pivot: the rider's chest, led down the line (more at speed), pulled a little towards
 * the middle of the face so the trough and the lip both stay in the picture.
 */
export function orbitPivot(hx: number, hy: number, hz: number, v: number, out: { x: number; y: number; z: number }, portrait = 0): { x: number; y: number; z: number } {
   // on a portrait screen a little towards the lip (the narrow view keeps the air orbs and gates in it)
   out.x = hx * 0.7 + (FACE_W / 2) * 0.3 + portrait * 1.4;
   out.y = hy + 1.0;
   out.z = hz - 2.5 - Math.max(0, v - 10) * 0.15;
   return out;
}

/**
 * The auto-follow's travel: the ride's direction (-z) turned so "behind" is the start yaw's side
 * (the camera never swings round onto the wave's back).
 */
export function orbitTravel(v: number, out: { x: number; z: number }): { x: number; z: number } {
   out.x = -Math.sin(CAMERA_SIDE_YAW) * v;
   out.z = -Math.cos(CAMERA_SIDE_YAW) * v;
   return out;
}

export const FOV = 55;
export const FOV_PORTRAIT = 66;

/** The orbit camera's first pose at the start (the intro ends on it). */
/** 0 on a landscape screen, 1 on a phone held upright (the same ramp as orbitScale). */
export function portraitAmount(aspect: number): number {
   return Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
}

export function playCamera(course: Course, aspect: number, H = course.H): IntroKeyframe {
   const p = orbitPivot(SPAWN_X, faceYAt(SPAWN_X, H), course.startZ, 13, { x: 0, y: 0, z: 0 }, portraitAmount(aspect));
   const c = orbitPosition(p.x, p.y, p.z, SURF_ORBIT.yaw ?? 0, SURF_ORBIT.pitch ?? 0, (SURF_ORBIT.distance ?? 7) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

function faceYAt(x: number, H: number): number {
   const t = Math.max(0, Math.min(1, x / FACE_W));
   return H * t * t * (3 - 2 * t);
}

/** scratch for waveBoxes (grown once, then reused) */
const SCRATCH: SolidBox[] = [];
const ROCKS = new WeakMap<Course, SolidBox[]>();
const SOLID_REACH = 26;

/** The camera's solid boxes near (x, y, z): the wave's body, the sea and the rocks; returns how many. */
export function courseSolids(run: SurfRun, x: number, y: number, z: number, out: AABB[]): number {
   let n = 0;
   const put = (s: SolidBox) => {
      if (n >= out.length) return;
      const b = out[n++];
      b.min.x = s.minX;
      b.max.x = s.maxX;
      b.min.y = s.minY;
      b.max.y = s.maxY;
      b.min.z = s.minZ;
      b.max.z = s.maxZ;
   };
   const k = waveBoxes(run.course, z, SOLID_REACH, SCRATCH);
   for (let i = 0; i < k; i++) put(SCRATCH[i]);
   let rocks = ROCKS.get(run.course);
   if (!rocks) {
      rocks = rockBoxes(run.course);
      ROCKS.set(run.course, rocks);
   }
   for (const r of rocks) {
      const dx = Math.max(r.minX - x, 0, x - r.maxX);
      const dy = Math.max(r.minY - y, 0, y - r.maxY);
      const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
      if (dx * dx + dy * dy + dz * dz < SOLID_REACH * SOLID_REACH) put(r);
   }
   return n;
}

/**
 * The fly-through: from high over the bay at the lagoon, back along the wave (its curl breaking), to
 * the rider at the start (then playCamera). World-space shots built from the course.
 */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const H = course.H;
   const mid = (course.startZ + course.finishZ) / 2;
   // the curl breaking behind the start, seen from out over the trough ahead; past its lip; down to the rider
   void mid;
   return [
      { position: [-34, 16, course.startZ - 70], lookAt: [FACE_W * 0.6, H * 0.7, course.startZ + 30] },
      { position: [-12, H + 2, course.startZ + 6], lookAt: [FACE_W * 0.5, H * 0.75, course.startZ + 34] },
      { position: [FACE_W * 0.3, H + 6, course.startZ + 12], lookAt: [FACE_W * 0.5, H * 0.5, course.startZ - 10] },
   ];
}
