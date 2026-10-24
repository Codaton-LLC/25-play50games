import type { ScreenRect } from "@/arcade3d/core/safeArea";

export const MARKER_SIZE = 28;
export function markerHitsSuit(marker: { x: number; y: number }, suit: ScreenRect): boolean {
   // A rotated square reaches half its diagonal; include rounding and shadow clearance.
   const pad = MARKER_SIZE / Math.SQRT2 + 3;
   return marker.x + pad >= suit.left && marker.x - pad <= suit.right
      && marker.y + pad >= suit.top && marker.y - pad <= suit.bottom;
}
