// Tower-specific fit configuration. Projection/follow/lens math belongs to the core.
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { followFocus } from "@/arcade3d/core/view";

export const FOV = 45;
export const LOOK_AT: [number, number, number] = [0, 1, 0];
export const FOLLOW_DAMPING = 8;
export const AREA = { min: { x: -2.3, y: -2, z: -0.6 }, max: { x: 2.3, y: 4, z: 0.6 } };
export const VIEW: FittedViewOptions = {
   area: AREA,
   pitch: Math.atan(2 / Math.sqrt(153)),
   yaws: [Math.atan(3 / 12)],
   focus: followFocus({ lookAt: LOOK_AT, reach: { min: { x: 0, y: 0.5, z: 0 }, max: { x: 0, y: 1, z: 0 } }, fraction: 1 }),
   margin: { top: 0.02, right: 0.02, bottom: 0.02, left: 0.02 },
   padding: 8,
   shift: true,
   fov: FOV,
};
