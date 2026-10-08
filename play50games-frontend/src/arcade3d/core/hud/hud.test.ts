// core/hud pure parts: where off-screen target arrows go (inside the safe area) and the timing ring.
import { describe, expect, it } from "vitest";
import { MARKER_MARGIN, markerBounds, placeMarker, type MarkerPlacement } from "./markerPlacement";
import { arcPath, inZone, judgeTiming, needlePosition, ringPoint, zoneLength, zoneProgress } from "./timingMath";

const W = 390;
const H = 844;
const EMPTY = { width: W, height: H, hud: [], controls: [], obstructions: [] };
const place = (): MarkerPlacement => ({ visible: false, x: 0, y: 0, angle: 0 });

describe("markerBounds", () => {
   it("is the canvas inset by the margin without any UI", () => {
      expect(markerBounds(EMPTY)).toEqual({ left: MARKER_MARGIN, top: MARKER_MARGIN, right: W - MARKER_MARGIN, bottom: H - MARKER_MARGIN });
   });

   it("stays below the top HUD and above the touch controls and the cookie banner", () => {
      const area = {
         ...EMPTY,
         hud: [
            { left: 8, top: 8, right: 120, bottom: 52 },
            { left: 300, top: 8, right: 382, bottom: 60 },
            { left: 0, top: 400, right: 60, bottom: 460 }, // a mid-screen side panel: ignored
         ],
         controls: [{ left: 16, top: 640, right: 156, bottom: 780 }],
         obstructions: [{ left: 0, top: 700, right: W, bottom: H }],
      };
      expect(markerBounds(area, 10)).toEqual({ left: 10, top: 70, right: W - 10, bottom: 640 - 10 });
   });

   it("falls back to the plain inset when the bands leave no room", () => {
      const area = { ...EMPTY, hud: [{ left: 0, top: 0, right: W, bottom: 420 }], obstructions: [{ left: 0, top: 425, right: W, bottom: H }] };
      expect(markerBounds(area, 10)).toEqual({ left: 10, top: 10, right: W - 10, bottom: H - 10 });
   });
});

describe("placeMarker", () => {
   const bounds = { left: 20, top: 100, right: 370, bottom: 700 };

   it("needs no arrow for a target inside the bounds", () => {
      expect(placeMarker(0, 0, false, W, H, bounds, place()).visible).toBe(false);
   });

   it("an arrow for a target under the HUD band (on screen but covered)", () => {
      // ndc y 0.9 = 42 px from the top: under the HUD band, above the bounds
      const p = placeMarker(0, 0.9, false, W, H, bounds, place());
      expect(p.visible).toBe(true);
      expect(p.y).toBeCloseTo(bounds.top);
      expect(p.angle).toBeCloseTo(-Math.PI / 2); // pointing up
   });

   it("puts an off-screen target's arrow on the bounds' edge, towards it", () => {
      const right = placeMarker(3, 0, false, W, H, bounds, place());
      expect(right.visible).toBe(true);
      expect(right.x).toBeCloseTo(bounds.right);
      expect(right.angle).toBeCloseTo(0, 1);
      const corner = placeMarker(-5, -5, false, W, H, bounds, place());
      expect(corner.x).toBeGreaterThanOrEqual(bounds.left - 1e-9);
      expect(corner.y).toBeLessThanOrEqual(bounds.bottom + 1e-9);
      // on the edge: one coordinate is on it
      const onEdge = Math.abs(corner.x - bounds.left) < 1e-6 || Math.abs(corner.y - bounds.bottom) < 1e-6;
      expect(onEdge).toBe(true);
      expect(corner.angle).toBeGreaterThan(Math.PI / 2); // down-left
   });

   it("never leaves the bounds for any off-screen direction", () => {
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
         const p = placeMarker(Math.cos(a) * 4, Math.sin(a) * 4, false, W, H, bounds, place());
         expect(p.visible).toBe(true);
         expect(p.x).toBeGreaterThanOrEqual(bounds.left - 1e-6);
         expect(p.x).toBeLessThanOrEqual(bounds.right + 1e-6);
         expect(p.y).toBeGreaterThanOrEqual(bounds.top - 1e-6);
         expect(p.y).toBeLessThanOrEqual(bounds.bottom + 1e-6);
      }
   });

   it("mirrors a target behind the camera and always shows it on the edge", () => {
      // behind and slightly to the right: its projection lands left of centre, the arrow points right
      const p = placeMarker(-0.2, 0, true, W, H, bounds, place());
      expect(p.visible).toBe(true);
      expect(p.x).toBeCloseTo(bounds.right);
      // dead behind: points down (turn around)
      const back = placeMarker((2 * ((bounds.left + bounds.right) / 2)) / W - 1, 1 - (2 * ((bounds.top + bounds.bottom) / 2)) / H, true, W, H, bounds, place());
      expect(back.visible).toBe(true);
      expect(back.angle).toBeCloseTo(Math.PI / 2);
   });

   it("hides on a broken projection", () => {
      expect(placeMarker(NaN, 0, false, W, H, bounds, place()).visible).toBe(false);
   });
});

