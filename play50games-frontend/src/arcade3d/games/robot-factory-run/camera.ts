import { DEFAULT_ORBIT } from "../../menu2/camera/orbit";
import type { IntroKeyframe } from "../../core/intro/introMachine";
import type { AABB } from "../../core/collision";
export const FACTORY_ORBIT = { ...DEFAULT_ORBIT, yaw: 0.25, pitch: 0.76, distance: 17, minDistance: 5, maxDistance: 28, minPitch: 0.15, maxPitch: 1.35, autoFollowDelay: 4, autoFollowRate: 0.45 };
export const INTRO_SHOTS: IntroKeyframe[] = [
   { position: [14, 14, 12], lookAt: [1, 1, 0] },
   { position: [4, 7, -1], lookAt: [-2, 0, 0] },
   { position: [-6, 5, 6], lookAt: [-4, 0, 2] },
];
export const PLAY_CAMERA: IntroKeyframe = { position: [-3.8, 12.7, 15.5], lookAt: [-8, 0.8, 3.5] };
export function factorySolids(out: AABB[]): number {
   const boxes = [[-10, -1, -11, 10, 14, -9.5], [-7, 0, -5, -5, 1.3, -3.2], [-5, 0, -5, -3, 1.3, -3.2]];
   boxes.forEach((b, i) => { out[i].min.x = b[0]; out[i].min.y = b[1]; out[i].min.z = b[2]; out[i].max.x = b[3]; out[i].max.y = b[4]; out[i].max.z = b[5]; });
   return boxes.length;
}
