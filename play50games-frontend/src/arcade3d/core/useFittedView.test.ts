import { describe, expect, it } from "vitest";
import type { AABB } from "./collision";
import type { SafeArea, ScreenRect } from "./safeArea";
import { bottomStrip } from "./safeArea";
import { fitLiveView, type LiveFitInput, type YawLock } from "./useFittedView";
import { followFocus } from "./view";

/** Robot Collector's warehouse and camera options. */
const FLOOR: AABB = { min: { x: -12.4, y: 0, z: -8.4 }, max: { x: 12.4, y: 0.9, z: 8.4 } };
const VIEW = {
   fov: 45,
   area: FLOOR,
   pitch: (56 * Math.PI) / 180,
   yaws: [0, Math.PI / 2],
   focus: followFocus({ reach: { min: { x: -12, y: 0, z: -8 }, max: { x: 12, y: 0, z: 8 } }, fraction: 0.12 }),
   margin: { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 },
   padding: 8,
};

/** The shell's safe area on a touch phone, with the cookie banner `banner` px tall. */
function safeArea(width: number, height: number, banner: number): SafeArea {
   const joystick: ScreenRect = { left: 20, top: height - 20 - banner - 132, right: 152, bottom: height - 20 - banner };
   return {
      width,
      height,
      hud: [
         { left: 10, top: 10, right: 218, bottom: 52 },
         { left: width - 104, top: 10, right: width - 10, bottom: 54 },
      ],
      controls: [joystick],
      obstructions: bottomStrip({ top: 0, width, height }, height, banner),
   };
}

const input = (width: number, height: number, extra: Partial<LiveFitInput> = {}): LiveFitInput => ({ ...VIEW, width, height, ...extra });

describe("useFittedView (fitLiveView)", () => {
   it("keeps the yaw when only the safe area changes (the banner never turns the camera mid-run)", () => {
      for (const shift of [false, true]) {
         const first = fitLiveView(input(375, 812, { shift }), safeArea(375, 812, 0), null);
         expect(first.view.yaw).toBe(Math.PI / 2);
         // without the lock this banner would turn the camera (the old behaviour) ...
         const fresh = fitLiveView(input(375, 812), safeArea(375, 812, 165), null);
         expect(fresh.view.yaw).toBe(0);
         // ... with it, the yaw stays and so does the input mapping
         const banner = fitLiveView(input(375, 812, { shift }), safeArea(375, 812, 165), first.lock);
         expect(banner.view.yaw).toBe(Math.PI / 2);
         const closed = fitLiveView(input(375, 812, { shift }), safeArea(375, 812, 0), banner.lock);
         expect(closed.view).toEqual(first.view);
      }
   });

   it("with shift, the banner changes the shift, not the size", () => {
      const first = fitLiveView(input(375, 812, { shift: true }), safeArea(375, 812, 0), null);
      const banner = fitLiveView(input(375, 812, { shift: true }), safeArea(375, 812, 165), first.lock);
      expect(banner.view.distance).toBeCloseTo(first.view.distance, 6);
      expect(banner.view.shift[1]).toBeGreaterThan(first.view.shift[1] + 0.2);
   });

   it("picks the yaw again when the canvas size changes or the safe area is first measured", () => {
      const portrait = fitLiveView(input(375, 812), safeArea(375, 812, 0), null);
      const landscape = fitLiveView(input(812, 375), safeArea(812, 375, 0), portrait.lock);
      expect(landscape.view.yaw).toBe(0);
      const unmeasured: YawLock = { ...portrait.lock, measured: false, yaw: 0 };
      expect(fitLiveView(input(375, 812), safeArea(375, 812, 0), unmeasured).view.yaw).toBe(Math.PI / 2);
      // a lock whose yaw is no longer offered is dropped
      expect(fitLiveView(input(375, 812, { yaws: [0] }), safeArea(375, 812, 0), portrait.lock).view.yaw).toBe(0);
   });

   it("avoids the banner strip and extra rects unless told not to", () => {
      const safe = safeArea(812, 375, 120);
      const lock = fitLiveView(input(812, 375, { shift: true }), safeArea(812, 375, 0), null).lock;
      const avoided = fitLiveView(input(812, 375, { shift: true }), safe, lock).view;
      const ignored = fitLiveView(input(812, 375, { shift: true, avoidObstructions: false }), safe, lock).view;
      expect(avoided.distance).toBeGreaterThan(ignored.distance);
      const extra = fitLiveView(input(812, 375, { shift: true, avoid: [{ left: 300, top: 150, right: 500, bottom: 230 }] }), safeArea(812, 375, 0), lock);
      expect(extra.view.distance).toBeGreaterThan(fitLiveView(input(812, 375, { shift: true }), safeArea(812, 375, 0), lock).view.distance);
   });
});

describe("bottomStrip", () => {
   it("is the part of the window's bottom strip that covers the canvas", () => {
      expect(bottomStrip({ top: 0, width: 375, height: 812 }, 812, 0)).toEqual([]);
      expect(bottomStrip({ top: 0, width: 375, height: 812 }, 812, 165)).toEqual([{ left: 0, top: 647, right: 375, bottom: 812 }]);
      // a canvas 100 px down the page, ending 50 px above the window bottom
      expect(bottomStrip({ top: 100, width: 300, height: 600 }, 750, 80)).toEqual([{ left: 0, top: 570, right: 300, bottom: 600 }]);
      expect(bottomStrip({ top: 100, width: 300, height: 600 }, 750, 40)).toEqual([]);
   });
});
