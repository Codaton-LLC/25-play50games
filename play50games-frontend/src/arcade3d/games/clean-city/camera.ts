// Clean the City camera (README "Scene and camera"): pitch 56°, yaw 0, follow 12%, damping 4.
// Plain data and pure helpers, shared by Scene.tsx (useFittedView + CameraRig) and props.test.ts
// (which casts rays from these cameras to check the props never hide a litter piece).
import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { followFocus } from "@/arcade3d/core/view";
import { FLOOR_HALF, SPAWN_HALF } from "./rules";

export const PITCH = (56 * Math.PI) / 180;
export const LOOK_AT: [number, number, number] = [0, 0, 0];
export const FOLLOW = 0.12;
export const FOV = 45;
export const DAMPING = 4;
/** Where the runner's centre can be. followFocus and CameraRig share it. */
export const REACH: AABB = {
   min: { x: -SPAWN_HALF, y: 0, z: -SPAWN_HALF },
   max: { x: SPAWN_HALF, y: 0, z: SPAWN_HALF },
};
/** The whole 28 x 28 floor, plus room for the tallest prop, from every follow point. */
export const FLOOR: AABB = {
   min: { x: -FLOOR_HALF, y: 0, z: -FLOOR_HALF },
   max: { x: FLOOR_HALF, y: 2.6, z: FLOOR_HALF },
};
export const FOCUS = followFocus({ lookAt: LOOK_AT, reach: REACH, fraction: FOLLOW });
export const VIEW: FittedViewOptions = {
   area: FLOOR,
   pitch: PITCH,
   yaws: [0],
   focus: FOCUS,
   margin: { top: 0.02, bottom: 0.02, left: 0.02, right: 0.02 },
   padding: 8,
   shift: true,
   fov: FOV,
};
