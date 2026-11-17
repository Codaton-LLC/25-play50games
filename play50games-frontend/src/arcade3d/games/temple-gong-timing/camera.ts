// The camera and the intro's shots (pure, no three.js). The card asks for "one fixed elevated stage
// camera"; Menu 2's pillar 10 asks for a free orbit. So play uses the shared orbit camera (menu2/camera)
// pivoting on the stage, not the hero: it looks over the whole arena from the front, high, and the
// player can still turn it (mouse drag, two fingers, keys) and zoom; its own auto-follow is off, so the
// view only moves when the player moves it. The pivot leans a little towards the hero so he never leaves
// the frame on a narrow phone. The stick is camera-relative (StepInput.yaw = orbit.viewYaw).
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import type { Stage } from "./chart";

const DEG = Math.PI / 180;
export const FOV = 50;
export const FOV_PORTRAIT = 66;

export function stageOrbit(stage: Stage): Partial<OrbitSettings> {
   return { yaw: 0, pitch: (stage.cfg.boss ? 34 : 38) * DEG, distance: 17, minDistance: 8, maxDistance: 26, autoFollow: false };
}

export function orbitScale(aspect: number): number {
   const portrait = Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
   return 1 + 0.45 * portrait;
}

/** The pivot: the stage's middle, leaning 35 % towards the hero. */
export function stagePivot(h: { x: number; z: number }, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   out.x = h.x * 0.35;
   out.y = 1.2;
   out.z = h.z * 0.35 - 1;
   return out;
}

export function playCamera(stage: Stage, aspect: number): IntroKeyframe {
   const o = stageOrbit(stage);
   const p = stagePivot({ x: 0, z: 0 }, { x: 0, y: 0, z: 0 });
   const cam = orbitPosition(p.x, p.y, p.z, o.yaw ?? 0, o.pitch ?? 0, (o.distance ?? 17) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [cam.x, cam.y, cam.z], lookAt: [p.x, p.y, p.z] };
}

/** The fly-through: down over the gongs from behind, round the side, to the front of the stage. */
export function introKeyframes(): IntroKeyframe[] {
   return [
      { position: [0, 14, -18], lookAt: [0, 1, -4] },
      { position: [-16, 7, -2], lookAt: [0, 1.5, -3] },
      { position: [0, 9, 15], lookAt: [0, 1, -1] },
   ];
}
