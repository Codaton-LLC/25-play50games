// The camera and the intro's shots. Play uses the shared Menu 2 orbit (menu2/camera): behind the
// hero looking down the room (+z), a little high so the next gap and the wave read. The castle, the
// block walls, the toyboxes and the shelves are its solids. The intro flies down the room from the
// castle and ends on playCamera.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import type { ClipOptions } from "@/arcade3d/menu2/camera/orbitCollision";
import { guidePoint, type ToyRun } from "./rules";
import { BOXES } from "./levels";
import type { Course } from "./room";

const DEG = Math.PI / 180;

export function roomOrbit(course: Course): Partial<OrbitSettings> {
   return { yaw: course.startYaw, pitch: (course.boss ? 40 : 30) * DEG, distance: course.boss ? 12 : 9, minDistance: 4.5, maxDistance: 24 };
}

export const ROOM_COLLISION: ClipOptions = { radius: 0.35, minDistance: 1.4, squeeze: 0.45, liftTo: 64 * DEG };

export const FOV = 52;
export const FOV_PORTRAIT = 62;

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

/** The hero's chest, led a little toward where it should go (a starter, a spare, the wave, Jack). */
export function orbitPivot(run: ToyRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const h = run.hero;
   guidePoint(run, guide);
   const dx = guide.x - h.x;
   const dz = guide.z - h.z;
   const d = Math.hypot(dx, dz);
   const lead = Math.min(2.5, d * 0.15);
   out.x = h.x + (d > 0.01 ? (dx / d) * lead : 0);
   out.y = Math.max(h.y, -1) + 1.1;
   out.z = h.z + (d > 0.01 ? (dz / d) * lead : 0);
   return out;
}

export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const o = roomOrbit(course);
   const p = { x: course.startX, y: 1.1, z: course.startZ };
   const c = orbitPosition(p.x, p.y, p.z, o.yaw ?? 0, o.pitch ?? 0, (o.distance ?? 9) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** From high over the castle end, back down the room, onto the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const len = course.maxZ - course.minZ;
   return [
      { position: [course.finish.x + 10, 16, course.maxZ + 6], lookAt: [course.finish.x, 0, course.finish.z - 8] },
      { position: [-9, 12, course.minZ + len * 0.5], lookAt: [0, 0, course.minZ + len * 0.3] },
      { position: [course.startX + 3, 7, course.startZ - 8], lookAt: [course.startX, 1, course.startZ + 10] },
   ];
}

const SOLID_REACH = 30;

/** The solid boxes near the camera: the castle, unbroken block walls, the toyboxes, shelves and ledges. */
export function courseSolids(run: ToyRun, x: number, z: number, out: AABB[]): number {
   let n = 0;
   const c = run.course;
   const add = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
      if (n >= out.length) return;
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      if ((mx - x) ** 2 + (mz - z) ** 2 > SOLID_REACH * SOLID_REACH) return;
      const b = out[n++];
      b.min.x = x0;
      b.max.x = x1;
      b.min.y = y0;
      b.max.y = y1;
      b.min.z = z0;
      b.max.z = z1;
   };
   for (const k of c.castles) add(k.x0, k.x1, 0, 6, k.z0, k.z1);
   c.walls.forEach((w, i) => {
      if (!run.wallBroken[i]) add(w.x0, w.x1, 0, 2.6, w.z0, w.z1);
   });
   for (const p of c.plats) if (p.y > 0) add(p.x0, p.x1, p.y - 0.5, p.y, p.z0, p.z1);
   if (c.boss) for (const b of BOXES) add(b.x - 1.3, b.x + 1.3, 0, 2.6, b.z - 1.3, b.z + 1.3);
   return n;
}
