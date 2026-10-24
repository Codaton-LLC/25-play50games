import { describe, expect, it } from "vitest";
import { Euler, PerspectiveCamera, Vector3 } from "three";
import type { AABB } from "./collision";
import type { SafeArea } from "./safeArea";
import { fitLiveEyeShift, sameEyeShift } from "./useEyeShift";
import { fitEyeShift, setEyeRotation, setLensShift, stepEyeYaw, type EyeShift, type EyeShiftOptions, type ScreenRect } from "./view";

/** The museum guard's view band: the gallery wall ahead of the fixed eye (view frame, yaw removed). */
const MUSEUM: AABB = { min: { x: -1.5, y: 0, z: 5.0 }, max: { x: 1.5, y: 2.4, z: 6.4 } };
/** Too wide and too near: no shift can frame it. */
const WIDE: AABB = { min: { x: -2.2, y: 0, z: 0.4 }, max: { x: 2.2, y: 2.4, z: 6.5 } };
const EYE = { fov: 70, eyeY: 1.6, padding: 8 };

/** Top HUD chips and a bottom cookie banner `banner` px tall. */
function layout(width: number, height: number, banner: number): ScreenRect[] {
   return [
      { left: 10, top: 10, right: 218, bottom: 52 },
      { left: width - 104, top: 10, right: width - 10, bottom: 54 },
      { left: 0, top: height - banner, right: width, bottom: height },
   ];
}

const corners = (box: AABB): Vector3[] =>
   [box.min.x, box.max.x].flatMap((x) => [box.min.y, box.max.y].flatMap((y) => [box.min.z, box.max.z].map((z) => new Vector3(x, y, z))));

/**
 * Screen px (from the top-left) of the band's corners seen by an EyeRig camera at `eye` facing
 * `yaw` with the shift on its lens: the band placed in the world from its view frame (+x right, +z forward).
 */
function bandOnScreen(band: AABB, options: Pick<EyeShiftOptions, "width" | "height" | "fov" | "eyeY" | "pitch">, shift: readonly [number, number], yaw = 0, eye = { x: 0, z: 0 }) {
   const { width, height } = options;
   const cam = new PerspectiveCamera(options.fov, width / height, 0.1, 1000);
   setLensShift(cam, shift[0], shift[1], width, height);
   cam.position.set(eye.x, options.eyeY, eye.z);
   setEyeRotation(cam.rotation, yaw, options.pitch ?? 0);
   cam.updateMatrixWorld();
   const right = { x: -Math.cos(yaw), z: Math.sin(yaw) };
   const forward = { x: Math.sin(yaw), z: Math.cos(yaw) };
   return corners(band).map((c) => {
      const p = new Vector3(eye.x + right.x * c.x + forward.x * c.z, c.y, eye.z + right.z * c.x + forward.z * c.z).project(cam);
      return { x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height };
   });
}

/** Is a screen point (px) clear of every rect grown by `padding`? (the band is a convex box, its corners bound it) */
const clearOf = (p: { x: number; y: number }, rects: readonly ScreenRect[], padding: number) =>
   rects.every((r) => !(p.x > r.left - padding + 1e-6 && p.x < r.right + padding - 1e-6 && p.y > r.top - padding + 1e-6 && p.y < r.bottom + padding - 1e-6));

