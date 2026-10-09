import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";

export const FOV = 45;
export const PITCH = (50 * Math.PI) / 180;
export const YAWS = [0] as const;

export const VALLEY_BOUNDS: AABB = {
   min: { x: -15, y: 0, z: -11 },
   max: { x: 15, y: 0, z: 11 },
};

const ORIGIN = [{ x: 0, y: 0, z: 0 }];
const MARGIN = { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 };

const VIEWS = new Map<string, FittedViewOptions>();

/**
 * Camera fit for this canvas size.
 * Follow fraction is 1, so the area is centered on the dino and focus is the origin.
 * Portrait: 11.0 x 15.0 m local area (~35 px/m on 390x844 with cookie banner open).
 * Landscape: 16.0 x 11.0 m local area (~28 px/m on 844x390 with cookie banner open).
 * Dino, eggs, boulders all >= 24 CSS px at both sizes.
 */
export function viewFor(width: number, height: number): FittedViewOptions {
   const isPortrait = width < height;
   const hx = isPortrait ? 5.5 : 8.0;
   const hz = isPortrait ? 7.5 : 5.5;

   const key = `${hx}x${hz}x${Math.round(width)}x${Math.round(height)}`;
   let view = VIEWS.get(key);
   if (!view) {
      const area: AABB = {
         min: { x: -hx, y: 0, z: -hz },
         max: { x: hx, y: 1.5, z: hz },
      };
      view = {
         area,
         pitch: PITCH,
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