describe("timing ring", () => {
   it("moves the needle round (loop) or back and forth (pingpong)", () => {
      expect(needlePosition(0.4, 1.6)).toBeCloseTo(0.25);
      expect(needlePosition(2.0, 1.6)).toBeCloseTo(0.25);
      expect(needlePosition(0.4, 1.6, "pingpong")).toBeCloseTo(0.5);
      expect(needlePosition(0.8, 1.6, "pingpong")).toBeCloseTo(1);
      expect(needlePosition(1.2, 1.6, "pingpong")).toBeCloseTo(0.5);
      expect(needlePosition(1, 0)).toBe(0);
   });

   it("zones, also wrapping through the top", () => {
      const zone = { start: 0.6, end: 0.7 };
      expect(zoneLength(zone)).toBeCloseTo(0.1);
      expect(inZone(0.65, zone)).toBe(true);
      expect(inZone(0.71, zone)).toBe(false);
      const wrap = { start: 0.95, end: 0.05 };
      expect(zoneLength(wrap)).toBeCloseTo(0.1);
      expect(inZone(0.99, wrap)).toBe(true);
      expect(inZone(0.02, wrap)).toBe(true);
      expect(inZone(0.5, wrap)).toBe(false);
      expect(zoneProgress(0, wrap)).toBeCloseTo(0.5);
   });

   it("grades perfect in the middle share, good in the rest, miss outside; the best zone wins", () => {
      const zone = { start: 0.6, end: 0.7 };
      expect(judgeTiming(0.65, zone)).toBe("perfect");
      expect(judgeTiming(0.664, zone)).toBe("perfect"); // within 0.3 / 2 of the middle
      expect(judgeTiming(0.67, zone)).toBe("good");
      expect(judgeTiming(0.61, zone)).toBe("good");
      expect(judgeTiming(0.75, zone)).toBe("miss");
      expect(judgeTiming(0.25, [zone, { start: 0.2, end: 0.3 }])).toBe("perfect");
      expect(judgeTiming(0.65, zone, 0)).toBe("good");
   });

   it("draws arcs clockwise from the top", () => {
      const p = ringPoint(0.25, 50, 50, 40);
      expect(p.x).toBeCloseTo(90);
      expect(p.y).toBeCloseTo(50);
      expect(arcPath({ start: 0, end: 0.25 }, 50, 50, 40)).toBe("M 50 10 A 40 40 0 0 1 90 50");
      expect(arcPath({ start: 0, end: 0.75 }, 50, 50, 40)).toContain(" 0 1 1 ");
      expect(arcPath({ start: 0, end: 1 }, 50, 50, 40)).toContain("A 40 40 0 1 1 50 90");
   });
});
