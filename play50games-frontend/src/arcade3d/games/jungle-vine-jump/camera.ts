// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero (mouse drag, two fingers, keys), the stick
// is camera-relative (StepInput.yaw = orbit.viewYaw). Left alone, the orbit eases round to a side view
// of the swing: outside the route's ring looking in at the trunk, so a vine's arc reads left to right on
// the screen (the auto-follow is fed the "inward" direction instead of the hero's travel). The pivot is
// the hero's chest, led up the climb. The intro's fly-through (core/intro) goes from over the crown,
// down round the trunk, to exactly the orbit's first pose (playCamera).
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, yawBehind, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import { padY, type Course } from "./course";
import type { VineRun } from "./rules";

const DEG = Math.PI / 180;
export const FOV = 52;
export const FOV_PORTRAIT = 64;
/** the auto-follow's "travel" speed: always full strength (m/s) */
const INWARD_SPEED = 8;

/** The yaw that looks from outside the ring in at the trunk past (x, z): the side view of the swing. */
export function outsideYaw(x: number, z: number): number {
   return yawBehind(-x, -z);
}

/** The feed for the orbit's auto-follow: the inward direction at the hero's place (writes `out`). */
export function inwardTravel(x: number, z: number, out: { x: number; z: number }): { x: number; z: number } {
   const n = Math.hypot(x, z) || 1;
   out.x = (-x / n) * INWARD_SPEED;
   out.z = (-z / n) * INWARD_SPEED;
   return out;
}

/** The orbit's tuning: a side view a little above, 12 m back, zoom 5-26 m, easing round with the climb. */
export function vineOrbit(course: Course): Partial<OrbitSettings> {
   const s = course.pads[course.route[0].pad];
   return {
      yaw: outsideYaw(s.x, s.z),
      pitch: (course.cfg.boss ? 10 : 14) * DEG,
      distance: 12,
      minDistance: 5,
      maxDistance: 26,
      autoFollow: true,
      autoFollowDelay: 1.6,
      autoFollowRate: 1.4,
      autoFollowMinSpeed: 0.5,
      autoFollowFullSpeed: 4,
      autoFollowMaxAngle: Math.PI,
   };
}

/** How much farther the orbit stands on a portrait screen (the swings are wide, the screen narrow). */
export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.35 * portrait;
}

export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.8 + 0.6 * portrait;
}

/** The pivot: the hero's chest, led up by the climb (the next vines above are in view). */
export function heroPivot(h: { x: number; y: number; z: number; vy: number }, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = h.x;
   out.y = h.y + 1.5 + Math.max(-1.2, Math.min(2, h.vy * 0.1));
   out.z = h.z;
   return out;
}

/** The orbit's first pose: outside the start platform (the intro ends on it). */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const o = vineOrbit(course);
   const d = (o.distance ?? 12) * orbitScale(aspect);
   const s = course.pads[course.route[0].pad];
   const p = heroPivot({ x: s.x, y: s.y, z: s.z, vy: 0 }, { x: 0, y: 0, z: 0 });
   const cam = orbitPosition(p.x, p.y, p.z, o.yaw ?? 0, o.pitch ?? 0, d, { x: 0, y: 0, z: 0 });
   return { position: [cam.x, cam.y, cam.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** The fly-through: over the crown, down round the trunk, to the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const top = course.top;
   const s = course.pads[course.route[0].pad];
   const mid = course.pads[course.route[Math.floor(course.route.length / 2)].pad >= 0 ? course.route[Math.floor(course.route.length / 2)].pad : course.goal];
   return [
      { position: [0, top + 18, 34], lookAt: [0, top, 0] },
      { position: [mid.x * 2, mid.y + 6, mid.z * 2], lookAt: [mid.x, mid.y, mid.z] },
      { position: [s.x * 1.6, s.y + 5, s.z * 1.6], lookAt: [s.x, s.y + 2, s.z] },
   ];
}

const SOLID_REACH = 22;

/** Fills `out` with the platforms near (x, y, z) for the orbit camera's collision; returns how many. */
export function courseSolids(run: VineRun, x: number, y: number, z: number, out: AABB[]): number {
   const pads = run.course.pads;
   let n = 0;
   for (let i = 0; i < pads.length && n < out.length; i++) {
      const p = pads[i];
      const top = padY(p, run.simMs);
      // platforms over the hero's head would squeeze the camera onto him: it passes through them
      if (top - 0.5 > run.hero.y + 1.4) continue;
      const dx = Math.max(Math.abs(p.x - x) - p.r, 0);
      const dy = Math.max(top - 0.5 - y, 0, y - top);
      const dz = Math.max(Math.abs(p.z - z) - p.r, 0);
      if (dx * dx + dy * dy + dz * dz > SOLID_REACH * SOLID_REACH) continue;
      const b = out[n++];
      b.min.x = p.x - p.r * 0.8;
      b.max.x = p.x + p.r * 0.8;
      b.min.y = top - 0.5;
      b.max.y = top;
      b.min.z = p.z - p.r * 0.8;
      b.max.z = p.z + p.r * 0.8;
   }
   return n;
}
