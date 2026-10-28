// The camera and the intro's shots. Play uses the shared Menu 2 orbit (menu2/camera). It starts
// behind the hero looking along the first avenue (+x): yaw -π/2 puts the camera on -x, so stick-up
// runs east. The intro fly-through ends on playCamera.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import { guidePoint, type CityRun } from "./rules";
import type { Course } from "./city";

const DEG = Math.PI / 180;

/** Behind the hero, looking down the avenue. A little farther than a tower: the blocks are wide. */
export const CITY_ORBIT: Partial<OrbitSettings> = {
   yaw: -Math.PI / 2,
   pitch: 26 * DEG,
   distance: 9.2,
   minDistance: 4.5,
   maxDistance: 18,
};

export const FOV = 46;
export const FOV_PORTRAIT = 54;

export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.4 * portrait;
}

export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.2 + 0.15 * portrait;
}

const pivotOut = { x: 0, y: 0, z: 0 };

/** The hero's chest, led a little toward the lit beacon. */
export function orbitPivot(run: CityRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const h = run.hero;
   guidePoint(run, pivotOut);
   const k = 0.28;
   out.x = h.x + Math.max(-5, Math.min(5, (pivotOut.x - h.x) * k));
   out.y = h.y + 1.15;
   out.z = h.z + Math.max(-5, Math.min(5, (pivotOut.z - h.z) * k));
   return out;
}

export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const p = { x: course.startX, y: 1.2, z: course.startZ };
   const dist = (CITY_ORBIT.distance ?? 9) * orbitScale(aspect);
   const c = orbitPosition(p.x, p.y, p.z, CITY_ORBIT.yaw ?? 0, CITY_ORBIT.pitch ?? 0, dist, { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** A short fly over the blocks, then down onto the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const cx = (course.minX + course.maxX) / 2;
   const cz = (course.minZ + course.maxZ) / 2;
   return [
      { position: [cx + 6, 26, cz + 22], lookAt: [cx, 2, cz] },
      { position: [course.startX + 14, 10, course.startZ + 12], lookAt: [course.startX + 8, 1.5, course.startZ] },
      { position: [course.startX - 4, 6, course.startZ + 2], lookAt: [course.startX, 1.2, course.startZ] },
   ];
}

const SOLID_REACH = 26;

/** Building boxes near the camera, so the orbit tucks in instead of sitting inside a block. */
export function courseSolids(run: CityRun, x: number, z: number, out: AABB[]): number {
   let n = 0;
   for (const b of run.course.blocks) {
      if (n >= out.length) break;
      const mx = (b.x0 + b.x1) / 2;
      const mz = (b.z0 + b.z1) / 2;
      const dx = mx - x;
      const dz = mz - z;
      if (dx * dx + dz * dz > SOLID_REACH * SOLID_REACH) continue;
      const box = out[n++];
      box.min.x = b.x0;
      box.max.x = b.x1;
      box.min.y = 0;
      box.max.y = 9;
      box.min.z = b.z0;
      box.max.z = b.z1;
   }
   return n;
}
