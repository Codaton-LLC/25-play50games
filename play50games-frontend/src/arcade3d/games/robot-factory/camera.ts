import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";

const DEG = Math.PI / 180;
export const CAMERA = { position: [0, 7.2, 8.5] as [number, number, number], fov: 40, lookAt: [0, 0.75, 0.1] as [number, number, number] };
export const FOCUS = { x: CAMERA.lookAt[0], y: CAMERA.lookAt[1], z: CAMERA.lookAt[2] };

export const PORTRAIT_AREA = { min: { x: -1.35, y: 0, z: -1.05 }, max: { x: 1.35, y: 1.95, z: 1.2 } };
export const LANDSCAPE_AREA = { min: { x: -2.0, y: 0, z: -0.95 }, max: { x: 2.0, y: 1.65, z: 0.95 } };
export const DESKTOP_AREA = { min: { x: -3.0, y: 0, z: -1.1 }, max: { x: 3.0, y: 1.95, z: 1.3 } };

export const PORTRAIT_VIEW: FittedViewOptions = {
   area: PORTRAIT_AREA,
   focus: [FOCUS],
   pitch: 38 * DEG,
   yaws: [0],
   fov: CAMERA.fov,
   padding: 6,
   margin: { top: 0.02, bottom: 0.02, left: 0.02, right: 0.02 },
   shift: true,
   maxDistance: 80,
};

export const LANDSCAPE_VIEW: FittedViewOptions = {
   area: LANDSCAPE_AREA,
   focus: [FOCUS],
   pitch: 32 * DEG,
   yaws: [0],
   fov: CAMERA.fov,
   padding: 6,
   margin: { top: 0.02, bottom: 0.02, left: 0.02, right: 0.02 },
   shift: true,
   maxDistance: 80,
};

export const DESKTOP_VIEW: FittedViewOptions = {
   area: DESKTOP_AREA,
   focus: [FOCUS],
   pitch: 38 * DEG,
   yaws: [0],
   fov: CAMERA.fov,
   padding: 6,
   margin: { top: 0.02, bottom: 0.02, left: 0.02, right: 0.02 },
   shift: true,
   maxDistance: 80,
};

/**
 * Camera fit for the canvas:
 * - Phone portrait (< 600 width, portrait): tighter area so parts, claw, card >= 24 CSS px.
 * - Phone landscape (compact, short height): lower pitch (32 deg) and tighter bounds for >= 24 CSS px.
 * - Desktop: keeps the original wide 6 m area at pitch 38 deg.
 */
export function viewFor(width: number, height: number): FittedViewOptions {
   const isPortrait = width < height;
   const compact = Math.min(width, height) < 600;
   if (isPortrait) return PORTRAIT_VIEW;
   if (compact) return LANDSCAPE_VIEW;
   return DESKTOP_VIEW;
}

/**
 * Texture slot X placement on the 1024 px wide blueprint board.
 * Leaves the center zone [475, 549] clear so the claw rod at x=0 never overlaps any card.
 */
export function getSlotX(size: number, i: number): { x: number; w: number } {
   if (size === 4) {
      const slotW = 160;
      const gap = 20;
      if (i < 2) return { x: 135 + i * (slotW + gap), w: slotW };
      return { x: 549 + (i - 2) * (slotW + gap), w: slotW };
   }
   if (size === 3) {
      const slotW = 160;
      const gap = 20;
      if (i === 0) return { x: 315, w: slotW };
      return { x: 549 + (i - 1) * (slotW + gap), w: slotW };
   }
   // size === 5
   const slotW = 136;
   const gap = 16;
   if (i < 2) return { x: 187 + i * (slotW + gap), w: slotW };
   return { x: 549 + (i - 2) * (slotW + gap), w: slotW };
}
