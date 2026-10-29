// Player camera zoom: the mouse wheel, a two-finger pinch and the + / - keys scale a follow
// camera's distance (CameraRig `zoom`). Owned by Claude. This file is pure (no React, no DOM
// types beyond plain numbers); the hook is useCameraZoom.tsx.
//
// zoom = the factor on the camera's offset: 1 = the fitted view, < 1 closer, > 1 further.

export interface ZoomLimits {
   /** closest (smallest factor) */
   min: number;
   /** furthest (largest factor) */
   max: number;
}

export const clampZoom = (zoom: number, limits: ZoomLimits): number => Math.min(limits.max, Math.max(limits.min, zoom));

/**
 * A wheel step: deltaY > 0 (scrolling down / towards the user) moves the camera out. Pixel and line
 * deltas both work (`deltaMode` 1 = lines, ~16 px each); one notch (100 px) is about 16 %.
 */
export function wheelZoom(zoom: number, deltaY: number, deltaMode: number, limits: ZoomLimits): number {
   const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
   const step = Math.max(-300, Math.min(300, px));
   return clampZoom(zoom * Math.exp(step * 0.0015), limits);
}

/** A pinch: spreading the fingers (distance grows) moves the camera in, as on a map. */
export function pinchZoom(startZoom: number, startDistance: number, distance: number, limits: ZoomLimits): number {
   if (!(startDistance > 0) || !(distance > 0)) return clampZoom(startZoom, limits);
   return clampZoom((startZoom * startDistance) / distance, limits);
}

/** A key step: "in" or "out" by 15 %. */
export function keyZoom(zoom: number, direction: "in" | "out", limits: ZoomLimits): number {
   return clampZoom(direction === "in" ? zoom / 1.15 : zoom * 1.15, limits);
}
