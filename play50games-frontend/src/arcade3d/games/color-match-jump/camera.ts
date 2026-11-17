// The camera (pure): the shared Menu 2 orbit (menu2/camera) round the hero, and the intro's shots.
import type { IntroKeyframe } from "../../core/intro/introMachine";
import { orbitPosition } from "../../menu2/camera/orbit";
import type { Course } from "./course";

export const FOV = 58;
export const CMJ_ORBIT = { yaw: 0, pitch: 0.62, distance: 11, minDistance: 5, maxDistance: 24, minPitch: 0.2, maxPitch: 1.35 };
/** Portrait screens sit further back so the hexes around the hero stay in view. */
export const orbitScale = (aspect: number): number => (aspect < 1 ? 1.35 : 1);

export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const s = course.cells[course.start];
   const p = orbitPosition(s.x, s.h + 1.2, s.z, CMJ_ORBIT.yaw, CMJ_ORBIT.pitch, CMJ_ORBIT.distance * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [p.x, p.y, p.z], lookAt: [s.x, s.h + 1.2, s.z] };
}

/** The fly-through: from the crown (or over the golem) back to the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   if (course.level.boss) {
      return [
         { position: [0, 16, -28], lookAt: [0, 5, 0] },
         { position: [22, 10, 6], lookAt: [0, 4, 0] },
         { position: [6, 7, 24], lookAt: [0, 3, 6] },
      ];
   }
   const crown = course.cells[course.crown];
   const zs = [crown.z, crown.z * 0.55, crown.z * 0.15];
   return zs.map((z, i) => ({ position: [i % 2 ? -12 : 12, 11, z + 12], lookAt: [0, 0.5, z - 6] }));
}
