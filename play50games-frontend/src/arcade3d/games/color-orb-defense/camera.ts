// The orbit camera (menu2/camera): a high three-quarter view of the arena from the south (yaw 0 looks
// north, toward -z), the pivot sliding a little after the hero so the whole ring and its portals stay in
// view. Drag (two fingers on a phone), pinch, Q / C turn and zoom it; V recenters. Portrait phones sit
// higher and further back. The intro circles the arena from the portals to the core.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import type { Arena } from "./arena";

const DEG = Math.PI / 180;

export const ARENA_ORBIT: Partial<OrbitSettings> = {
   yaw: 0,
   pitch: 52 * DEG,
   distance: 24,
   minDistance: 9,
   maxDistance: 40,
   autoFollow: false,
};

export const FOV = 50;
export const FOV_PORTRAIT = 64;

export function portraitness(aspect: number): number {
   return Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
}

export function orbitScale(aspect: number): number {
   return 1 + 0.55 * portraitness(aspect);
}

/** How far the pivot follows the hero (0 = the core, 1 = the hero). */
export const FOLLOW = 0.3;

export function orbitPivot(hx: number, hz: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = hx * FOLLOW;
   out.y = 0.5;
   out.z = hz * FOLLOW - 1;
   return out;
}

export function playCamera(_a: Arena, aspect: number): IntroKeyframe {
   const p = orbitPivot(0, 5.2, { x: 0, y: 0, z: 0 });
   const c = orbitPosition(p.x, p.y, p.z, ARENA_ORBIT.yaw ?? 0, ARENA_ORBIT.pitch ?? 0, (ARENA_ORBIT.distance ?? 24) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y, p.z] };
}

/** A portal from outside, across the zones, then the core. */
export function introKeyframes(a: Arena): IntroKeyframe[] {
   const l = a.lanes[0];
   return [
      { position: [l.dx * 20, 6, l.dz * 20], lookAt: [l.dx * 13, 1.5, l.dz * 13] },
      { position: [l.dx * 9 + 6, 5, l.dz * 9 + 6], lookAt: [l.dx * 6, 0.5, l.dz * 6] },
      { position: [-8, 9, 10], lookAt: [0, 1.5, 0] },
   ];
}

export const MP_YAW = 0;
