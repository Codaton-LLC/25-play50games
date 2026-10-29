// The orbit camera (menu2/camera): it sits behind the hero down the corridor (yaw -π/2 looks along +x),
// a little high so both walls and the next pad read, and swings behind each new heading quickly after a
// column whip (auto-follow after 0.6 s, the corridor's heading as the travel). The intro flies the course
// from the last pad back to the start, then lands on the play pose.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import type { Course } from "./course";

const DEG = Math.PI / 180;

export const WALL_ORBIT: Partial<OrbitSettings> = {
   yaw: -Math.PI / 2,
   pitch: 17 * DEG,
   distance: 8.5,
   minDistance: 4,
   maxDistance: 18,
   autoFollowDelay: 0.6,
   autoFollowRate: 2.6,
   autoFollowMinSpeed: 1,
   autoFollowFullSpeed: 4,
};

export const FOV = 60;
export const FOV_PORTRAIT = 70;

export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.35 * portrait;
}

export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.6 + 0.3 * portrait;
}

/** The pivot: the hero's chest, led a little along the heading (less on a portrait phone). */
export function orbitPivot(hx: number, hy: number, hz: number, headX: number, headZ: number, out: { x: number; y: number; z: number }, lead = 2): { x: number; y: number; z: number } {
   out.x = hx + headX * lead;
   out.y = hy + 1.2;
   out.z = hz + headZ * lead;
   return out;
}

export function pivotLead(aspect: number): number {
   return aspect < 1 ? 0.8 : 2;
}

export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const s = course.pads[0];
   const h = course.legs[0]?.heading ?? { x: 1, y: 0, z: 0 };
   const p = orbitPivot(s.x, s.y, s.z, h.x, h.z, { x: 0, y: 0, z: 0 }, pivotLead(aspect));
   const yaw = Math.atan2(-h.x, -h.z);
   const c = orbitPosition(p.x, p.y, p.z, yaw, WALL_ORBIT.pitch ?? 0, (WALL_ORBIT.distance ?? 8) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** Establishing shot of the last pad, then back over the course's checkpoints, ending before playCamera. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const end = course.pads[course.finish];
   const shots: IntroKeyframe[] = [{ position: [end.x - 10, end.y + 9, end.z + 12], lookAt: [end.x, end.y + 2, end.z] }];
   const cps = course.pads.filter((p, i) => p.cp && i !== 0 && i !== course.finish);
   const picks = cps.length <= 2 ? cps : [cps[Math.floor(cps.length * 0.66)], cps[Math.floor(cps.length * 0.25)]];
   picks.forEach((p, k) => {
      const side = k % 2 === 0 ? 9 : -9;
      shots.push({ position: [p.x + side * 0.6, p.y + 8, p.z + side], lookAt: [p.x, p.y + 2, p.z] });
   });
   return shots;
}

/** The shared multiplayer camera's yaw: a side view down the first corridor. */
export const MP_YAW = -Math.PI / 2 + 0.5;
