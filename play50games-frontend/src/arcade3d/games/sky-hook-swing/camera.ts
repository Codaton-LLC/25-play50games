// The orbit camera. The docks run toward +x; the camera starts behind and to the left of the hero
// (a three-quarter view: yaw -π/2 + 0.8), so a swing reads as an arc with depth and screen-up walks
// along the docks and a little toward the far side. The intro flies the course, then lands on that pose.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import type { Course } from "./course";

const DEG = Math.PI / 180;

export const SWING_ORBIT: Partial<OrbitSettings> = {
   yaw: -Math.PI / 2 + 0.8,
   pitch: 20 * DEG,
   distance: 11,
   minDistance: 5,
   maxDistance: 22,
};

export const FOV = 52;
export const FOV_PORTRAIT = 64;

export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.45 * portrait;
}

export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.4 + 0.15 * portrait;
}

/** The pivot leads a little toward the next dock, and stays up with the hero on a high swing. */
export function orbitPivot(hx: number, hy: number, hz: number, nx: number, ny: number, nz: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const k = 0.28;
   out.x = hx + Math.max(0, nx - hx) * k;
   out.y = hy + 1.3 + Math.max(0, ny - hy) * 0.15;
   out.z = hz + (nz - hz) * k * 0.4;
   return out;
}

export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const start = course.islands[0];
   const next = course.islands.find((s) => s.cp && s.x > start.x) ?? course.islands[course.finish];
   const p = orbitPivot(start.x, start.y, start.z, next.x, next.y, next.z, { x: 0, y: 0, z: 0 });
   const c = orbitPosition(p.x, p.y, p.z, SWING_ORBIT.yaw ?? 0, SWING_ORBIT.pitch ?? 0, (SWING_ORBIT.distance ?? 9) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** The shared multiplayer camera: a side view with depth (the card), from the near side. */
export const MP_YAW = 0.3;

/** Establishing shot of the pad, then back along the checkpoints, ending before playCamera. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const pad = course.islands[course.finish];
   const shots: IntroKeyframe[] = [{ position: [pad.x + 14, pad.y + 10, 12], lookAt: [pad.x, pad.y + 2, 0] }];
   const cps = course.islands.filter((s) => s.cp && s.x > 1 && s.x < pad.x);
   const picks = cps.length <= 2 ? cps : [cps[cps.length - 1], cps[0]];
   picks.sort((a, b) => b.x - a.x);
   picks.forEach((s, k) => {
      const side = k % 2 === 0 ? 8 : -8;
      shots.push({ position: [s.x + 6, s.y + 8, side], lookAt: [s.x + 4, s.y + 2, 0] });
   });
   return shots;
}