describe("fitEyeShift", () => {
   it("fits the museum band on a portrait and a landscape phone with HUD chips and an 85 px banner, unshifted", () => {
      for (const [width, height] of [
         [390, 844],
         [844, 390],
      ]) {
         const avoid = layout(width, height, 85);
         const eye = fitEyeShift({ ...EYE, width, height, band: MUSEUM, avoid });
         expect(eye).toEqual({ shift: [0, 0], fits: true, overflow: 0 });
         for (const p of bandOnScreen(MUSEUM, { ...EYE, width, height }, eye.shift)) {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThanOrEqual(width);
            expect(p.y).toBeLessThanOrEqual(height - 85 - 8);
            expect(p.y).toBeGreaterThanOrEqual(54 + 8);
         }
      }
   });

   it("lifts the band over a taller banner by the smallest grid shift that clears it", () => {
      const width = 844;
      const height = 390;
      const banner = 140;
      const avoid = layout(width, height, banner);
      const eye = fitEyeShift({ ...EYE, width, height, band: MUSEUM, avoid });
      expect(eye.fits).toBe(true);
      expect(eye.shift[0]).toBe(0);
      const before = bandOnScreen(MUSEUM, { ...EYE, width, height }, [0, 0]);
      const after = bandOnScreen(MUSEUM, { ...EYE, width, height }, eye.shift);
      const bottom = Math.max(...after.map((p) => p.y));
      // clear of the padded banner, and no more than one grid cell (1/8 of the free interval) above it
      expect(bottom).toBeLessThanOrEqual(height - banner - 8 + 1e-6);
      const needed = Math.max(...before.map((p) => p.y)) - (height - banner - 8);
      expect(needed).toBeGreaterThan(0);
      expect((eye.shift[1] * height) / 2).toBeGreaterThanOrEqual(needed - 1e-6);
      expect((eye.shift[1] * height) / 2).toBeLessThan(needed + height / 8);
      for (const p of after) expect(clearOf(p, avoid, 8)).toBe(true);
   });

   it("cannot fit the wide band: fits false, with the overflow in px", () => {
      for (const [width, height] of [
         [390, 844],
         [844, 390],
      ]) {
         const eye = fitEyeShift({ ...EYE, width, height, band: WIDE, avoid: layout(width, height, 85) });
         expect(eye.fits).toBe(false);
         expect(eye.overflow).toBeGreaterThan(0);
         expect(Number.isFinite(eye.overflow)).toBe(true);
      }
   });

   it("a point behind the eye or at the near plane never fits", () => {
      const base = { ...EYE, width: 844, height: 390 };
      const behind = fitEyeShift({ ...base, band: { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 2, z: 3 } } });
      expect(behind).toEqual({ shift: [0, 0], fits: false, overflow: Infinity });
      // pitch 0: the depth of a point is its z, so z = 0.1 lies exactly on the near plane
      expect(fitEyeShift({ ...base, band: { min: { x: -0.01, y: 1.59, z: 0.1 }, max: { x: 0.01, y: 1.61, z: 3 } } }).fits).toBe(false);
      expect(fitEyeShift({ ...base, band: { min: { x: -0.01, y: 1.59, z: 0.11 }, max: { x: 0.01, y: 1.61, z: 3 } } }).fits).toBe(true);
   });

   it("moves the band out from under an avoid rect, on the correct side (+x is screen-right)", () => {
      const width = 844;
      const height = 390;
      // a side panel over the left 380 px: the band must move right
      const panel: ScreenRect = { left: 0, top: 60, right: 380, bottom: 330 };
      const eye = fitEyeShift({ ...EYE, width, height, band: MUSEUM, avoid: [panel] });
      expect(eye.fits).toBe(true);
      expect(eye.shift[0]).toBeGreaterThan(0);
      for (const p of bandOnScreen(MUSEUM, { ...EYE, width, height }, eye.shift)) expect(p.x).toBeGreaterThanOrEqual(380 + 8 - 1e-6);
      // a band to the eye's right is drawn right of the centre
      const right: AABB = { min: { x: 0.5, y: 1, z: 5 }, max: { x: 1.5, y: 2, z: 6 } };
      for (const p of bandOnScreen(right, { ...EYE, width, height }, [0, 0])) expect(p.x).toBeGreaterThan(width / 2);
      // the same panel on the right side of the screen pushes that band left, not right
      const rightPanel: ScreenRect = { left: 430, top: 0, right: 844, bottom: 390 };
      const pushed = fitEyeShift({ ...EYE, width, height, band: right, avoid: [rightPanel] });
      expect(pushed.fits).toBe(true);
      expect(pushed.shift[0]).toBeLessThan(0);
   });

   it("never covers a rect the band's outline passes around (the hull check)", () => {
      const width = 844;
      const height = 390;
      // a 4 px dot in the middle of the drawn band, with no room to move the band off it vertically
      const centre = bandOnScreen(MUSEUM, { ...EYE, width, height }, [0, 0]).reduce((a, p) => ({ x: a.x + p.x / 8, y: a.y + p.y / 8 }), { x: 0, y: 0 });
      const dot: ScreenRect = { left: centre.x - 2, top: centre.y - 2, right: centre.x + 2, bottom: centre.y + 2 };
      const locked = fitEyeShift({ ...EYE, width, height, band: MUSEUM, avoid: [dot], margin: { left: 0.39, right: 0.39, top: 0.38, bottom: 0.27 } });
      expect(locked.fits).toBe(false);
      expect(locked.overflow).toBeGreaterThan(0);
      // with room to the sides it moves off the dot
      const free = fitEyeShift({ ...EYE, width, height, band: MUSEUM, avoid: [dot] });
      expect(free.fits).toBe(true);
      const xs = bandOnScreen(MUSEUM, { ...EYE, width, height }, free.shift).map((p) => p.x);
      expect(Math.min(...xs) >= dot.right - 1e-6 || Math.max(...xs) <= dot.left + 1e-6).toBe(true);
   });

   it("stays inside the margins, and reports what sticks out when they are too tight", () => {
      const width = 390;
      const height = 844;
      const fit = fitEyeShift({ ...EYE, width, height, band: MUSEUM, margin: { top: 0.5 } });
      expect(fit.fits).toBe(true);
      expect(fit.shift[1]).toBeLessThan(0);
      for (const p of bandOnScreen(MUSEUM, { ...EYE, width, height }, fit.shift)) expect(p.y).toBeGreaterThanOrEqual(height / 2 - 1e-6);
      const tight = fitEyeShift({ ...EYE, width, height, band: MUSEUM, margin: { left: 0.2, right: 0.2 } });
      expect(tight.fits).toBe(false);
      expect(tight.overflow).toBeGreaterThan(0);
   });

   it("samples 12 points per edge by default", () => {
      // a thin full-height strip through the band's middle: only points along its edges see it
      const strip: ScreenRect = { left: 420, top: 0, right: 424, bottom: 390 };
      const options = { ...EYE, width: 844, height: 390, band: MUSEUM, avoid: [strip] };
      expect(fitEyeShift(options)).toEqual(fitEyeShift({ ...options, steps: 12 }));
      expect(fitEyeShift({ ...options, steps: 1 }).shift).toEqual([0, 0]);
      expect(fitEyeShift(options).shift[0]).not.toBe(0);
   });

   it("pitch: looking down moves the band up the screen", () => {
      const base = { ...EYE, width: 844, height: 390, band: MUSEUM };
      const level = bandOnScreen(MUSEUM, base, [0, 0]);
      const down = bandOnScreen(MUSEUM, { ...base, pitch: 0.2 }, [0, 0]);
      expect(Math.max(...down.map((p) => p.y))).toBeLessThan(Math.max(...level.map((p) => p.y)));
      expect(fitEyeShift({ ...base, pitch: 0.2, avoid: layout(844, 390, 140) }).fits).toBe(true);
   });

   it("is yaw-independent: the fitted band lands on the same pixels for every facing and eye position", () => {
      const width = 844;
      const height = 390;
      const avoid = layout(width, height, 140);
      const eye = fitEyeShift({ ...EYE, width, height, band: MUSEUM, avoid });
      const ahead = bandOnScreen(MUSEUM, { ...EYE, width, height }, eye.shift);
      for (const yaw of [0.7, Math.PI / 2, -2.5, Math.PI, 4]) {
         const turned = bandOnScreen(MUSEUM, { ...EYE, width, height }, eye.shift, yaw, { x: 3, z: -2 });
         turned.forEach((p, i) => {
            expect(p.x).toBeCloseTo(ahead[i].x, 6);
            expect(p.y).toBeCloseTo(ahead[i].y, 6);
            expect(clearOf(p, avoid, 8)).toBe(true);
         });
      }
   });

   it("survives a zero-size canvas", () => {
      const eye = fitEyeShift({ ...EYE, width: 0, height: 0, band: MUSEUM });
      expect(Number.isFinite(eye.shift[0]) && Number.isFinite(eye.shift[1])).toBe(true);
   });
});

