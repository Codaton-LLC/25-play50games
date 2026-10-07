import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";

export const CAMERA_FOV = 40;
export const CAMERA_LOOK_AT: [number, number, number] = [0, 1.22, 0];
const CAMERA_PITCH = Math.atan2(4 - CAMERA_LOOK_AT[1], 20);
const CAMERA_MIN_DISTANCE = Math.hypot(4 - CAMERA_LOOK_AT[1], 20);

/** Union of the README goal guard and the moving striker, ball and penalty spot bounds. */
export const PENALTY_FIT_AREA: AABB = {
   min: { x: -4.06, y: -0.4, z: 0 },
   max: { x: 4.06, y: 2.84, z: 12.1 },
};

/** The core fit keeps the complete playable composition clear of HUD, controls and page overlays. */
export const PENALTY_VIEW: FittedViewOptions = {
   area: PENALTY_FIT_AREA,
   pitch: CAMERA_PITCH,
   yaws: [0],
   focus: [{ x: CAMERA_LOOK_AT[0], y: CAMERA_LOOK_AT[1], z: CAMERA_LOOK_AT[2] }],
   fov: CAMERA_FOV,
   padding: 10,
   shift: true,
   minDistance: CAMERA_MIN_DISTANCE,
};
