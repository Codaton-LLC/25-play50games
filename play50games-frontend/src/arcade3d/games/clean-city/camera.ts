// Clean the City camera (README "Scene and camera"): pitch 56°, yaw 0, follow 12%, damping 4, the
// whole floor in view; on phones (shorter side under 600 px) a follow camera around the cleaner.
// Plain data and pure helpers, shared by Scene.tsx (useFittedView + CameraRig), phone.test.ts and
// props.test.ts (which casts rays from these cameras to check the props never hide a litter piece).
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

// ---------- phones: a follow camera around the cleaner (README "Scene and camera", "Phones") ----------

/** A canvas whose shorter side is below this many CSS px is a phone: the camera frames a window around the cleaner, not the whole floor. */
export const PHONE_MAX_SIDE = 600;
/** The phone camera eases faster than the whole-floor one: it trails a 5 u/s cleaner by at most 5 / 6 = 0.83. */
export const PHONE_DAMPING = 6;

/**
 * The window kept on screen around the point the phone camera looks at (the cleaner, kept inside
 * `bounds`). useFittedView is translation-invariant, so the window is a box around the origin and
 * `focus` is the origin. Its top is the cleaner's height (0.95) plus a little.
 */
export const PORTRAIT_WINDOW: AABB = { min: { x: -4, y: 0, z: -4.5 }, max: { x: 4, y: 1, z: 3 } };
export const LANDSCAPE_WINDOW: AABB = { min: { x: -5, y: 0, z: -2.5 }, max: { x: 5, y: 1, z: 2 } };

/**
 * Where the phone camera may look so its window never shows past the floor's edge: the window's
 * extents inside the 28 x 28 floor. The cleaner's centre (at most 13.5 out) stays inside the window
 * whatever the clamp: `phone.test.ts` checks it.
 */
export function windowBounds(window: AABB): AABB {
   return {
      min: { x: -FLOOR_HALF - window.min.x, y: 0, z: -FLOOR_HALF - window.min.z },
      max: { x: FLOOR_HALF - window.max.x, y: 0, z: FLOOR_HALF - window.max.z },
   };
}

/** Everything the Scene's camera needs for one canvas: the fitted view's options and the CameraRig's follow. */
export interface CameraSetup {
   /** "floor": the whole floor, the follow drifts 12 %; "phone": a window around the cleaner */
   kind: "floor" | "phone";
   view: FittedViewOptions;
   followFraction: number;
   bounds: AABB;
   damping: number;
}

const ORIGIN_FOCUS = [{ x: 0, y: 0, z: 0 }] as const;
const MARGIN = { top: 0.02, bottom: 0.02, left: 0.02, right: 0.02 } as const;

function phoneSetup(window: AABB): CameraSetup {
   return {
      kind: "phone",
      view: { area: window, pitch: PITCH, yaws: [0], focus: ORIGIN_FOCUS, margin: MARGIN, padding: 8, shift: true, fov: FOV },
      followFraction: 1,
      bounds: windowBounds(window),
      damping: PHONE_DAMPING,
   };
}

/** The whole floor (desktop, tablets): the setup clean-city always had. */
export const FLOOR_CAMERA: CameraSetup = { kind: "floor", view: VIEW, followFraction: FOLLOW, bounds: REACH, damping: DAMPING };
export const PHONE_PORTRAIT: CameraSetup = phoneSetup(PORTRAIT_WINDOW);
export const PHONE_LANDSCAPE: CameraSetup = phoneSetup(LANDSCAPE_WINDOW);

/**
 * The camera for a canvas (CSS px). It depends on the canvas size only, never on the safe area, so
 * the cookie banner or a HUD change never swaps it mid-run (useFittedView then refits the distance
 * and the lens shift); a rotation or resize may swap it, and CameraRig eases into the new one.
 * Module-level constants, so useFittedView sees the same options object between renders.
 */
export function cameraFor(width: number, height: number): CameraSetup {
   if (Math.min(width, height) >= PHONE_MAX_SIDE) return FLOOR_CAMERA;
   return width < height ? PHONE_PORTRAIT : PHONE_LANDSCAPE;
}
