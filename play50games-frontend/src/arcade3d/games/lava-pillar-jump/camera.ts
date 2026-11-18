// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero; it starts (and recenters) behind and
// above the hero (the route climbs towards -z), its pivot leads a little towards the next pillar (in
// Kalder's ring, towards the golem), and it stands farther back on a portrait screen. The intro's
// fly-through (core/intro) ends exactly on playCamera, the orbit's first pose. cameraGoal is the old
// fixed follow camera's goal, kept for its tests and as the reference the orbit's start was tuned to.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import { solidBoxes, type Course, type LavaRun, type SolidBox } from "./rules";

const DEG = Math.PI / 180;

/** The orbit camera's tuning for this game (menu2/camera createOrbit). */
export const LAVA_ORBIT: Partial<OrbitSettings> = {
   yaw: 0,
   pitch: 24 * DEG,
   distance: 7.4,
   minDistance: 4,
   maxDistance: 16,
};

/** How much farther the orbit stands on a portrait screen (aspect < 1): OrbitCamera distanceScale. */
export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.45 * portrait;
}

/** The camera looks this far above the pivot (a little more on a portrait phone, above the controls). */
export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.15 + 0.05 * portrait;
}

/**
 * The orbit's pivot: the hero's chest, led a third of the way towards the next pillar's top (or the
 * golem), never behind the hero along the route (only ever ahead, -z).
 */
export function orbitPivot(hx: number, hy: number, hz: number, nx: number, ny: number, nz: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const k = 0.35;
   out.x = hx + (nx - hx) * k * 0.5;
   out.y = hy + 1.1 + Math.max(0, ny - hy) * k;
   out.z = hz + Math.min(0, Math.max(-6, (nz - hz) * k)) * 0.5;
   return out;
}

/** Where the hero stands at the start (rules createRun: the start pillar's centre, 1.5 m back). */
export function startSpot(course: Course): { x: number; y: number; z: number } {
   const start = course.supports[course.checkpoints[0]];
   return { x: start.cx, y: start.top, z: start.cz + 1.5 };
}

/** Pillars within this distance (m) of the camera are the orbit camera's solids. */
const SOLID_REACH = 22;
/** The drawn basalt hangs well under a pillar's top: the camera collides with this much of it. */
const SOLID_DEPTH = 8;
const SCRATCH: SolidBox[] = [];

/**
 * Fills `out` with the pillars near (x, y, z) at visual time `ms` as solid boxes (movers where they
 * are now; blinking, sunk, crumbled pillars and inactive boss zones left out, rules solidBoxes) for
 * the orbit camera's collision; returns how many.
 */
export function courseSolids(run: LavaRun, ms: number, x: number, y: number, z: number, out: AABB[]): number {
   const boxes = solidBoxes(run.course, Math.max(0, ms), SCRATCH, run, SOLID_DEPTH);
   let n = 0;
   for (let i = 0; i < boxes.length && n < out.length; i++) {
      const s = boxes[i];
      const cx = (s.minX + s.maxX) / 2;
      const cz = (s.minZ + s.maxZ) / 2;
      const dx = cx - x;
      const dy = s.maxY - y;
      const dz = cz - z;
      const reach = SOLID_REACH + (s.maxX - s.minX) + (s.maxZ - s.minZ);
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
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

export const FOV = 55;
export const FOV_PORTRAIT = 66;

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
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   // look past the hero and a little up, so the hero sits in the lower third with the next jump above
   // it (on a portrait phone less high: the touch controls and the cookie banner take the bottom)
   out.lx = fx;
   out.ly = fy + 0.9 - 0.8 * portrait;
   out.lz = fz - 4.5;
   // the camera keeps its distance to the hero (not to the look-ahead point), rising with the next top
   out.px = hx * 0.6 + fx * 0.25;
   out.py = hy + 1.1 + up + Math.max(0, ny - hy) * 0.15;
   out.pz = hz + back;
   return out;
}

/**
 * The orbit camera's first pose on the start pillar, at its start yaw, pitch and distance (the intro
 * ends on it, so the hand-over to the orbit is seamless).
 */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const s = startSpot(course);
   const next = course.supports[1];
   const p = orbitPivot(s.x, s.y, s.z, next.cx, next.top, next.cz, { x: 0, y: 0, z: 0 });
   const c = orbitPosition(p.x, p.y, p.z, LAVA_ORBIT.yaw ?? 0, LAVA_ORBIT.pitch ?? 0, (LAVA_ORBIT.distance ?? 7) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/**
 * The fly-through: from the sky gate at the top, down along the tower past the checkpoints, to the
 * start (then playCamera). World-space shots built from the course, so a level's layout keeps them.
 */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const goal = course.supports[course.goal];
   const cps = course.checkpoints.slice(1).map((i) => course.supports[i]);
   const high = cps.length > 0 ? cps[cps.length - 1].top + 11 : goal.top;
   // the second shot stays between the establishing shot and the first checkpoint, even when a
   // checkpoint sits only a few metres under the helipad
   const midY = Math.max(goal.top + 6, (goal.top + 16 + high) / 2);
   const shots: IntroKeyframe[] = [
      // establishing: the helipad from out in the sky, then down along the roofs
      course.arena
         ? // level 5: Kalder in his ring, from over the entry
           { position: [goal.cx + 15, goal.top + 16, goal.cz + 26], lookAt: [course.arena.cx, course.arena.top + 4, course.arena.cz] }
         : { position: [goal.cx + 15, goal.top + 16, goal.cz + 26], lookAt: [goal.cx, goal.top + 4, goal.cz - 4] },
      { position: [goal.cx + 12, midY, goal.cz + 14], lookAt: [goal.cx, goal.top + 2, goal.cz - 3] },
   ];
   let side = -1;
   for (let i = cps.length - 1; i >= 0; i--) {
      const c = cps[i];
      shots.push({ position: [c.cx + side * 13, c.top + 11, c.cz + 12], lookAt: [c.cx, c.top + 1, c.cz - 3] });
      side = -side;
   }
   return shots;
}
