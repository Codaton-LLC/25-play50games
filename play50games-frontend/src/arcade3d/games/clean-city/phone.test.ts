// The phone camera (camera.ts cameraFor, README "Scene and camera", "Phones"): which setup each
// canvas gets, the window kept inside the floor with the cleaner inside it, and the cleaner's height
// on screen at the phone viewports against the whole-floor fit it replaced. Pure: core fitView with
// the safe area GameShell measured, a three.js camera placed as CameraRig places it at rest.
import { describe, expect, it } from "vitest";
import type { Vec3Like } from "@/arcade3d/core/collision";
import { fitView, followAim, type ScreenRect } from "@/arcade3d/core/view";
import { PHONE_SAFE_AREAS, fitSetup, rigProjector } from "./cameraFixture";
import {
   DAMPING,
   FLOOR_CAMERA,
   FOLLOW,
   FOV,
   LANDSCAPE_WINDOW,
   LOOK_AT,
   PHONE_DAMPING,
   PHONE_LANDSCAPE,
   PHONE_MAX_SIDE,
   PHONE_PORTRAIT,
   PORTRAIT_WINDOW,
   REACH,
   VIEW,
   cameraFor,
   windowBounds,
   type CameraSetup,
} from "./camera";
import { FLOOR_HALF, RUNNER, SPAWN_HALF, START_PAD } from "./rules";

/** The cleaner's drawn height (sizes.test.ts). */
const CLEANER_HEIGHT = 0.95;

/** The cleaner's height on screen (feet to head, CSS px) standing at `runner`. */
function cleanerPx(setup: CameraSetup, w: number, h: number, rects: readonly ScreenRect[], runner: Vec3Like): number {
   const project = rigProjector(setup, fitSetup(setup, w, h, rects), w, h, runner);
   return project(runner.x, 0, runner.z)[1] - project(runner.x, CLEANER_HEIGHT, runner.z)[1];
}

const PAD = { x: START_PAD.x, y: 0, z: START_PAD.z };
const MIDDLE = { x: 0, y: 0, z: 0 };

// measured with this file's math; the "before" column is the whole-floor fit (the browser read 4.65, 4.74, 5.19, 5.19, 3.40, 4.06, 4.27, 4.55 on the pad)
const HEIGHTS: Record<string, { pad: number; middle: number; before: number }> = {
   "360x740 open": { pad: 20.55, middle: 21.19, before: 4.65 },
   "360x740 closed": { pad: 20.55, middle: 21.19, before: 4.74 },
   "390x844 open": { pad: 22.38, middle: 23.04, before: 5.19 },
   "390x844 closed": { pad: 22.38, middle: 23.04, before: 5.19 },
   "740x360 open": { pad: 19.77, middle: 19.77, before: 3.4 },
   "740x360 closed": { pad: 26.09, middle: 26.09, before: 4.06 },
   "844x390 open": { pad: 25.36, middle: 25.36, before: 4.27 },
   "844x390 closed": { pad: 30.44, middle: 30.44, before: 4.55 },
};

describe("clean-city camera: which setup", () => {
   it("phones (shorter side under 600 px) get the window around the cleaner, everything else the whole floor", () => {
      expect(cameraFor(360, 740)).toBe(PHONE_PORTRAIT);
      expect(cameraFor(390, 844)).toBe(PHONE_PORTRAIT);
      expect(cameraFor(740, 360)).toBe(PHONE_LANDSCAPE);
      expect(cameraFor(844, 390)).toBe(PHONE_LANDSCAPE);
      expect(cameraFor(PHONE_MAX_SIDE - 1, 1000)).toBe(PHONE_PORTRAIT);
      expect(cameraFor(1000, PHONE_MAX_SIDE - 1)).toBe(PHONE_LANDSCAPE);
      expect(cameraFor(PHONE_MAX_SIDE, 1000)).toBe(FLOOR_CAMERA);
      expect(cameraFor(768, 1024)).toBe(FLOOR_CAMERA);
      expect(cameraFor(1280, 800)).toBe(FLOOR_CAMERA);
      expect(cameraFor(1920, 1080)).toBe(FLOOR_CAMERA);
   });

   it("the desktop setup is the one clean-city always had", () => {
      expect(FLOOR_CAMERA.view).toBe(VIEW);
      expect(FLOOR_CAMERA.followFraction).toBe(FOLLOW);
      expect(FLOOR_CAMERA.bounds).toBe(REACH);
      expect(FLOOR_CAMERA.damping).toBe(DAMPING);
   });

   it("the phone setups: yaw 0 only (the control mapping never flips), the cleaner itself followed, faster easing", () => {
      for (const setup of [PHONE_PORTRAIT, PHONE_LANDSCAPE]) {
         expect(setup.view.yaws).toEqual([0]);
         expect(setup.view.pitch).toBe(VIEW.pitch);
         expect(setup.view.fov).toBe(FOV);
         expect(setup.view.focus).toEqual([{ x: 0, y: 0, z: 0 }]);
         expect(setup.followFraction).toBe(1);
         expect(setup.damping).toBe(PHONE_DAMPING);
      }
      expect(PHONE_PORTRAIT.view.area).toBe(PORTRAIT_WINDOW);
      expect(PHONE_LANDSCAPE.view.area).toBe(LANDSCAPE_WINDOW);
   });
});

