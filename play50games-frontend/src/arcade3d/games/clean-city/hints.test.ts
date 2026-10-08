// The off-screen litter hints (hints.ts, drawn by LitterHints.tsx): the 2D helpers, then updateHints
// on real seeded layouts seen through the phone cameras (cameraFixture.ts) at the phone viewports,
// banner open and closed, and through the desktop camera (no arrow: the whole floor is in view).
import { describe, expect, it } from "vitest";
import type { ScreenRect } from "@/arcade3d/core/view";
import { FLOOR_CAMERA, cameraFor } from "./camera";
import { PHONE_SAFE_AREAS, fitSetup, rigProjector } from "./cameraFixture";
import {
   HINT_CLEARANCE,
   HINT_INSET,
   HINT_SPACING,
   MAX_HINTS,
   PIECE_MID,
   VIEW_INSET,
   clearOfRects,
   createHintState,
   edgePoint,
   insetRect,
   keepNearest,
   onScreen,
   updateHints,
   type Point2,
   type Projector,
} from "./hints";
import { ITEMS_PER_MAP, MAPS, START_PAD, createRun } from "./rules";

const rect = (left: number, top: number, right: number, bottom: number): ScreenRect => ({ left, top, right, bottom });

describe("clean-city hints: 2D helpers", () => {
   it("onScreen: in front of the camera, inside the view, under no panel", () => {
      const view = rect(6, 6, 354, 734);
      const covers = [rect(20, 588, 152, 720)];
      expect(onScreen(180, 370, 0.5, view, covers)).toBe(true);
      expect(onScreen(180, 370, 1.2, view, covers)).toBe(false);
      expect(onScreen(180, 370, -1.2, view, covers)).toBe(false);
      expect(onScreen(180, 370, Number.NaN, view, covers)).toBe(false);
      expect(onScreen(3, 370, 0.5, view, covers)).toBe(false);
      expect(onScreen(180, 736, 0.5, view, covers)).toBe(false);
      expect(onScreen(80, 650, 0.5, view, covers)).toBe(false);
   });

   it("edgePoint: where the ray from the start leaves the rect (the start clamped into it first)", () => {
      const inner = rect(22, 22, 338, 718);
      const out: Point2 = { x: 0, y: 0 };
      expect(edgePoint(180, 370, 1, 0, inner, out)).toEqual({ x: 338, y: 370 });
      expect(edgePoint(180, 370, 0, -1, inner, out)).toEqual({ x: 180, y: 22 });
      edgePoint(180, 370, -1, 1, inner, out);
      expect(out.x).toBeCloseTo(22, 9);
      expect(out.y).toBeCloseTo(370 + 158, 9);
      // a start below the rect is clamped onto its bottom edge first
      edgePoint(180, 900, 1, -1, inner, out);
      expect(out.x).toBeCloseTo(338, 9);
      expect(out.y).toBeCloseTo(718 - 158, 9);
      expect(edgePoint(180, 370, 0, 0, inner, out)).toEqual({ x: 180, y: 370 });
   });

   it("clearOfRects: the shortest move out from under a panel that stays inside the rect", () => {
      const inner = rect(22, 22, 338, 718);
      const joystick = rect(20, 588, 152, 720);
      const p: Point2 = { x: 22, y: 700 };
      expect(clearOfRects(p, [joystick], 20, inner)).toBe(true);
      // left of it is outside the rect, below it too: up (132) or right (150): up
      expect(p).toEqual({ x: 22, y: 568 });
      // under the banner strip (full width): only up
      const q: Point2 = { x: 180, y: 718 };
      expect(clearOfRects(q, [rect(0, 551, 360, 740)], 20, inner)).toBe(true);
      expect(q).toEqual({ x: 180, y: 531 });
      // moved out of one panel into another: moved again
      const r: Point2 = { x: 100, y: 718 };
      expect(clearOfRects(r, [rect(0, 551, 360, 740), rect(20, 399, 152, 531)], 20, inner)).toBe(true);
      expect(r.y <= 551 - 20 && (r.x >= 152 + 20 || r.y <= 399 - 20)).toBe(true);
      // a panel covering the whole rect: nothing fits
      const s: Point2 = { x: 180, y: 370 };
      expect(clearOfRects(s, [rect(0, 0, 360, 740)], 20, inner)).toBe(false);
   });

   it("keepNearest: the nearest few, sorted", () => {
      const slots = new Int32Array(3);
      const dists = new Float64Array(3);
      let n = 0;
      for (const [slot, d] of [[0, 9], [1, 4], [2, 7], [3, 1], [4, 12], [5, 5]]) n = keepNearest(slots, dists, n, slot, d);
      expect(n).toBe(3);
      expect(Array.from(slots)).toEqual([3, 1, 5]);
      expect(Array.from(dists)).toEqual([1, 4, 5]);
   });

   it("the arrows stand clear of the canvas edge", () => {
      expect(HINT_INSET).toBeGreaterThan(VIEW_INSET);
      expect(MAX_HINTS).toBe(3);
      expect(insetRect(360, 740, HINT_INSET, rect(0, 0, 0, 0))).toEqual(rect(HINT_INSET, HINT_INSET, 360 - HINT_INSET, 740 - HINT_INSET));
   });
});

