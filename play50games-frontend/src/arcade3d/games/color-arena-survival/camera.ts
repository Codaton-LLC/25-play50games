// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): the player turns it freely round the hero (mouse drag, two fingers, keys); the stick is
// camera-relative (StepInput.yaw = orbit.viewYaw). The card asks for "third-person arcade camera with
// stable framing": the orbit stands high behind the hero (looking north, at the beacon and the Keeper),
// with no auto-follow swing, and its pivot leans from the hero towards the arena's middle so the floor
// stays in view wherever the hero runs.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import type { Arena } from "./rules";

const DEG = Math.PI / 180;
export const FOV = 55;
export const FOV_PORTRAIT = 68;
/** how far the pivot leans from the hero towards the middle (0 = the hero, 1 = the middle) */
export const PIVOT_LEAN = 0.4;

/** The orbit's tuning: behind (south of) the hero and high, out by the arena's size; zoom 6-30 m. */
export function arenaOrbit(a: Arena): Partial<OrbitSettings> {
   const d = 9 + a.n * 0.9 + (a.cfg.boss ? 2 : 0);
   return { yaw: 0, pitch: (a.cfg.boss ? 42 : 46) * DEG, distance: d, minDistance: 6, maxDistance: 30, autoFollow: false };
}

/** How much farther the orbit stands on a portrait screen. */
export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.45 * portrait;
}

export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 0.3 + 0.4 * portrait;
}

/** The pivot: the hero's chest, leaned towards the arena's middle (it never falls with him into the pit). */
export function arenaPivot(h: { x: number; y: number; z: number }, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = h.x * (1 - PIVOT_LEAN);
   out.y = Math.max(0, h.y) * 0.5 + 1.0;
   out.z = h.z * (1 - PIVOT_LEAN);
   return out;
}

/** The orbit's first pose: behind the start (the intro ends on it). */
export function playCamera(a: Arena, aspect: number): IntroKeyframe {
   const o = arenaOrbit(a);
   const d = (o.distance ?? 14) * orbitScale(aspect);
   const p = arenaPivot({ x: 0, y: 0, z: a.n % 2 === 1 ? 0 : 1.1 }, { x: 0, y: 0, z: 0 });
   const cam = orbitPosition(p.x, p.y, p.z, o.yaw ?? 0, o.pitch ?? 0, d, { x: 0, y: 0, z: 0 });
   return { position: [cam.x, cam.y, cam.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** The fly-through: from the fortress gate over the Keeper's perch (or the beacon), round the floor, to behind the start. */
export function introKeyframes(a: Arena): IntroKeyframe[] {
   const h = a.half;
   return [
      { position: [h * 1.8, 10, -h - 22], lookAt: [0, 3, -h - 6] },
      { position: [-h - 8, 9, -h * 0.4], lookAt: [0, 0, 0] },
      { position: [h * 0.5, 9 + h * 0.6, h + 10], lookAt: [0, 0.5, 0] },
   ];
}