describe("EyeRig pose math (setEyeRotation / stepEyeYaw)", () => {
   const look = (yaw: number, pitch = 0) => {
      const cam = new PerspectiveCamera();
      setEyeRotation(cam.rotation, yaw, pitch);
      cam.updateMatrixWorld();
      return { forward: cam.getWorldDirection(new Vector3()), up: new Vector3(0, 1, 0).applyQuaternion(cam.quaternion), right: new Vector3(1, 0, 0).applyQuaternion(cam.quaternion) };
   };

   it("yaw 0 looks along +z, yaw PI/2 along +x (like inViewCone)", () => {
      const ahead = look(0).forward;
      expect(ahead.x).toBeCloseTo(0, 12);
      expect(ahead.y).toBeCloseTo(0, 12);
      expect(ahead.z).toBeCloseTo(1, 12);
      const side = look(Math.PI / 2).forward;
      expect(side.x).toBeCloseTo(1, 12);
      expect(side.z).toBeCloseTo(0, 12);
      for (const yaw of [-2.4, -1, 0.3, 2, 3.1]) {
         const f = look(yaw).forward;
         expect(f.x).toBeCloseTo(Math.sin(yaw), 12);
         expect(f.z).toBeCloseTo(Math.cos(yaw), 12);
      }
   });

   it("positive pitch looks down and the camera never rolls", () => {
      for (const yaw of [0, 1.2, -2.8]) {
         const { forward, up, right } = look(yaw, 0.3);
         expect(forward.y).toBeCloseTo(-Math.sin(0.3), 12);
         expect(Math.hypot(forward.x, forward.z)).toBeCloseTo(Math.cos(0.3), 12);
         expect(right.y).toBeCloseTo(0, 12);
         expect(up.y).toBeGreaterThan(0);
      }
   });

   it("writes the Euler in place, order YXZ", () => {
      const rotation = new Euler();
      expect(setEyeRotation(rotation, 0.5, 0.2)).toBe(rotation);
      expect(rotation.order).toBe("YXZ");
      expect(rotation.x).toBeCloseTo(-0.2, 12);
      expect(rotation.y).toBeCloseTo(0.5 + Math.PI, 12);
      expect(rotation.z).toBe(0);
   });

   it("omitted turnRate copies the yaw", () => {
      expect(stepEyeYaw(0, 2.5, undefined, 0.016)).toBe(2.5);
      expect(stepEyeYaw(3, -3, undefined, 0)).toBe(-3);
   });

   it("turnRate takes the shortest arc across +-PI", () => {
      // 3 -> -3 is 0.283 rad the positive way round, not 6 rad back
      const next = stepEyeYaw(3, -3, 1, 0.1);
      expect(next).toBeCloseTo(3.1, 12);
      const back = stepEyeYaw(-3, 3, 1, 0.1);
      expect(back).toBeCloseTo(-3.1, 12);
      // a plain turn is limited to rate * dt
      expect(stepEyeYaw(0, 1, 2, 0.1)).toBeCloseTo(0.2, 12);
      expect(stepEyeYaw(0, -1, 2, 0.1)).toBeCloseTo(-0.2, 12);
   });

   it("never overshoots: it lands on the target (modulo 2 PI) and stays", () => {
      const target = -3;
      let yaw = 3;
      for (let i = 0; i < 20; i++) {
         const next = stepEyeYaw(yaw, target, 1, 0.1);
         // never past the target: the remaining arc only shrinks and keeps its sign
         const rest = (r: number) => Math.atan2(Math.sin(target - r), Math.cos(target - r));
         expect(Math.abs(rest(next))).toBeLessThanOrEqual(Math.abs(rest(yaw)) + 1e-12);
         expect(rest(next) >= -1e-12).toBe(true);
         yaw = next;
      }
      expect(Math.cos(yaw - target)).toBeCloseTo(1, 12);
      expect(Math.sin(yaw - target)).toBeCloseTo(0, 12);
      // a big step lands exactly
      expect(stepEyeYaw(0, 1, 100, 1)).toBe(1);
      expect(stepEyeYaw(0, 1, 5, 0)).toBe(0);
   });
});

