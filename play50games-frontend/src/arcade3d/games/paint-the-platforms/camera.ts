// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): free to turn round the hero (mouse drag, two fingers, keys), and when left alone it
// swings back behind the way he runs (autoFollow). It looks down steeply enough that the floor reads as
// a painting (which tiles are grey, which rows are close to setting). The fly-through (core/intro)
// circles high over the whole arena and drops in behind the start.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import type { Course } from "./course";

const DEG = Math.PI / 180;
export const FOV = 60;
export const FOV_PORTRAIT = 72;

/** The orbit's tuning: behind the start, looking north over the arena. */
export function paintOrbit(course: Course): Partial<OrbitSettings> {
   const big = course.boss !== null || course.roller >= 0;
   return { yaw: 0, pitch: (big ? 48 : 44) * DEG, distance: big ? 12 : 11, minDistance: 4, maxDistance: 22, autoFollow: true, autoFollowDelay: 2.2, autoFollowRate: 1.1, autoFollowMinSpeed: 1, autoFollowFullSpeed: 4 };
}

export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.35 * portrait;
}

export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.4 + 0.4 * portrait;
}

/** The pivot: over the hero's shoulders. */
export function heroPivot(p: { x: number; y: number; z: number }, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = p.x;
   out.y = p.y + 1.1;
   out.z = p.z;
   return out;
}

/** The orbit's first pose (the intro ends on it). */
export function playCamera(course: Course, aspect: number): IntroKeyframe {
   const o = paintOrbit(course);
   const d = (o.distance ?? 8) * orbitScale(aspect);
   const s = course.start;
   const p = heroPivot({ x: s.x, y: s.y, z: s.z }, { x: 0, y: 0, z: 0 });
   const cam = orbitPosition(p.x, p.y, p.z, o.yaw ?? 0, o.pitch ?? 0, d, { x: 0, y: 0, z: 0 });
   return { position: [cam.x, cam.y, cam.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** The arena's floor extent (fixed platforms and the rafts' rails). */
export function arenaBounds(course: Course): { minX: number; maxX: number; minZ: number; maxZ: number } {
   let minX = Infinity;
   let maxX = -Infinity;
   let minZ = Infinity;
   let maxZ = -Infinity;
   for (const b of course.boxes) {
      if (b.kind !== "floor") continue;
      minX = Math.min(minX, b.minX);
      maxX = Math.max(maxX, b.maxX);
      minZ = Math.min(minZ, b.minZ);
      maxZ = Math.max(maxZ, b.maxZ);
   }
   return { minX, maxX, minZ, maxZ };
}

/** The fly-through: high over the far side, round over the middle, down behind the start. */
export function introKeyframes(course: Course): IntroKeyframe[] {
   const b = arenaBounds(course);
   const cx = (b.minX + b.maxX) / 2;
   const cz = (b.minZ + b.maxZ) / 2;
   const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
   const s = course.start;
   return [
      { position: [cx + span * 0.7, span * 0.9 + 6, b.minZ - 6], lookAt: [cx, 0, cz] },
      { position: [cx - span * 0.8, span * 0.6 + 5, cz + 2], lookAt: [cx, 0, cz] },
      { position: [s.x, s.y + 6, s.z + 10], lookAt: [s.x, s.y + 0.5, s.z - 6] },
   ];
}
