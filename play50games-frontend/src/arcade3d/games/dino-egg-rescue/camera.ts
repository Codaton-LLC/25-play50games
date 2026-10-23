import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";

export const FOV = 45;
export const PITCH = (50 * Math.PI) / 180;
/** Phone landscape looks down more steeply: the short screen side is the valley's depth, so the far row foreshortens less. */
export const PITCH_LANDSCAPE = (60 * Math.PI) / 180;
export const YAWS = [0] as const;

export const VALLEY_BOUNDS: AABB = {
   min: { x: -15, y: 0, z: -11 },
   max: { x: 15, y: 0, z: 11 },
};

const ORIGIN = [{ x: 0, y: 0, z: 0 }];
const MARGIN = { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 };

const VIEWS = new Map<string, FittedViewOptions>();

/**
 * Camera fit for this canvas size (measured with tools in the README "Camera" table).
 * Follow fraction is 1, so the area is centred on the dino and focus is the origin.
 * Phones (shorter side < 600 CSS px) get a tighter window so the dino, eggs and boulders
 * stay >= 24 CSS px with the cookie banner open: portrait 8.0 x 10.8 m at pitch 50 deg,
 * landscape 10.6 x 7.4 m at pitch 60 deg (the short side is the valley's depth, so a
 * steeper look keeps the far row from foreshortening). Larger screens keep the wider
 * 11 x 15 m / 16 x 11 m window at pitch 50 deg.
 */
export function viewFor(width: number, height: number): FittedViewOptions {
   const isPortrait = width < height;
   const compact = Math.min(width, height) < 600;
   const hx = isPortrait ? (compact ? 4.0 : 5.5) : compact ? 5.3 : 8.0;
   const hz = isPortrait ? (compact ? 5.4 : 7.5) : compact ? 3.7 : 5.5;
   const pitch = !isPortrait && compact ? PITCH_LANDSCAPE : PITCH;

   const key = `${hx}x${hz}x${pitch}x${Math.round(width)}x${Math.round(height)}`;
   let view = VIEWS.get(key);
   if (!view) {
      const area: AABB = {
         min: { x: -hx, y: 0, z: -hz },
         max: { x: hx, y: 1.5, z: hz },
      };
      view = {
         area,
         pitch,
         yaws: YAWS,
         focus: ORIGIN,
         margin: MARGIN,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(key, view);
   }
   return view;
}
