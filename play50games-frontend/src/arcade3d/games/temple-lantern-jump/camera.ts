// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero (mouse drag, two fingers, keys), the stick
// is camera-relative (StepInput.yaw = orbit.viewYaw). The pivot sits on the hero's chest, led a little
// up the climb so the next ledges are on screen, and the camera pulls in when a slab blocks the view.
// The intro's fly-through (core/intro) goes from over the roof, down the shaft, to exactly the orbit's
// first pose (playCamera).
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import type { AABB } from "@/arcade3d/core/collision";
import { orbitPosition, yawBehind, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import { padX, padZ, type Course } from "./course";
import { padSolid, type TempleRun } from "./rules";

const DEG = Math.PI / 180;
export const FOV = 56;
export const FOV_PORTRAIT = 66;

/** The first view: behind the start deck looking along the first ledge. */
export function startYaw(course: Course): number {
   const first = course.pads[course.chain[1]];
   return yawBehind(first.x, first.z);
}

/** The orbit's tuning: a little above, 8.5 m back, zoom 4-18 m. */
export function templeOrbit(course: Course): Partial<OrbitSettings> {
   return { yaw: startYaw(course), pitch: (course.cfg.boss ? 9 : 20) * DEG, distance: 8.5, minDistance: 4, maxDistance: 18, autoFollow: false };
}

/** How much farther the orbit stands on a portrait screen (the climb is tall, the screen narrow). */
export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.3 * portrait;
}

export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.6 + 0.5 * portrait;
}

/** The pivot: the hero's chest, led up by his climb (the next ledges above are in view). */
export function heroPivot(h: { x: number; y: number; z: number; vy: number }, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = h.x;
   out.y = h.y + 1.3 + Math.max(-1.5, Math.min(1.8, h.vy * 0.08));
   out.z = h.z;
   return out;
}

/** The orbit's first pose: behind the start deck (the intro ends on it). */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const o = templeOrbit(course);
   const d = (o.distance ?? 8) * orbitScale(aspect);
   const s = course.pads[course.chain[0]];
   const p = heroPivot({ x: s.x, y: s.y, z: s.z, vy: 0 }, { x: 0, y: 0, z: 0 });
   const cam = orbitPosition(p.x, p.y, p.z, o.yaw ?? 0, o.pitch ?? 0, d, { x: 0, y: 0, z: 0 });
   return { position: [cam.x, cam.y, cam.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** The fly-through: over the top of the shaft (level 5: the Queen's roof), down the spiral, to the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const top = course.top;
   const mid = course.pads[course.chain[Math.floor(course.chain.length / 2)]];
   return [
      { position: [9, top + 10, 9], lookAt: [0, top - 2, 0] },
      { position: [-9, mid.y + 5, 8], lookAt: [mid.x, mid.y, mid.z] },
      { position: [7, 6, 8], lookAt: [0, 2, 0] },
   ];
}

const SOLID_REACH = 20;

/** Fills `out` with the slabs near (x, y, z) for the orbit camera's collision; returns how many. */
export function courseSolids(run: TempleRun, x: number, y: number, z: number, out: AABB[]): number {
   const pads = run.course.pads;
   let n = 0;
   for (let i = 0; i < pads.length && n < out.length; i++) {
      const p = pads[i];
      if (p.kind === "lantern" || !padSolid(run, p)) continue;
      // ledges over the hero's head would squeeze the camera onto him (the spiral stacks them every 1-2 m): it passes through them
      if (p.y - 0.4 > run.hero.y + 1.2) continue;
      const px = padX(p, run.simMs);
      const pz = padZ(p, run.simMs);
      const dx = Math.max(Math.abs(px - x) - p.r, 0);
      const dy = Math.max(p.y - 0.4 - y, 0, y - p.y);
      const dz = Math.max(Math.abs(pz - z) - p.r, 0);
      if (dx * dx + dy * dy + dz * dz > SOLID_REACH * SOLID_REACH) continue;
      const b = out[n++];
      b.min.x = px - p.r * 0.85;
      b.max.x = px + p.r * 0.85;
      b.min.y = p.y - 0.4;
      b.max.y = p.y;
      b.min.z = pz - p.r * 0.85;
      b.max.z = pz + p.r * 0.85;
   }
   // the golden roof (level 5): the camera stays under its beams instead of sitting inside them
   if (run.course.cfg.boss && n < out.length) {
      const b = out[n++];
      b.min.x = -9;
      b.max.x = 9;
      b.min.z = -9;
      b.max.z = 9;
      b.min.y = run.course.roofY - 1.6;
      b.max.y = run.course.roofY + 3;
   }
   return n;
}
