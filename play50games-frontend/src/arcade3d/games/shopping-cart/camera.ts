// Crazy Shopping Cart camera (README "Scene and camera"): follow 3/4 top-down view.
// Pure math and view configuration, shared by Scene.tsx and tests.
import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";

/** Camera tilt: three-quarter top-down view (50°), matching treasure-island. */
export const PITCH = (50 * Math.PI) / 180;

/** Vertical field of view (degrees). */
export const FOV = 45;

/** Look-at point origin. */
export const ORIGIN = [{ x: 0, y: 0, z: 0 }];

/** Yaw options: looking north (-z). */
export const YAWS = [0];

/** Store bounds where the camera target can be clamped. */
export const STORE_BOUNDS: AABB = {
   min: { x: -14, y: 0, z: -10 },
   max: { x: 14, y: 2, z: 10 },
};

/**
 * Window sizing: aims for 52 px/m on mobile (runner ~81 px, cart ~52 px, products ~42 px with halo),
 * scaling up to a 14 x 14 m window on desktop screens.
 */
export const WINDOW = {
   pxPerM: 52,
   minHalfX: 3.5,
   maxHalfX: 7.0,
   minHalfZ: 3.5,
   maxHalfZ: 7.0,
   depthPerWidth: 1.4,
   height: 2.0,
} as const;

/** Calculates half extents (m) for a canvas of width x height CSS px in 0.25 m increments. */
export function windowHalf(width: number, height: number): { hx: number; hz: number } {
   const step = (v: number) => Math.round(v * 4) / 4;
   const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
   const hx = step(clamp(width / (2 * WINDOW.pxPerM), WINDOW.minHalfX, WINDOW.maxHalfX));
   const hz = step(
      clamp(
         height / (2 * WINDOW.pxPerM * Math.sin(PITCH)),
         WINDOW.minHalfZ,
         Math.min(WINDOW.maxHalfZ, WINDOW.depthPerWidth * hx)
      )
   );
   return { hx, hz };
}

const VIEWS = new Map<string, FittedViewOptions>();
const MARGIN = { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 };

/**
 * Returns fitted view options for the given canvas dimensions.
 * Uses cached views so useFittedView only refits when dimensions step.
 */
export function viewFor(width: number, height: number): FittedViewOptions {
   const { hx, hz } = windowHalf(width, height);
   const key = `${hx}x${hz}`;
   let view = VIEWS.get(key);
   if (!view) {
      const area: AABB = {
         min: { x: -hx, y: 0, z: -hz },
         max: { x: hx, y: WINDOW.height, z: hz },
      };
      view = {
         area,
         pitch: PITCH,
         yaws: YAWS,
         focus: ORIGIN,
         margin: MARGIN,
         padding: 8,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(key, view);
   }
   return view;
}
