import type { AABB } from "@/arcade3d/core/collision";
import { followFocus } from "@/arcade3d/core/view";

export const FOV = 45;
export const PITCH = 50 * (Math.PI / 180);
export const YAWS = [0] as const;

export const VALLEY_BOUNDS: AABB = {
   min: { x: -15, y: 0, z: -11 },
   max: { x: 15, y: 0, z: 11 },
};

/** The local focus area kept visible in portrait and landscape clear of HUD and banner. */
export const PLAY_AREA: AABB = {
   min: { x: -6.5, y: 0, z: -5.5 },
   max: { x: 6.5, y: 1.5, z: 5.5 },
};

export const DINO_REACH: AABB = {
   min: { x: -14.45, y: 0, z: -10.45 },
   max: { x: 14.45, y: 0, z: 10.45 },
};

export const FOLLOW_FOCUS_POINTS = followFocus({
   lookAt: [0, 0, 0],
   reach: DINO_REACH,
   fraction: 1,
   bounds: VALLEY_BOUNDS,
});
