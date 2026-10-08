// Off-screen target arrows (core/hud <TargetMarkers>): where on the screen the arrow for a world
// target goes. Pure, no DOM, no three.js. Tested in hud.test.ts.
//
// The arrows live inside the "marker bounds": the canvas minus a margin, minus the HUD bands at the
// top and whatever covers the bottom (touch controls, the cookie banner, the home indicator), all
// from useSafeArea(). A target inside those bounds and in front of the camera needs no arrow; any
// other one gets an arrow on the bounds' edge, on the line from the bounds' centre towards it,
// pointing at it. A target behind the camera is mirrored first (its projection is flipped), so its
// arrow points the way the player has to turn.
import type { SafeArea, ScreenRect } from "../safeArea";

/** Default gap between the arrows and the canvas edge or the covered bands, CSS px. */
export const MARKER_MARGIN = 28;

/**
 * The rectangle arrows stay inside (CSS px from the canvas top-left): the canvas inset by `margin`,
 * below every HUD rect in the top half and above every HUD rect, touch control and obstruction in
 * the bottom half. Rects in the middle of the screen (a side panel) are ignored. Falls back to the
 * plain inset when the bands leave no room.
 */
export function markerBounds(area: Pick<SafeArea, "width" | "height" | "hud" | "controls" | "obstructions">, margin = MARKER_MARGIN): ScreenRect {
   const { width, height } = area;
   let topBand = 0;
   let bottomBand = 0;
   const half = height / 2;
   const take = (r: ScreenRect) => {
      if (r.right <= 0 || r.left >= width || r.bottom <= r.top) return;
      if (r.bottom <= half) topBand = Math.max(topBand, r.bottom);
      else if (r.top >= half) bottomBand = Math.max(bottomBand, height - r.top);
   };
   area.hud.forEach(take);
   area.controls.forEach(take);
   area.obstructions.forEach(take);
   const plain = { left: margin, top: margin, right: width - margin, bottom: height - margin };
   const bounds = { left: margin, top: topBand + margin, right: width - margin, bottom: height - bottomBand - margin };
   if (bounds.right - bounds.left < 2 || bounds.bottom - bounds.top < 2) return plain;
   return bounds;
}

export interface MarkerPlacement {
   /** an arrow is needed (the target is off screen, behind the camera or under the HUD) */
   visible: boolean;
   /** arrow centre, CSS px from the canvas top-left */
   x: number;
   y: number;
   /** the arrow's direction, rad, screen axes (0 = right, PI / 2 = down): CSS rotate(angle) */
   angle: number;
}

/**
 * Places the arrow of one target from its projection: `ndcX` / `ndcY` (-1..1, y up, as
 * Vector3.project gives) and `behind` (the target is behind the camera), on a canvas of `width` x
 * `height` CSS px, inside `bounds` (markerBounds). Writes into `out` (no allocation).
 */
export function placeMarker(ndcX: number, ndcY: number, behind: boolean, width: number, height: number, bounds: ScreenRect, out: MarkerPlacement): MarkerPlacement {
   let sx = ((ndcX + 1) / 2) * width;
   let sy = ((1 - ndcY) / 2) * height;
   if (behind) {
      // the projection of a point behind the camera is flipped through the centre
      sx = width - sx;
      sy = height - sy;
   }
   if (!Number.isFinite(sx) || !Number.isFinite(sy)) {
      out.visible = false;
      return out;
   }
   if (!behind && sx >= bounds.left && sx <= bounds.right && sy >= bounds.top && sy <= bounds.bottom) {
      out.visible = false;
      out.x = sx;
      out.y = sy;
      return out;
   }
   const cx = (bounds.left + bounds.right) / 2;
   const cy = (bounds.top + bounds.bottom) / 2;
   let dx = sx - cx;
   let dy = sy - cy;
   if (dx === 0 && dy === 0) dy = 1; // straight behind: point down (turn around)
   const tx = dx > 0 ? (bounds.right - cx) / dx : dx < 0 ? (bounds.left - cx) / dx : Infinity;
   const ty = dy > 0 ? (bounds.bottom - cy) / dy : dy < 0 ? (bounds.top - cy) / dy : Infinity;
   // behind: always on the edge, however close to the centre its mirror image is
   const t = behind ? Math.min(tx, ty) : Math.min(1, tx, ty);
   out.visible = true;
   out.x = cx + dx * t;
   out.y = cy + dy * t;
   out.angle = Math.atan2(dy, dx);
   return out;
}
