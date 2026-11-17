// The orbit camera (menu2/camera): third-person behind the runner with a forward look-ahead and no roll
// (yaw 0 looks down the track, toward -z). It follows the hero's lane softly so the next gate's three
// lanes stay in view. Right-drag, two fingers, pinch, Q / C turn and zoom it; V recenters. Portrait
// phones sit higher and further back. The intro flies down the track from the first gate to the start.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import type { Track } from "./track";

const DEG = Math.PI / 180;

export const RUN_ORBIT: Partial<OrbitSettings> = {
   yaw: 0,
   pitch: 27 * DEG,
   distance: 9.5,
   minDistance: 4,
   maxDistance: 20,
   autoFollow: true,
   autoFollowDelay: 1.2,
   autoFollowRate: 1.6,
   autoFollowMinSpeed: 1,
   autoFollowFullSpeed: 4,
};

export const FOV = 62;
export const FOV_PORTRAIT = 74;

export function portraitness(aspect: number): number {
   return Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
}

export function orbitScale(aspect: number): number {
   return 1 + 0.4 * portraitness(aspect);
}

export function orbitLookUp(aspect: number): number {
   return 0.2 + 0.3 * portraitness(aspect);
}

/** How far ahead of the hero the camera looks (m). */
export const LEAD = 3;

/** The pivot: the hero's chest, half way to the track's centre line, led down the track. */
export function orbitPivot(hx: number, hy: number, hz: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = hx * 0.5;
   out.y = 1.2 + Math.max(0, hy) * 0.5;
   out.z = hz - LEAD;
   return out;
}

export function playCamera(_t: Track, aspect: number): IntroKeyframe {
   const p = orbitPivot(0, 0, 0, { x: 0, y: 0, z: 0 });
   const c = orbitPosition(p.x, p.y, p.z, RUN_ORBIT.yaw ?? 0, RUN_ORBIT.pitch ?? 0, (RUN_ORBIT.distance ?? 8) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y + orbitLookUp(aspect), p.z] };
}

/** The first gate head-on, then the start platform from the side. */
export function introKeyframes(t: Track): IntroKeyframe[] {
   const g = t.gates[0]?.z ?? -30;
   const g2 = t.gates[2]?.z ?? -90;
   return [
      { position: [5, 4, g2 - 14], lookAt: [0, 2, g2] },
      { position: [-7, 3.5, g - 10], lookAt: [0, 2, g] },
      { position: [6, 3, 6], lookAt: [0, 1, -4] },
   ];
}