describe("useEyeShift (fitLiveEyeShift / sameEyeShift)", () => {
   const safe = (width: number, height: number, banner: number): SafeArea => ({
      width,
      height,
      hud: layout(width, height, 0).slice(0, 2),
      controls: [{ left: 20, top: height - 20 - banner - 132, right: 152, bottom: height - 20 - banner }],
      obstructions: banner > 0 ? [{ left: 0, top: height - banner, right: width, bottom: height }] : [],
   });
   const input = (width: number, height: number, extra: object = {}) => ({ ...EYE, band: MUSEUM, width, height, ...extra });

   it("avoids the HUD, the controls and the banner like fitEyeShift with those rects", () => {
      const area = safe(844, 390, 140);
      const live = fitLiveEyeShift(input(844, 390, { avoidControls: false }), area);
      expect(live).toEqual(fitEyeShift({ ...input(844, 390), avoid: [...area.hud, ...area.obstructions] }));
      expect(live.shift[1]).toBeGreaterThan(0);
      // the banner switched off: no lift
      expect(fitLiveEyeShift(input(844, 390, { avoidControls: false, avoidObstructions: false }), area).shift).toEqual([0, 0]);
   });

   it("adds its own avoid rects", () => {
      const panel: ScreenRect = { left: 0, top: 60, right: 380, bottom: 330 };
      const live = fitLiveEyeShift(input(844, 390, { avoid: [panel], avoidControls: false }), safe(844, 390, 0));
      expect(live.shift[0]).toBeGreaterThan(0);
   });

   it("sameEyeShift compares the result by value", () => {
      const a: EyeShift = { shift: [0, 0.2], fits: true, overflow: 0 };
      expect(sameEyeShift(a, { shift: [0, 0.2], fits: true, overflow: 0 })).toBe(true);
      expect(sameEyeShift(a, { shift: [0, 0.3], fits: true, overflow: 0 })).toBe(false);
      expect(sameEyeShift(a, { shift: [0, 0.2], fits: false, overflow: 3 })).toBe(false);
   });
});
