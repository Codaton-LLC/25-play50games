// camera.ts against README "Scene and camera": the fitted-view table (core fitView with the core
// fixture rects), the lane / runner / target rules relative to F, and the lag box.
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import type { Vec3Like } from "@/arcade3d/core/collision";
import type { ScreenRect } from "@/arcade3d/core/view";
import { fitView, type FittedView } from "@/arcade3d/core/view";
import { DAMPING, FOCUS, FOLLOW_X, LAG, LANDSCAPE, PORTRAIT, followPoint, viewFor, type RaceView } from "./camera";
import { APEX_HEIGHT, ARCH, BLOCK, COURSE, DISC, FOOT, HUB, KNOCK, KNOCK_STOP_X, RUNNER, V_RUN, WATER_Y, createRun } from "./rules";

// ---------- the fixture (core useFittedView.test.ts / README "Fitted views") ----------

interface Fixture {
   hud: ScreenRect[];
   joystick: ScreenRect | null;
   jump: ScreenRect | null;
   banner: ScreenRect | null;
}

/** Shell HUD groups, joystick 132 px and Jump 72 px 20 px from the bottom corners (lifted by the banner), the banner strip. */
function fixture(w: number, h: number, banner: number, touch: boolean): Fixture {
   return {
      hud: [
         { left: 10, top: 10, right: 218, bottom: 52 },
         { left: w - 104, top: 10, right: w - 10, bottom: 54 },
      ],
      joystick: touch ? { left: 20, top: h - 20 - banner - 132, right: 152, bottom: h - 20 - banner } : null,
      jump: touch ? { left: w - 20 - 72, top: h - 20 - banner - 72, right: w - 20, bottom: h - 20 - banner } : null,
      banner: banner > 0 ? { left: 0, top: h - banner, right: w, bottom: h } : null,
   };
}

const rects = (f: Fixture): ScreenRect[] => [...f.hud, ...(f.joystick ? [f.joystick] : []), ...(f.jump ? [f.jump] : []), ...(f.banner ? [f.banner] : [])];

function fit(view: RaceView, w: number, h: number, avoid: ScreenRect[]): FittedView {
   return fitView({ ...view, width: w, height: h, avoid });
}

/** Screen px of world point `p` with F at `at` (plus a lag corner), as CameraRig places the camera, lens shift included. */
function projector(view: RaceView, fitted: FittedView, w: number, h: number) {
   const cam = new PerspectiveCamera(view.fov, w / h, 0.1, 1000);
   const v = new Vector3();
   return (p: Vec3Like, at: Vec3Like = { x: 0, y: 0, z: 0 }): [number, number] => {
      cam.position.set(at.x + fitted.offset[0], at.y + fitted.offset[1], at.z + fitted.offset[2]);
      cam.lookAt(at.x, at.y, at.z);
      cam.updateMatrixWorld();
      v.set(p.x, p.y, p.z).project(cam);
      return [((v.x + fitted.shift[0] + 1) / 2) * w, ((1 - (v.y + fitted.shift[1])) / 2) * h];
   };
}

/** The area box's outline on screen with the camera at rest (F at the origin). */
function windowBox(view: RaceView, project: ReturnType<typeof projector>) {
   const a = view.area;
   const out = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, points: [] as [number, number][] };
   const N = 48;
   for (const y of [a.min.y, a.max.y]) {
      for (let k = 0; k <= N; k++) {
         const x = a.min.x + ((a.max.x - a.min.x) * k) / N;
         const z = a.min.z + ((a.max.z - a.min.z) * k) / N;
         for (const q of [
            { x, y, z: a.min.z },
            { x, y, z: a.max.z },
            { x: a.min.x, y, z },
            { x: a.max.x, y, z },
         ]) {
            const [px, py] = project(q);
            out.points.push([px, py]);
            out.x0 = Math.min(out.x0, px);
            out.x1 = Math.max(out.x1, px);
            out.y0 = Math.min(out.y0, py);
            out.y1 = Math.max(out.y1, py);
         }
      }
   }
   return out;
}

/** Closest px from the window outline to a rect (0 = touching or overlapping). */
function gap(points: [number, number][], r: ScreenRect | null): number {
   if (!r) return NaN;
   let best = Infinity;
   for (const [px, py] of points) best = Math.min(best, Math.hypot(Math.max(r.left - px, 0, px - r.right), Math.max(r.top - py, 0, py - r.bottom)));
   return best;
}

interface Row {
   w: number;
   h: number;
   banner: number;
   touch: boolean;
   view: RaceView;
   distance: number;
   shift: [number, number];
   window: [number, number, number, number];
   runner: number;
   feet: [number, number] | null;
   ground: [number, number];
   depth: number;
   gap26: number;
   gaps: [number, number, number];
}

