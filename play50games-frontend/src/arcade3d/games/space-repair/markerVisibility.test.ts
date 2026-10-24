import { expect, it } from "vitest";
import { markerBounds, placeMarker } from "@/arcade3d/core/hud/markerPlacement";
import { markerHitsSuit } from "./markerVisibility";

it("hides landscape cookie-banner arrows overlapping the suit, including rotated corners", () => {
   const bounds = markerBounds({ width: 844, height: 390, hud: [], controls: [], obstructions: [{ left: 0, right: 844, top: 260, bottom: 390 }] });
   const arrow = placeMarker(0, -0.9, false, 844, 390, bounds, { visible: false, x: 0, y: 0, angle: 0 });
   expect(arrow.visible).toBe(true);
   const suit = { left: 400, right: 444, top: 210, bottom: 255 };
   expect(markerHitsSuit(arrow, suit)).toBe(true);
   expect(markerHitsSuit({ x: 381, y: 220 }, suit)).toBe(true);
   expect(markerHitsSuit({ x: 350, y: 220 }, suit)).toBe(false);
   expect(markerHitsSuit({ x: 422, y: 180 }, suit)).toBe(false);
});
