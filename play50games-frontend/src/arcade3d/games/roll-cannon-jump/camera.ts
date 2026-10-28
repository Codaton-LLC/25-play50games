// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero. In a cannon it swings in behind the
// barrel (the barrel's yaw is the orbit's yaw: the shot goes away from the camera) with its pivot led
// along the aim, so the next cannon is on screen; in flight the pivot leads along the travel. The
// intro's fly-through (core/intro) ends exactly on playCamera, the orbit's first pose.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import { solidBoxes, type CannonRun, type Course, type SolidBox } from "./rules";
import { forwardX, forwardZ } from "./show";

const DEG = Math.PI / 180;

/** The orbit's tuning: behind the start cannon, a little above, zoom 5-20 m. */
export function cannonOrbit(course: Course): Partial<OrbitSettings> {
   return { yaw: course.cannons[0].yaw, pitch: 20 * DEG, distance: 7.4, minDistance: 4, maxDistance: 20 };
}

export const FOV = 56;
export const FOV_PORTRAIT = 68;

/** How much farther the orbit stands on a portrait screen. */
export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.45 * portrait;
}

export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.4 + 0.3 * portrait;
}

/** The pivot in a cannon: the hero, led 2.6 m along the barrel and 1 m up. */
export function aimPivot(x: number, y: number, z: number, yaw: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = x + forwardX(yaw) * 2.6;
   out.y = y + 1.0;
   out.z = z + forwardZ(yaw) * 2.6;
   return out;
}

/** The pivot in flight: the hero, led a quarter second along the travel. */
export function flightPivot(x: number, y: number, z: number, vx: number, vy: number, vz: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = x + vx * 0.22;
   out.y = y + 0.6 + Math.max(-2, Math.min(2, vy * 0.08));
   out.z = z + vz * 0.22;
   return out;
}

/** The orbit's first pose: behind cannon 0 (the intro ends on it). */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const c = course.cannons[0];
   const o = cannonOrbit(course);
   const p = aimPivot(c.x, c.y, c.z, c.yaw, { x: 0, y: 0, z: 0 });
   const cam = orbitPosition(p.x, p.y, p.z, o.yaw ?? 0, o.pitch ?? 0, (o.distance ?? 7) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [cam.x, cam.y, cam.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** The fly-through: high over the finish (level 5: over the stage), back along the show, to the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const goal = course.arena ? { x: course.arena.x, y: course.arena.y + 8, z: course.arena.z } : course.finish ? { x: course.finish.x, y: course.finish.y, z: course.finish.z } : { x: 0, y: 8, z: -40 };
   const mid = course.cannons[Math.floor(course.cannons.length / 2)];
   const c0 = course.cannons[0];
   return [
      { position: [goal.x + 22, goal.y + 16, goal.z - 16], lookAt: [goal.x, goal.y, goal.z] },
      { position: [mid.x - 18, mid.y + 10, mid.z + 6], lookAt: [mid.x, mid.y, mid.z - 6] },
      { position: [c0.x + 9, c0.y + 6, c0.z + 9], lookAt: [c0.x, c0.y, c0.z - 4] },
   ];
}

const SOLID_REACH = 24;
const SCRATCH: SolidBox[] = [];

/** Fills `out` with the solids near (x, y, z) for the orbit camera's collision; returns how many. */
export function courseSolids(run: CannonRun, ms: number, x: number, y: number, z: number, out: AABB[]): number {
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
