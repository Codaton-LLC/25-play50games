// The camera and the intro's shots (pure, no three.js). Play uses the shared Menu 2 orbit camera
// (menu2/camera): behind and above the roller, looking down the street (the card's "third-person follow
// camera with forward look-ahead; minimal camera roll"); the player may turn it (drag, two fingers, keys)
// and the shared auto-follow swings it back behind. Lanes stay screen-relative: with the camera turned
// past 90 degrees (looking back) left and right swap (laneSign).
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import type { DashRun } from "./rules";

const DEG = Math.PI / 180;
export const FOV = 60;
export const FOV_PORTRAIT = 72;

/** The orbit: behind (+z of the hero, looking along -z), 6.5 m out, a little above; auto-follow on. */
export function dashOrbit(boss: boolean): Partial<OrbitSettings> {
   return { yaw: 0, pitch: (boss ? 20 : 17) * DEG, distance: boss ? 8 : 6.5, minDistance: 4, maxDistance: 14, autoFollow: true, autoFollowDelay: 1.2 };
}

/** +1 when the camera looks down the street (screen left = -x), -1 when turned round to look back. */
export function laneSign(viewYaw: number): number {
   return Math.cos(viewYaw) >= 0 ? 1 : -1;
}

export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.35 * portrait;
}

/** Looks a little over the hero: the street to come. */
export function orbitLookUp(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1.0 + 0.6 * portrait;
}

/** The pivot: the hero's chest, led 3 m down the street. World z = -d. */
export function heroPivot(run: DashRun, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const h = run.hero;
   out.x = h.x * 0.6;
   out.y = 1.0 + h.y * 0.5;
   out.z = -h.d - 3;
   return out;
}

export function playCamera(boss: boolean, aspect: number): IntroKeyframe {
   const o = dashOrbit(boss);
   const cam = orbitPosition(0, 1, -3, o.yaw ?? 0, o.pitch ?? 0, (o.distance ?? 6.5) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [cam.x, cam.y, cam.z], lookAt: [0, 1 + orbitLookUp(aspect), -3] };
}

/** The fly-through: high over the street towards the fortress, down the causeway, to behind the start. */
export function introKeyframes(length: number): IntroKeyframe[] {
   const far = Math.min(200, Math.max(120, length * 0.3));
   return [
      { position: [10, 26, -far], lookAt: [0, 4, -far - 60] },
      { position: [-8, 10, -far * 0.4], lookAt: [0, 1, -10] },
      { position: [0, 4, 8], lookAt: [0, 1, -6] },
   ];
}
