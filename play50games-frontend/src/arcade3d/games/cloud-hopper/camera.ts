// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero; it starts (and recenters) behind and
// above the hero (the run heads towards -z), its pivot leads a little towards the next cloud, and it
// stands farther back on a portrait screen. The intro's fly-through (core/intro) ends exactly on
// playCamera, the orbit's first pose. cameraGoal is the old fixed 3/4 follow camera's goal, kept for
// its tests and as the reference the orbit's start pose was tuned against.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import { solidBoxes, type CloudRun, type Course, type SolidBox } from "./rules";

const DEG = Math.PI / 180;

/**
 * The orbit camera's tuning for this game (menu2/camera createOrbit). Yaw 0: straight behind the
 * run, so "up" on the stick glides down the course (the old follow camera's 3/4 side offset would
 * have turned "up" off the course); its height and distance match the old camera's (2.9 m up, 5.6 m back).
 */
export const CLOUD_ORBIT: Partial<OrbitSettings> = {
   yaw: 0,
   pitch: 26 * DEG,
   distance: 6.4,
   minDistance: 4,
   maxDistance: 16,
};

/** How much farther the orbit stands on a portrait screen (aspect < 1): OrbitCamera distanceScale. */
export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.5 * portrait;
}

/** The camera looks this far above the pivot (a little more on a portrait phone). */
export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.1 + 0.05 * portrait;
}

/**
 * The orbit's pivot: the hero's chest, led towards the next cloud's top (so the next landing is on
 * screen), and never behind the hero along the run (only ever ahead, -z).
 */
export function orbitPivot(hx: number, hy: number, hz: number, nx: number, ny: number, nz: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const k = 0.35;
   out.x = hx + (nx - hx) * k * 0.5;
   out.y = hy + 1.1 + Math.max(0, ny - hy) * k;
   out.z = hz + Math.min(0, Math.max(-6, (nz - hz) * k)) * 0.5;
   return out;
}

/** Where the hero stands at the start (rules createRun: the first cloud's centre x and top, startZ). */
export function startSpot(course: Course): { x: number; y: number; z: number } {
   const start = course.clouds[course.checkpoints[0]];
   return { x: start.cx, y: start.top, z: course.startZ };
}

export const FOV = 55;
export const FOV_PORTRAIT = 66;
/** the 3/4 view: the camera sits this far to the +x side of the run */
export const SIDE = 2.4;

export interface CameraGoal {
   px: number;
   py: number;
   pz: number;
   lx: number;
   ly: number;
   lz: number;
}

/** Behind and above the focus: wider and higher on a portrait screen (aspect < 1). */
export function cameraOffset(aspect: number): { up: number; back: number } {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return { up: 2.9 + 1.6 * portrait, back: 5.6 + 2.8 * portrait };
}

/**
 * Where the camera wants to be: the focus is the hero's chest pulled a third of the way to the next
 * platform's top (so the next jump is on screen), the camera behind it on +z and above it.
 */
export function cameraGoal(
   hx: number,
   hy: number,
   hz: number,
   nx: number,
   ny: number,
   nz: number,
   aspect: number,
   out: CameraGoal,
): CameraGoal {
   const k = 0.35;
   const fx = hx + (nx - hx) * k * 0.5;
   const fy = hy + 1.1 + Math.max(0, ny - hy) * k;
   // only ever ahead (-z) of the hero, never behind it
   const fz = hz + Math.min(0, Math.max(-6, (nz - hz) * k));
   const { up, back } = cameraOffset(aspect);
   // look past the hero and a little up, so the hero sits in the lower third with the next jump above
   // it (on a portrait phone less high: the touch controls and the cookie banner take the bottom)
   out.lx = fx;
   out.ly = fy + 0.1;
   out.lz = fz - 4.5;
   // the camera keeps its distance to the hero (not to the look-ahead point), rising with the next top
   out.px = hx * 0.6 + fx * 0.25 + SIDE;
   out.py = hy + 1.1 + up + Math.max(0, ny - hy) * 0.15;
   out.pz = hz + back;
   return out;
}

/**
 * The orbit camera's first pose on the start cloud, at its start yaw, pitch and distance (the intro
 * ends on it, so the hand-over to the orbit is seamless).
 */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const s = startSpot(course);
   const next = course.clouds[course.route[1]];
   const p = orbitPivot(s.x, s.y, s.z, next.cx, next.top, next.cz, { x: 0, y: 0, z: 0 });
   const c = orbitPosition(p.x, p.y, p.z, CLOUD_ORBIT.yaw ?? 0, CLOUD_ORBIT.pitch ?? 0, (CLOUD_ORBIT.distance ?? 6) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** Solids within this distance (m) of the camera are the orbit camera's collision boxes. */
const SOLID_REACH = 22;
/** scratch for rules solidBoxes (grown once, then reused: no allocation per frame) */
const SCRATCH: SolidBox[] = [];

/**
 * Fills `out` with the clouds (where they are now at visual time `ms`; burst ones left out) and the
 * standing storm / ghost walls near (x, y, z) for the orbit camera's collision; returns how many.
 */
export function courseSolids(run: CloudRun, ms: number, x: number, y: number, z: number, out: AABB[]): number {
   const all = solidBoxes(run, ms, SCRATCH);
   let n = 0;
   for (let i = 0; i < all && n < out.length; i++) {
      const s = SCRATCH[i];
      const dx = Math.max(s.minX - x, 0, x - s.maxX);
      const dy = Math.max(s.minY - y, 0, y - s.maxY);
      const dz = Math.max(s.minZ - z, 0, z - s.maxZ);
      if (dx * dx + dy * dy + dz * dz > SOLID_REACH * SOLID_REACH) continue;
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
 * The fly-through: from the rainbow bridge at the far end, back along the run past the anchor clouds, to the
 * start (then playCamera). World-space shots built from the course, so a level's layout keeps them.
 */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const goal = course.clouds[course.goal];
   const cps = course.checkpoints.slice(1).map((i) => course.clouds[i]);
   // the establishing shot: the rainbow bridge from high out over the cloud sea
   const shots: IntroKeyframe[] = [{ position: [goal.cx + 30, goal.top + 18, goal.cz - 10], lookAt: [goal.cx, goal.top + 2, goal.cz] }];
   // then back along the run over at most three anchor clouds (far to near), each shot a little lower
   const picks = cps.length <= 3 ? cps.slice() : [cps[cps.length - 1], cps[Math.floor(cps.length / 2)], cps[0]];
   picks.sort((a, b) => a.cz - b.cz);
   let side = -1;
   picks.forEach((c, k) => {
      shots.push({ position: [c.cx + side * 16, c.top + 14 - 2 * k, c.cz + 12], lookAt: [c.cx, c.top + 1, c.cz - 6] });
      side = -side;
   });
   return shots;
}
