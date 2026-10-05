import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import type { AABB, Vec3Like } from "./collision";
import { fitView, followAim, followFocus, setLensShift, type FitViewOptions, type FittedView, type ScreenRect } from "./view";

const ORIGIN = { x: 0, y: 0, z: 0 };
/** A 2 x 2 wall facing the camera (z = 0), centred on the origin. */
const WALL: AABB = { min: { x: -1, y: -1, z: 0 }, max: { x: 1, y: 1, z: 0 } };
/** A 24 x 16 floor with 0.9-high walls (Robot Collector's warehouse). */
const FLOOR: AABB = { min: { x: -12.4, y: 0, z: -8.4 }, max: { x: 12.4, y: 0.9, z: 8.4 } };
const PITCH = (56 * Math.PI) / 180;
const corners = (box: AABB): Vector3[] =>
   [box.min.x, box.max.x].flatMap((x) => [box.min.y, box.max.y].flatMap((y) => [box.min.z, box.max.z].map((z) => new Vector3(x, y, z))));

/** Screen positions (CSS px from the top-left) of the box corners for a fitted view (with its lens shift, as CameraRig sets it). */
function cornersOnScreen(box: AABB, view: FittedView, options: Pick<FitViewOptions, "width" | "height" | "fov">, focus: Vec3Like = ORIGIN, scale = 1) {
   const cam = new PerspectiveCamera(options.fov, options.width / options.height, 0.1, 1000);
   if (view.shift[0] !== 0 || view.shift[1] !== 0) setLensShift(cam, view.shift[0], view.shift[1], options.width, options.height);
   cam.position.set(focus.x + view.offset[0] * scale, focus.y + view.offset[1] * scale, focus.z + view.offset[2] * scale);
   cam.lookAt(focus.x, focus.y, focus.z);
   cam.updateMatrixWorld();
   return corners(box).map((p) => {
      p.project(cam);
      return { x: ((p.x + 1) / 2) * options.width, y: ((1 - p.y) / 2) * options.height };
   });
}

describe("fitView", () => {
   it("matches the analytic distance: a 2-unit wall at fov 90 fills the screen from 1 unit away", () => {
      const base = { width: 400, height: 400, fov: 90, area: WALL, pitch: 0, focus: [ORIGIN] };
      expect(fitView(base).distance).toBeCloseTo(1, 6);
      // keep a quarter of the height clear at top and bottom: the wall must be half as tall
      expect(fitView({ ...base, margin: { top: 0.25, bottom: 0.25 } }).distance).toBeCloseTo(2, 6);
      // a wide screen: the height still decides
      expect(fitView({ ...base, width: 800 }).distance).toBeCloseTo(1, 6);
      // a tall screen: the width decides (half as wide as high -> twice as far)
      expect(fitView({ ...base, height: 800 }).distance).toBeCloseTo(2, 6);
   });

   it("returns the offset for its yaw, pitch and distance", () => {
      const view = fitView({ width: 400, height: 400, fov: 90, area: WALL, pitch: 0, yaws: [Math.PI / 2], focus: [ORIGIN] });
      expect(view.yaw).toBe(Math.PI / 2);
      // from the side the wall is a line: the only limit is its height
      expect(view.offset[0]).toBeCloseTo(view.distance, 9);
      expect(view.offset[1]).toBeCloseTo(0, 9);
      expect(view.offset[2]).toBeCloseTo(0, 9);
   });

   it("is the closest fit: everything inside the margins, and 1% closer it is not", () => {
      const options = { width: 812, height: 375, fov: 45 };
      const margin = { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 };
      const view = fitView({ ...options, area: FLOOR, pitch: PITCH, yaws: [0, Math.PI / 2], focus: [ORIGIN], margin });
      const inside = (scale: number) =>
         cornersOnScreen(FLOOR, view, options, ORIGIN, scale).every(
            (p) =>
               p.x >= margin.left * options.width - 1e-6 &&
               p.x <= (1 - margin.right) * options.width + 1e-6 &&
               p.y >= margin.top * options.height - 1e-6 &&
               p.y <= (1 - margin.bottom) * options.height + 1e-6
         );
      expect(inside(1)).toBe(true);
      expect(inside(0.99)).toBe(false);
   });

   it("turns the camera for portrait screens and not for landscape ones", () => {
      const base = { fov: 45, area: FLOOR, pitch: PITCH, yaws: [0, Math.PI / 2] };
      expect(fitView({ ...base, width: 812, height: 375 }).yaw).toBe(0);
      expect(fitView({ ...base, width: 1280, height: 800 }).yaw).toBe(0);
      expect(fitView({ ...base, width: 375, height: 812 }).yaw).toBe(Math.PI / 2);
   });

   it("must fit from every focus point of a follow camera", () => {
      const base = { width: 1280, height: 800, fov: 45, area: FLOOR, pitch: PITCH };
      const still = fitView(base);
      const follow = fitView({ ...base, focus: [{ x: -1.5, y: 0, z: -1 }, { x: 1.5, y: 0, z: 1 }] });
      expect(follow.distance).toBeGreaterThan(still.distance);
   });

   it("keeps the box out from under a joystick rect, with padding", () => {
      const options = { width: 812, height: 375, fov: 45 };
      const joystick: ScreenRect = { left: 20, top: 375 - 152, right: 152, bottom: 375 - 20 };
      const margin = { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 };
      const free = fitView({ ...options, area: FLOOR, pitch: PITCH, margin });
      const view = fitView({ ...options, area: FLOOR, pitch: PITCH, margin, avoid: [joystick], padding: 8 });
      // the joystick is in the way at this size, so the camera moves back
      expect(view.distance).toBeGreaterThan(free.distance);
      const screen = cornersOnScreen(FLOOR, view, options);
      // the near-left corner of the floor stays right of or above the padded joystick
      const nearLeft = screen.reduce((a, b) => (b.y - b.x > a.y - a.x ? b : a));
      expect(nearLeft.x >= joystick.right + 8 - 1e-6 || nearLeft.y <= joystick.top - 8 + 1e-6).toBe(true);
   });

   it("never covers a rect the outline passes around (the hull check)", () => {
      // a small rect in the middle of the screen is always under the floor: no distance fits
      const centre: ScreenRect = { left: 395, top: 395, right: 405, bottom: 405 };
      const view = fitView({ width: 800, height: 800, fov: 45, area: FLOOR, pitch: PITCH, avoid: [centre], maxDistance: 300 });
      expect(view.distance).toBeCloseTo(300, 6);
   });

   it("survives a zero-size canvas", () => {
      const view = fitView({ width: 0, height: 0, fov: 45, area: FLOOR, pitch: PITCH });
      expect(Number.isFinite(view.distance)).toBe(true);
   });
});