/** A projector for updateHints from the rig at rest following `runner`. */
function projectorFor(project: ReturnType<typeof rigProjector>): Projector {
   return (x, y, z, out) => {
      const [sx, sy, depth] = project(x, y, z);
      out.x = sx;
      out.y = sy;
      return depth;
   };
}

/** Runner spots: the start pad, the middle, the four corners of the spawn box, and some spawn spots. */
const SPOTS = [
   { x: START_PAD.x, z: START_PAD.z },
   { x: 0, z: 0 },
   { x: -13, z: -13 },
   { x: 13, z: -13 },
   { x: -13, z: 13 },
   { x: 13, z: 13 },
   { x: 6, z: -4 },
];

describe("clean-city hints on a phone (real layouts, the phone cameras)", () => {
   for (const p of PHONE_SAFE_AREAS) {
      it(`${p.w} x ${p.h}, banner ${p.banner ? "open" : "closed"}: the nearest off-screen pieces, at the edge, clear of the UI, pointing at them`, () => {
         const setup = cameraFor(p.w, p.h);
         const fitted = fitSetup(setup, p.w, p.h, p.rects);
         const state = createHintState();
         let arrows = 0;
         let offScreen = 0;
         for (let seed = 1; seed <= 6; seed++) {
            const run = createRun(seed * 7919);
            for (let map = 0; map < MAPS.length; map++) {
               const litter = run.layouts[map].x.map((x, i) => ({ x, z: run.layouts[map].z[i], active: true }));
               expect(litter).toHaveLength(ITEMS_PER_MAP);
               for (const at of SPOTS) {
                  const project = rigProjector(setup, fitted, p.w, p.h, { x: at.x, y: 0, z: at.z });
                  const n = updateHints(state, at, litter, projectorFor(project), p.w, p.h, p.rects);
                  // which pieces are off screen, by brute force
                  const view = rect(VIEW_INSET, VIEW_INSET, p.w - VIEW_INSET, p.h - VIEW_INSET);
                  const off = litter
                     .map((l, i) => ({ i, d: Math.hypot(l.x - at.x, l.z - at.z), s: project(l.x, PIECE_MID, l.z) }))
                     // written out here, not onScreen: a piece is on screen when in front, inside the view and under no panel
                     .filter((l) => !(l.s[2] > -1 && l.s[2] < 1 && l.s[0] >= view.left && l.s[0] <= view.right && l.s[1] >= view.top && l.s[1] <= view.bottom && !p.rects.some((r) => l.s[0] > r.left && l.s[0] < r.right && l.s[1] > r.top && l.s[1] < r.bottom)))
                     .sort((a, b) => a.d - b.d);
                  offScreen += off.length;
                  // the nearest off-screen piece always gets one; up to MAX_HINTS of the nearest, none overlapping
                  expect(n).toBeLessThanOrEqual(Math.min(MAX_HINTS, off.length));
                  if (off.length > 0) expect(state.slot[0]).toBe(off[0].i);
                  else expect(n).toBe(0);
                  arrows += n;
                  const from = project(at.x, 0.5, at.z);
                  const nearest = off.slice(0, MAX_HINTS).map((o) => o.i);
                  for (let k = 0; k < n; k++) {
                     expect(nearest).toContain(state.slot[k]);
                     if (k > 0) expect(nearest.indexOf(state.slot[k])).toBeGreaterThan(nearest.indexOf(state.slot[k - 1]));
                     for (let j = 0; j < k; j++) expect(Math.hypot(state.x[j] - state.x[k], state.y[j] - state.y[k])).toBeGreaterThanOrEqual(HINT_SPACING);
                     const x = state.x[k];
                     const y = state.y[k];
                     // inside the canvas by HINT_INSET, clear of every panel by HINT_CLEARANCE
                     expect(x).toBeGreaterThanOrEqual(HINT_INSET - 1e-9);
                     expect(x).toBeLessThanOrEqual(p.w - HINT_INSET + 1e-9);
                     expect(y).toBeGreaterThanOrEqual(HINT_INSET - 1e-9);
                     expect(y).toBeLessThanOrEqual(p.h - HINT_INSET + 1e-9);
                     for (const r of p.rects) {
                        const under = x > r.left - HINT_CLEARANCE + 0.5 && x < r.right + HINT_CLEARANCE - 0.5 && y > r.top - HINT_CLEARANCE + 0.5 && y < r.bottom + HINT_CLEARANCE - 0.5;
                        expect(under).toBe(false);
                     }
                     // it points the way the piece lies on screen (from the cleaner), within 15°
                     const l = litter[state.slot[k]];
                     const to = project(l.x, PIECE_MID, l.z);
                     const ax = Math.cos(state.angle[k]);
                     const ay = -Math.sin(state.angle[k]);
                     const dx = to[0] - from[0];
                     const dy = to[1] - from[1];
                     expect((ax * dx + ay * dy) / Math.hypot(dx, dy)).toBeGreaterThan(Math.cos((15 * Math.PI) / 180));
                  }
               }
            }
         }
         // most of the floor is off screen on a phone: arrows show
         expect(offScreen).toBeGreaterThan(6 * 3 * SPOTS.length * 5);
         expect(arrows).toBeGreaterThan(6 * 3 * SPOTS.length * 2);
      });
   }

   it("desktop (the whole floor in view): no arrow", () => {
      const rects = [rect(10, 10, 261, 52), rect(1176, 10, 1270, 54), rect(1116, 736, 1264, 772)];
      const fitted = fitSetup(FLOOR_CAMERA, 1280, 800, rects);
      const state = createHintState();
      for (let seed = 1; seed <= 6; seed++) {
         const run = createRun(seed * 104729);
         for (let map = 0; map < MAPS.length; map++) {
            const litter = run.layouts[map].x.map((x, i) => ({ x, z: run.layouts[map].z[i], active: true }));
            for (const at of SPOTS) {
               const project = rigProjector(FLOOR_CAMERA, fitted, 1280, 800, { x: at.x, y: 0, z: at.z });
               expect(updateHints(state, at, litter, projectorFor(project), 1280, 800, rects)).toBe(0);
            }
         }
      }
   });

   it("collected pieces get no arrow", () => {
      const p = PHONE_SAFE_AREAS[0];
      const setup = cameraFor(p.w, p.h);
      const fitted = fitSetup(setup, p.w, p.h, p.rects);
      const run = createRun(42);
      const litter = run.layouts[0].x.map((x, i) => ({ x, z: run.layouts[0].z[i], active: false }));
      const state = createHintState();
      const project = rigProjector(setup, fitted, p.w, p.h, { x: 0, y: 0, z: 12 });
      expect(updateHints(state, { x: 0, z: 12 }, litter, projectorFor(project), p.w, p.h, p.rects)).toBe(0);
   });
});
