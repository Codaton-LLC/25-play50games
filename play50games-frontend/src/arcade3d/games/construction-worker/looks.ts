// Camera fit for the site wedge. One yaw per canvas shape so the picker cannot turn the
// portrait view sideways. The live look-at point is LOOK (Scene moves its y with the roof).
import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";

export const PITCH = (40 * Math.PI) / 180;
export const FOV = 42;
export const YAW = 0.6;

const AREA: AABB = { min: { x: -8, y: 0, z: -2 }, max: { x: 8, y: 4.5, z: 12 } };
const FOCUS = [{ x: 0, y: 0.5, z: 5 }];
const MARGIN = { top: 0.1, bottom: 0.08, left: 0.02, right: 0.02 };
const BASE = { area: AREA, pitch: PITCH, focus: FOCUS, margin: MARGIN, padding: 8, shift: true as const, fov: FOV };

const PORTRAIT: FittedViewOptions = { ...BASE, yaws: [YAW] };
const WIDE: FittedViewOptions = { ...BASE, yaws: [YAW + Math.PI / 2] };

/** Portrait and desktop use yaw 0.6. A short wide phone (width / height > 1.9) turns a quarter turn. */
export function viewFor(width: number, height: number): FittedViewOptions {
   return width / Math.max(1, height) > 1.9 ? WIDE : PORTRAIT;
}

/** CameraRig follows this. y = 0.35 * roof height, written from the run each frame. */
export const LOOK = { x: 0, y: 0.5, z: 5 };