/** Robot Collector's portrait layout: shell HUD groups and the joystick, lifted by a cookie banner `banner` px tall. */
function portrait(banner: number) {
   const width = 375;
   const height = 812;
   const hud: ScreenRect[] = [
      { left: 10, top: 10, right: 218, bottom: 52 },
      { left: width - 104, top: 10, right: width - 10, bottom: 54 },
   ];
   const joystick: ScreenRect = { left: 20, top: height - 20 - banner - 132, right: 152, bottom: height - 20 - banner };
   const strip: ScreenRect[] = banner > 0 ? [{ left: 0, top: height - banner, right: width, bottom: height }] : [];
   return { width, height, hud, joystick, avoid: [...hud, joystick, ...strip] };
}

const ROBOT_VIEW = {
   fov: 45,
   area: FLOOR,
   pitch: PITCH,
   margin: { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 },
   padding: 8,
   focus: followFocus({ reach: { min: { x: -12, y: 0, z: -8 }, max: { x: 12, y: 0, z: 8 } }, fraction: 0.12 }),
};

describe("fitView lens shift", () => {
   it("setLensShift moves the picture by exactly (x, y) in NDC and does not turn the camera", () => {
      const plain = new PerspectiveCamera(45, 375 / 812, 0.1, 1000);
      plain.position.set(3, 9, 7);
      plain.lookAt(0, 0, 0);
      plain.updateMatrixWorld();
      const shifted = plain.clone();
      setLensShift(shifted, 0.2, 0.34, 375, 812);
      expect(shifted.aspect).toBeCloseTo(375 / 812, 12);
      for (const point of corners(FLOOR)) {
         const a = point.clone().project(plain);
         const b = point.clone().project(shifted);
         expect(b.x - a.x).toBeCloseTo(0.2, 9);
         expect(b.y - a.y).toBeCloseTo(0.34, 9);
         expect(b.z).toBeCloseTo(a.z, 9);
      }
   });

   it("is off by default: shift [0, 0] and the same distance as before", () => {
      const options = { ...ROBOT_VIEW, width: 812, height: 375, yaws: [0, Math.PI / 2], avoid: portrait(0).hud };
      const off = fitView(options);
      expect(off.shift).toEqual([0, 0]);
      expect(fitView({ ...options, shift: false })).toEqual(off);
   });

   it("uses lopsided margins: the analytic fit of a wall in a band from -1 to 0.5", () => {
      // fov 90, distance d: the 2-unit wall spans +-1/d in NDC; the band is 1.5 tall, centred at -0.25
      const view = fitView({ width: 400, height: 400, fov: 90, area: WALL, pitch: 0, focus: [ORIGIN], margin: { top: 0.25 }, shift: true });
      expect(view.distance).toBeCloseTo(4 / 3, 5);
      expect(view.shift[0]).toBeCloseTo(0, 9);
      expect(view.shift[1]).toBeCloseTo(-0.25, 5);
      // without the shift it must fit +-0.5 around the centre
      expect(fitView({ width: 400, height: 400, fov: 90, area: WALL, pitch: 0, focus: [ORIGIN], margin: { top: 0.25, bottom: 0.25 } }).distance).toBeCloseTo(2, 5);
   });

   it("keeps a centred box when it fits there (no needless shift)", () => {
      const view = fitView({ width: 400, height: 400, fov: 90, area: WALL, pitch: 0, focus: [ORIGIN], shift: true });
      expect(view.distance).toBeCloseTo(1, 6);
      expect(view.shift[0]).toBeCloseTo(0, 6);
      expect(view.shift[1]).toBeCloseTo(0, 6);
   });

   it("moves the warehouse above a joystick the banner lifts instead of shrinking it", () => {
      const yaws = [Math.PI / 2];
      const none = portrait(0);
      const free = fitView({ ...ROBOT_VIEW, width: none.width, height: none.height, yaws, avoid: none.avoid, shift: true });
      for (const banner of [100, 140, 165, 185]) {
         const layout = portrait(banner);
         const options = { ...ROBOT_VIEW, width: layout.width, height: layout.height, yaws };
         const old = fitView({ ...options, avoid: layout.avoid });
         const view = fitView({ ...options, avoid: layout.avoid, shift: true });
         // about the size it has without the banner, and far closer than zooming out around the centre
         expect(view.distance).toBeLessThan(free.distance * 1.1);
         expect(view.distance).toBeLessThan(old.distance * 0.8);
         expect(view.shift[1]).toBeGreaterThan(0);
         // from every focus point: inside the margins, below the HUD, above the lifted joystick and the banner
         for (const focus of ROBOT_VIEW.focus) {
            const screen = cornersOnScreen(FLOOR, view, options, focus);
            for (const p of screen) {
               expect(p.x).toBeGreaterThanOrEqual(0.02 * layout.width - 1e-6);
               expect(p.x).toBeLessThanOrEqual(0.98 * layout.width + 1e-6);
               expect(p.y).toBeGreaterThanOrEqual(Math.max(0.11 * layout.height, 54 + 8) - 1e-6);
               expect(p.y).toBeLessThanOrEqual(layout.joystick.top - 8 + 1e-6);
            }
         }
      }
   });
});