// README "Fitted views" (rounded as printed there; the test allows the rounding)
const TABLE: Row[] = [
   { w: 375, h: 812, banner: 0, touch: true, view: PORTRAIT, distance: 23.9, shift: [0, -0.013], window: [30, 345, 78, 442], runner: 32.7, feet: [187.5, 411], ground: [29.4, 17.8], depth: 20.8, gap26: 40, gaps: [24, 218, 278] },
   { w: 375, h: 812, banner: 162, touch: true, view: PORTRAIT, distance: 23.9, shift: [0, -0.013], window: [30, 345, 78, 442], runner: 32.7, feet: null, ground: [29.4, 17.8], depth: 20.8, gap26: 40, gaps: [24, 56, 116] },
   { w: 812, h: 375, banner: 0, touch: true, view: LANDSCAPE, distance: 9.63, shift: [0.109, -0.381], window: [187, 714, 25, 303], runner: 53.3, feet: [450, 259], ground: [41.7, 22.3], depth: 26.9, gap26: 35, gaps: [54, 81, 74] },
   { w: 812, h: 375, banner: 83, touch: true, view: LANDSCAPE, distance: 12.59, shift: [0, -0.176], window: [218, 594, 23, 254], runner: 39.7, feet: null, ground: [31.9, 19.1], depth: 20.5, gap26: 31, gaps: [54, 66, 138] },
   { w: 1280, h: 800, banner: 0, touch: false, view: LANDSCAPE, distance: 10.58, shift: [0, -0.308], window: [142, 1138, 52, 609], runner: 102.6, feet: [640, 523], ground: [81.1, 45.1], depth: 52.2, gap26: 71, gaps: [130, NaN, NaN] },
];

describe("obstacle-race camera: README fit table (core fitView)", () => {
   for (const row of TABLE) {
      it(`${row.w} x ${row.h}${row.banner ? `, ${row.banner} px banner` : ""}`, () => {
         expect(viewFor(row.w, row.h)).toBe(row.view);
         const f = fixture(row.w, row.h, row.banner, row.touch);
         const fitted = fit(row.view, row.w, row.h, rects(f));
         expect(fitted.yaw).toBe(0);
         expect(Math.abs(fitted.distance - row.distance)).toBeLessThanOrEqual(0.006);
         expect(Math.abs(fitted.shift[0] - row.shift[0])).toBeLessThanOrEqual(0.0006);
         expect(Math.abs(fitted.shift[1] - row.shift[1])).toBeLessThanOrEqual(0.0006);
         const project = projector(row.view, fitted, row.w, row.h);
         const win = windowBox(row.view, project);
         const [x0, x1, y0, y1] = row.window;
         expect(Math.abs(win.x0 - x0)).toBeLessThanOrEqual(0.5);
         expect(Math.abs(win.x1 - x1)).toBeLessThanOrEqual(0.5);
         expect(Math.abs(win.y0 - y0)).toBeLessThanOrEqual(0.5);
         expect(Math.abs(win.y1 - y1)).toBeLessThanOrEqual(0.5);
         const feet = project({ x: 0, y: 0, z: 0 });
         const head = project({ x: 0, y: RUNNER.height, z: 0 });
         expect(Math.abs(feet[1] - head[1] - row.runner)).toBeLessThanOrEqual(0.05);
         if (row.feet) {
            expect(Math.abs(feet[0] - row.feet[0])).toBeLessThanOrEqual(0.5);
            expect(Math.abs(feet[1] - row.feet[1])).toBeLessThanOrEqual(0.5);
         }
         const pxPerM = (z: number) => project({ x: 0.5, y: 0, z })[0] - project({ x: -0.5, y: 0, z })[0];
         expect(Math.abs(pxPerM(0) - row.ground[0])).toBeLessThanOrEqual(0.05);
         expect(Math.abs(pxPerM(row.view.area.min.z) - row.ground[1])).toBeLessThanOrEqual(0.05);
         expect(Math.abs(project({ x: 0, y: 0, z: 0.5 })[1] - project({ x: 0, y: 0, z: -0.5 })[1] - row.depth)).toBeLessThanOrEqual(0.05);
         expect(Math.abs(project({ x: 0, y: 0, z: -4 })[1] - project({ x: 0, y: 0, z: -6.6 })[1] - row.gap26)).toBeLessThanOrEqual(0.5);
         const gaps = [Math.min(...f.hud.map((r) => gap(win.points, r))), gap(win.points, f.joystick), gap(win.points, f.jump)];
         gaps.forEach((g, i) => (Number.isNaN(row.gaps[i]) ? expect(g).toBeNaN() : expect(Math.abs(g - row.gaps[i])).toBeLessThanOrEqual(0.5)));
      });
   }

   it("the banner only moves the portrait picture (same distance with and without it)", () => {
      const open = fit(PORTRAIT, 375, 812, rects(fixture(375, 812, 162, true)));
      const closed = fit(PORTRAIT, 375, 812, rects(fixture(375, 812, 0, true)));
      expect(open.distance).toBeCloseTo(closed.distance, 6);
   });

   it("the index.tsx first-frame camera is the 1280 x 800 offset", () => {
      const fitted = fit(LANDSCAPE, 1280, 800, rects(fixture(1280, 800, 0, false)));
      expect(fitted.offset[0]).toBe(0);
      expect(fitted.offset[1]).toBeCloseTo(6.8, 1);
      expect(fitted.offset[2]).toBeCloseTo(8.1, 1);
   });
});

