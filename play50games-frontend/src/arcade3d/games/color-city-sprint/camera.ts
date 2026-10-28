// The camera and the intro's shots. Play uses the shared Menu 2 orbit (menu2/camera): it starts
// behind the hero looking at the first beacon (course.startYaw), a little high so the next streets
// read over the corners. The buildings are the orbit's solids: the camera pulls in or rises over a
// block rather than sitting inside it. The intro flies over the city and ends on playCamera.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import type { ClipOptions } from "@/arcade3d/menu2/camera/orbitCollision";
import { guidePoint, type CityRun } from "./rules";
import type { Course } from "./city";
import { buildSkyline } from "./skyline";

const DEG = Math.PI / 180;

export function cityOrbit(course: Course): Partial<OrbitSettings> {
   return { yaw: course.startYaw, pitch: 36 * DEG, distance: 10, minDistance: 4.5, maxDistance: 24 };
}

export const CITY_COLLISION: ClipOptions = { radius: 0.4, minDistance: 2.4, squeeze: 1.6, liftTo: 62 * DEG };

export const FOV = 50;
export const FOV_PORTRAIT = 60;

export function portraitAmount(aspect: number): number {
   return Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
}

export function orbitScale(aspect: number): number {
   return 1 + 0.35 * portraitAmount(aspect);
}

export function orbitLookUp(aspect: number): number {
   return 0.5 + 0.3 * portraitAmount(aspect);
}

const guide = { x: 0, y: 0, z: 0 };

/** The hero's chest, led a little toward where it should go (the lit beacon, Greyout's open spot). */
export function orbitPivot(run: CityRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const h = run.hero;
   guidePoint(run, guide);
   const dx = guide.x - h.x;
   const dz = guide.z - h.z;
   const d = Math.hypot(dx, dz);
   const lead = Math.min(2.5, d * 0.15);
   out.x = h.x + (d > 0.01 ? (dx / d) * lead : 0);
   out.y = h.y + 1.1;
   out.z = h.z + (d > 0.01 ? (dz / d) * lead : 0);
   return out;
}

export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const o = cityOrbit(course);
   const p = { x: course.startX, y: 1.1, z: course.startZ };
   const c = orbitPosition(p.x, p.y, p.z, o.yaw ?? 0, o.pitch ?? 0, (o.distance ?? 9) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** A high pass over the whole city, then down the first avenue onto the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const cx = (course.minX + course.maxX) / 2;
   const cz = (course.minZ + course.maxZ) / 2;
   const span = Math.max(course.maxX - course.minX, course.maxZ - course.minZ);
   const b = course.beacons[0];
   const fx = b.bus >= 0 ? cx : b.x;
   const fz = b.bus >= 0 ? cz : b.z;
   // high over the city, a sweep across it, then down behind the start looking at the first beacon
   const bx = Math.sin(course.startYaw);
   const bz = Math.cos(course.startYaw);
   return [
      { position: [cx - span * 0.45, span * 0.95, cz + span * 0.55], lookAt: [cx, 0, cz] },
      { position: [cx + span * 0.35, span * 0.6, cz + span * 0.2], lookAt: [cx, 2, cz] },
      { position: [course.startX + bx * 14, 12, course.startZ + bz * 14], lookAt: [fx, 1.5, fz] },
   ];
}

const SOLID_REACH = 30;
const heights = new WeakMap<Course, number[]>();

function blockHeights(c: Course): number[] {
   let h = heights.get(c);
   if (!h) {
      h = buildSkyline(c).height;
      heights.set(c, h);
   }
   return h;
}

/** The solid blocks near the camera (buildings, the closed site, ghost shops), so the orbit tucks in or rises. */
export function courseSolids(run: CityRun, x: number, z: number, out: AABB[]): number {
   let n = 0;
   const hs = blockHeights(run.course);
   for (let i = 0; i < run.course.blocks.length; i++) {
      const b = run.course.blocks[i];
      if (n >= out.length) break;
      if (b.kind === "plaza" || b.kind === "lot" || (b.kind === "site" && run.siteOpen)) continue;
      const mx = (b.x0 + b.x1) / 2;
      const mz = (b.z0 + b.z1) / 2;
      if ((mx - x) ** 2 + (mz - z) ** 2 > SOLID_REACH * SOLID_REACH) continue;
      const box = out[n++];
      box.min.x = b.x0;
      box.max.x = b.x1;
      box.min.y = 0;
      box.max.y = b.kind === "site" ? 2.2 : hs[i] + 0.5;
      box.min.z = b.z0;
      box.max.z = b.z1;
   }
   return n;
}