describe("clean-city camera: the phone window", () => {
   for (const [name, setup] of [["portrait", PHONE_PORTRAIT], ["landscape", PHONE_LANDSCAPE]] as const) {
      it(`${name}: never shows past the floor, and the cleaner (radius ${RUNNER.radius}, ${CLEANER_HEIGHT} tall) is inside it wherever it walks`, () => {
         const win = setup.view.area;
         const b = windowBounds(win);
         expect(b).toEqual(setup.bounds);
         // the window around any aim inside the bounds stays on the 28 x 28 floor
         for (const ax of [b.min.x, b.max.x]) {
            for (const az of [b.min.z, b.max.z]) {
               expect(ax + win.min.x).toBeGreaterThanOrEqual(-FLOOR_HALF - 1e-9);
               expect(ax + win.max.x).toBeLessThanOrEqual(FLOOR_HALF + 1e-9);
               expect(az + win.min.z).toBeGreaterThanOrEqual(-FLOOR_HALF - 1e-9);
               expect(az + win.max.z).toBeLessThanOrEqual(FLOOR_HALF + 1e-9);
            }
         }
         // every runner centre the rules allow (|x|, |z| <= 13.5): its body and head inside the window around the aim
         const aim = { x: 0, y: 0, z: 0 };
         for (let i = 0; i <= 54; i++) {
            for (let j = 0; j <= 54; j++) {
               const r = { x: -SPAWN_HALF + i * 0.5, y: 0, z: -SPAWN_HALF + j * 0.5 };
               followAim(r, LOOK_AT, setup.followFraction, setup.bounds, aim);
               expect(r.x - RUNNER.radius - aim.x).toBeGreaterThanOrEqual(win.min.x - 1e-9);
               expect(r.x + RUNNER.radius - aim.x).toBeLessThanOrEqual(win.max.x + 1e-9);
               expect(r.z - RUNNER.radius - aim.z).toBeGreaterThanOrEqual(win.min.z - 1e-9);
               expect(r.z + RUNNER.radius - aim.z).toBeLessThanOrEqual(win.max.z + 1e-9);
            }
         }
         expect(win.max.y).toBeGreaterThanOrEqual(CLEANER_HEIGHT);
         expect(win.min.y).toBe(0);
      });
   }
});

describe("clean-city camera: the cleaner on a phone's screen", () => {
   for (const p of PHONE_SAFE_AREAS) {
      const key = `${p.w}x${p.h} ${p.banner ? "open" : "closed"}`;
      const want = HEIGHTS[key];
      it(`${key}: the cleaner ${want.pad} px tall (was ${want.before}), the window on screen and clear of the HUD, the controls and the banner`, () => {
         const setup = cameraFor(p.w, p.h);
         expect(setup.kind).toBe("phone");
         const pad = cleanerPx(setup, p.w, p.h, p.rects, PAD);
         const middle = cleanerPx(setup, p.w, p.h, p.rects, MIDDLE);
               expect(Math.abs(pad - want.pad)).toBeLessThanOrEqual(0.05);
         expect(Math.abs(middle - want.middle)).toBeLessThanOrEqual(0.05);
         expect(Math.min(pad, middle)).toBeGreaterThanOrEqual(19.5);
         // the whole-floor fit it replaced, measured the same way
         const before = cleanerPx(FLOOR_CAMERA, p.w, p.h, p.rects, PAD);
         expect(Math.abs(before - want.before)).toBeLessThanOrEqual(0.05);
         expect(pad / before).toBeGreaterThan(4);
         // the window (with the cleaner) on screen and 8 px clear of every rect, from the pad and from a corner
         const fitted = fitSetup(setup, p.w, p.h, p.rects);
         for (const at of [PAD, MIDDLE, { x: -SPAWN_HALF, y: 0, z: -SPAWN_HALF }]) {
            const project = rigProjector(setup, fitted, p.w, p.h, at);
            const aim = followAim(at, LOOK_AT, 1, setup.bounds, { x: 0, y: 0, z: 0 });
            const win = setup.view.area;
            for (const x of [win.min.x, 0, win.max.x]) {
               for (const y of [win.min.y, win.max.y]) {
                  for (const z of [win.min.z, 0, win.max.z]) {
                     const [sx, sy] = project(aim.x + x, y, aim.z + z);
                     expect(sx).toBeGreaterThanOrEqual(0);
                     expect(sx).toBeLessThanOrEqual(p.w);
                     expect(sy).toBeGreaterThanOrEqual(0);
                     expect(sy).toBeLessThanOrEqual(p.h);
                     for (const r of p.rects) {
                        const inside = sx > r.left - 7.5 && sx < r.right + 7.5 && sy > r.top - 7.5 && sy < r.bottom + 7.5;
                        expect(inside, `(${x}, ${y}, ${z}) under ${JSON.stringify(r)}`).toBe(false);
                     }
                  }
               }
            }
         }
      });
   }

   it("desktop keeps the whole floor (the fit clean-city always had)", () => {
      const fitted = fitSetup(FLOOR_CAMERA, 1280, 800, [{ left: 10, top: 10, right: 261, bottom: 52 }, { left: 1176, top: 10, right: 1270, bottom: 54 }, { left: 1116, top: 736, right: 1264, bottom: 772 }]);
      const plain = fitView({ ...VIEW, width: 1280, height: 800, fov: FOV, avoid: [{ left: 10, top: 10, right: 261, bottom: 52 }, { left: 1176, top: 10, right: 1270, bottom: 54 }, { left: 1116, top: 736, right: 1264, bottom: 772 }] });
      expect(fitted).toEqual(plain);
      // the browser read 9.68 px on the pad at 1280 x 800
      expect(cleanerPx(FLOOR_CAMERA, 1280, 800, [{ left: 10, top: 10, right: 261, bottom: 52 }, { left: 1176, top: 10, right: 1270, bottom: 54 }, { left: 1116, top: 736, right: 1264, bottom: 772 }], PAD)).toBeCloseTo(9.68, 1);
   });
});