describe("followAim / followFocus", () => {
   const reach: AABB = { min: { x: -12, y: 0, z: -8 }, max: { x: 12, y: 0, z: 8 } };

   it("Robot Collector: the four corners 12% of the way out, on the floor", () => {
      const focus = followFocus({ lookAt: [0, 0, 0], reach, fraction: 0.12 });
      expect(focus).toHaveLength(4);
      for (const sx of [-1, 1]) {
         for (const sz of [-1, 1]) {
            expect(focus.some((f) => Math.abs(f.x - sx * 1.44) < 1e-9 && f.y === 0 && Math.abs(f.z - sz * 0.96) < 1e-9)).toBe(true);
         }
      }
   });

   it("applies lookAt, fraction and bounds like CameraRig", () => {
      const bounds: AABB = { min: { x: -3, y: 0, z: -100 }, max: { x: 5, y: 0, z: 100 } };
      const focus = followFocus({ lookAt: [2, 0, 0], reach: { min: { x: -10, y: 0, z: -4 }, max: { x: 10, y: 2, z: 4 } }, fraction: 0.5, bounds });
      // x: 2 + (-12) / 2 = -4 -> -3 (bounds), 2 + 8 / 2 = 6 -> 5; y: 0..1 -> 0 (bounds); z: -2..2
      expect(new Set(focus.map((f) => f.x))).toEqual(new Set([-3, 5]));
      expect(new Set(focus.map((f) => f.y))).toEqual(new Set([0]));
      expect(new Set(focus.map((f) => f.z))).toEqual(new Set([-2, 2]));
      expect(focus).toHaveLength(4);
   });

   it("every point CameraRig can aim at lies inside the focus corners", () => {
      const lookAt: [number, number, number] = [1, 0, -2];
      const bounds: AABB = { min: { x: -2, y: -1, z: -3 }, max: { x: 2, y: 1, z: 1 } };
      const focus = followFocus({ lookAt, reach, fraction: 0.3, bounds });
      const lo = { x: Math.min(...focus.map((f) => f.x)), y: Math.min(...focus.map((f) => f.y)), z: Math.min(...focus.map((f) => f.z)) };
      const hi = { x: Math.max(...focus.map((f) => f.x)), y: Math.max(...focus.map((f) => f.y)), z: Math.max(...focus.map((f) => f.z)) };
      const out = new Vector3();
      for (let i = 0; i < 500; i++) {
         const target = { x: -12 + ((i * 7919) % 2400) / 100, y: 0, z: -8 + ((i * 104729) % 1600) / 100 };
         followAim(target, lookAt, 0.3, bounds, out);
         expect(out.x).toBeGreaterThanOrEqual(lo.x - 1e-9);
         expect(out.x).toBeLessThanOrEqual(hi.x + 1e-9);
         expect(out.y).toBeGreaterThanOrEqual(lo.y - 1e-9);
         expect(out.y).toBeLessThanOrEqual(hi.y + 1e-9);
         expect(out.z).toBeGreaterThanOrEqual(lo.z - 1e-9);
         expect(out.z).toBeLessThanOrEqual(hi.z + 1e-9);
      }
   });
});