// ---------- the window relative to F ----------

const AREA_X = PORTRAIT.area.max.x;

/** Is x inside the window around F for a runner at runnerX (F.x = followX · runnerX)? */
const inWindow = (x: number, runnerX: number, followX = FOLLOW_X, areaX = AREA_X) => Math.abs(x - followX * runnerX) <= areaX + 1e-9;

/** Every runner x on a lane of half-width W (centre up to W + FOOT) sees both lane edges. */
function laneVisible(W: number, followX = FOLLOW_X, areaX = AREA_X): boolean {
   for (let k = 0; k <= 200; k++) {
      const x = -(W + FOOT) + ((2 * (W + FOOT)) * k) / 200;
      if (!inWindow(-W, x, followX, areaX) || !inWindow(W, x, followX, areaX)) return false;
   }
   return true;
}

const BLOCK_LANE = BLOCK.travel + BLOCK.width / 2;

describe("obstacle-race camera: what the window holds (README 'Why FOLLOW_X 0.3 and ±4.8 m')", () => {
   it("both views share the side extent and the lag focus", () => {
      expect(LANDSCAPE.area.max.x).toBe(AREA_X);
      expect(PORTRAIT.area.min.x).toBe(-AREA_X);
      expect(LANDSCAPE.area.min.x).toBe(-AREA_X);
      expect(PORTRAIT.focus).toBe(FOCUS);
      expect(LANDSCAPE.focus).toBe(FOCUS);
      expect(PORTRAIT.yaws).toEqual([0]);
      expect(LANDSCAPE.yaws).toEqual([0]);
   });

   it("every lane's full width from every runner x on it: bridges, pads, platforms, the block lane, the beam", () => {
      for (const s of COURSE.supports) {
         if (s.kind === "disc" || s.name === "start" || s.name === "finish") continue;
         const W = s.kind === "block" ? BLOCK_LANE : Math.max(Math.abs(s.minX), Math.abs(s.maxX));
         expect(laneVisible(W), s.name).toBe(true);
      }
      expect(laneVisible(BLOCK_LANE)).toBe(true);
      expect(BLOCK_LANE + FOLLOW_X * (BLOCK_LANE + FOOT)).toBeCloseTo(4.74, 10);
   });

   it("a mutation back to FOLLOW_X 0.6 or ±3.2 m fails the block lane", () => {
      expect(laneVisible(BLOCK_LANE, 0.6, AREA_X)).toBe(false);
      expect(laneVisible(BLOCK_LANE, FOLLOW_X, 3.2)).toBe(false);
      expect(laneVisible(BLOCK_LANE, 0.6, 3.2)).toBe(false);
   });

   it("the next block, anywhere in its lane, from a runner anywhere on the block behind", () => {
      for (let k = 0; k <= 40; k++) {
         const blockX = -BLOCK.travel + ((2 * BLOCK.travel) * k) / 40;
         for (const off of [-(BLOCK.width / 2 + FOOT), 0, BLOCK.width / 2 + FOOT]) {
            const runnerX = blockX + off;
            for (const nextEdge of [-BLOCK_LANE, BLOCK_LANE]) expect(inWindow(nextEdge, runnerX)).toBe(true);
         }
      }
   });

   it("the runner's body everywhere: the disc's rim, the start and finish pads, the knock's stop", () => {
      const body = (x: number) => inWindow(x - RUNNER.radius, x) && inWindow(x + RUNNER.radius, x);
      for (const x of [DISC.radius + FOOT, -(DISC.radius + FOOT), 4 + FOOT, -(4 + FOOT), KNOCK_STOP_X, -KNOCK_STOP_X]) expect(body(x)).toBe(true);
      expect((1 - FOLLOW_X) * KNOCK_STOP_X + RUNNER.radius).toBeLessThanOrEqual(AREA_X);
   });

   it("the hub on the disc and the arch opening on the finish pad", () => {
      for (let k = 0; k <= 50; k++) {
         const x = -(DISC.radius + FOOT) + ((2 * (DISC.radius + FOOT)) * k) / 50;
         expect(inWindow(-HUB.radius, x) && inWindow(HUB.radius, x)).toBe(true);
         const fx = -(4 + FOOT) + ((2 * (4 + FOOT)) * k) / 50;
         const opening = ARCH.postX - ARCH.postRadius;
         expect(inWindow(-opening, fx) && inWindow(opening, fx)).toBe(true);
      }
   });

   it("ahead: the next landing target ends at most 7.6 m in front, at most 0.5 m above F.y", () => {
      const supports = COURSE.supports;
      let farthest = 0;
      let highest = 0;
      for (let i = 0; i + 1 < supports.length; i++) {
         const a = supports[i];
         const b = supports[i + 1];
         if (b.minP - a.maxP <= 0) continue; // a join, not a jump
         highest = Math.max(highest, b.top - a.top);
         // from the back of a platform or block (edge grace included) to the far edge of the next one
         if ((a.kind === "platform" || a.kind === "block") && b.kind === a.kind) farthest = Math.max(farthest, b.maxP - (a.minP - FOOT));
      }
      expect(farthest).toBeLessThanOrEqual(7.6 + 1e-9);
      expect(highest).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(-LANDSCAPE.area.min.z).toBeGreaterThan(farthest);
      expect(-PORTRAIT.area.min.z).toBeGreaterThan(farthest);
      // the runner's head at a jump's apex (2.95 m above F.y, which rises on landing) stays under the box's top
      expect(RUNNER.height + APEX_HEIGHT).toBeLessThanOrEqual(PORTRAIT.area.max.y);
      expect(RUNNER.height + APEX_HEIGHT).toBeLessThanOrEqual(LANDSCAPE.area.max.y);
   });

   it("the lag box covers the most CameraRig can trail F (v / damping)", () => {
      expect(LAG.max.z).toBeGreaterThanOrEqual(V_RUN / DAMPING);
      expect(-LAG.min.z).toBeGreaterThanOrEqual(V_RUN / DAMPING);
      expect(LAG.max.x).toBeGreaterThanOrEqual((FOLLOW_X * KNOCK.vx) / DAMPING - 1e-12);
      expect(LAG.max.x).toBeGreaterThanOrEqual((FOLLOW_X * (V_RUN + 3.6)) / DAMPING);
      expect(LAG.max.y).toBeGreaterThanOrEqual(0.5);
      expect(FOCUS).toHaveLength(8);
   });

   it("on screen from every lag corner: the far edge of the block lane (portrait) and the splash", () => {
      const portrait = fit(PORTRAIT, 375, 812, rects(fixture(375, 812, 0, true)));
      const project = projector(PORTRAIT, portrait, 375, 812);
      const laptop = fit(LANDSCAPE, 1280, 800, rects(fixture(1280, 800, 0, false)));
      const projectLaptop = projector(LANDSCAPE, laptop, 1280, 800);
      let minLeft = Infinity;
      let maxSplash = -Infinity;
      let maxSplashLaptop = -Infinity;
      const runner = { x: 3.8, y: 0, z: -70 };
      const F = followPoint({ runner: { ...createRun().runner, ...runner }, groundY: 0 }, { x: 0, y: 0, z: 0 });
      for (const c of FOCUS) {
         const at = { x: F.x + c.x, y: F.y + c.y, z: F.z + c.z };
         for (const ahead of [1.4, 3, 6.2]) minLeft = Math.min(minLeft, project({ x: -BLOCK_LANE, y: 0, z: runner.z - ahead }, at)[0]);
         const knocked = { x: KNOCK_STOP_X, y: 0, z: -18 };
         const Fk = { x: FOLLOW_X * knocked.x + c.x, y: c.y, z: knocked.z + c.z };
         maxSplash = Math.max(maxSplash, project({ x: KNOCK_STOP_X + RUNNER.radius, y: WATER_Y, z: knocked.z }, Fk)[0]);
         maxSplashLaptop = Math.max(maxSplashLaptop, projectLaptop({ x: KNOCK_STOP_X + RUNNER.radius, y: WATER_Y, z: knocked.z }, Fk)[0]);
      }
      expect(minLeft).toBeGreaterThanOrEqual(33 - 0.5);
      expect(maxSplash).toBeLessThanOrEqual(356 + 0.5);
      expect(maxSplashLaptop).toBeLessThanOrEqual(1159 + 0.5);
   });
});
