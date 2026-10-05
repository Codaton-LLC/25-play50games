import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import type { AABB, Vec3Like } from "./collision";
import { fitView, inputToWorld, type FitViewOptions, type FittedView, type ScreenRect } from "./view";

const ORIGIN = { x: 0, y: 0, z: 0 };
/** A 2 x 2 wall facing the camera (z = 0), centred on the origin. */
const WALL: AABB = { min: { x: -1, y: -1, z: 0 }, max: { x: 1, y: 1, z: 0 } };
/** A 24 x 16 floor with 0.9-high walls (Robot Collector's warehouse). */
const FLOOR: AABB = { min: { x: -12.4, y: 0, z: -8.4 }, max: { x: 12.4, y: 0.9, z: 8.4 } };
const PITCH = (56 * Math.PI) / 180;
const corners = (box: AABB): Vector3[] =>
   [box.min.x, box.max.x].flatMap((x) => [box.min.y, box.max.y].flatMap((y) => [box.min.z, box.max.z].map((z) => new Vector3(x, y, z))));

/** Screen positions (CSS px from the top-left) of the box corners for a fitted view. */
function cornersOnScreen(box: AABB, view: FittedView, options: Pick<FitViewOptions, "width" | "height" | "fov">, focus: Vec3Like = ORIGIN, scale = 1) {
   const cam = new PerspectiveCamera(options.fov, options.width / options.height, 0.1, 1000);
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

describe("inputToWorld", () => {
   it("maps screen input to the world for both camera yaws", () => {
      const out = { x: 0, z: 0 };
      // landscape camera (yaw 0): up = -z, right = +x
      inputToWorld(0, -1, 0, out);
      expect(out.x).toBeCloseTo(0, 9);
      expect(out.z).toBeCloseTo(-1, 9);
      inputToWorld(1, 0, 0, out);
      expect(out.x).toBeCloseTo(1, 9);
      expect(out.z).toBeCloseTo(0, 9);
      // portrait camera (yaw 90°, looking along -x): up = -x, right = -z
      inputToWorld(0, -1, Math.PI / 2, out);
      expect(out.x).toBeCloseTo(-1, 9);
      expect(out.z).toBeCloseTo(0, 9);
      inputToWorld(1, 0, Math.PI / 2, out);
      expect(out.x).toBeCloseTo(0, 9);
      expect(out.z).toBeCloseTo(-1, 9);
   });

   it("up always points away from the camera, and the input's length is kept", () => {
      for (const yaw of [0.3, 1.2, 2.5, -2]) {
         const camera = { x: Math.sin(yaw), z: Math.cos(yaw) }; // camera direction from the focus
         const up = inputToWorld(0, -1, yaw);
         expect(up.x * camera.x + up.z * camera.z).toBeCloseTo(-1, 9);
         const d = inputToWorld(0.6, 0.3, yaw);
         expect(Math.hypot(d.x, d.z)).toBeCloseTo(Math.hypot(0.6, 0.3), 9);
      }
   });

   it("writes into `out` without allocating", () => {
      const out = { x: 5, z: 5 };
      expect(inputToWorld(1, 0, 0, out)).toBe(out);
      expect(out.x).toBe(1);
      expect(out.z).toBeCloseTo(0, 12);
   });
});
