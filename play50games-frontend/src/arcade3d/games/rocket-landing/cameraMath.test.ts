import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { HULL } from "./assets";
import { BODY, createRun } from "./rules";
import { fitRocketView, rocketBox } from "./cameraMath";
import { setLensShift } from "@/arcade3d/core/view";

describe("live rocket camera", () => {
   it("keeps the landed rocket below the award and clear of the controls and banner", () => {
      const run = createRun(0, false);
      run.body.y = 3.1; run.body.x = run.layouts[0].pad;
      const avoid = [
         { left: 200, right: 644, top: 48, bottom: 92 },
         { left: 290, right: 554, top: 94, bottom: 124 },
         { left: 20, right: 160, top: 210, bottom: 286 },
         { left: 0, right: 844, top: 290, bottom: 390 },
      ];
      const view = fitRocketView(rocketBox(run), 844, 390, avoid);
      const camera = new PerspectiveCamera(35, 844 / 390, 0.1, 1000);
      camera.position.set(view.x, view.y, view.distance);
      camera.lookAt(view.x, view.y, 0); camera.updateMatrixWorld();
      setLensShift(camera, 0, view.shift, 844, 390);
      const pts = HULL.map(([x, y]) => new Vector3(run.body.x + x, run.body.y + y - BODY.centre, 0).project(camera));
      const xs = pts.map((v) => (v.x + 1) * 422), ys = pts.map((v) => (1 - v.y) * 195);
      expect(Math.min(...ys)).toBeGreaterThan(124);
      for (const a of avoid) expect(Math.max(...xs) <= a.left || Math.min(...xs) >= a.right || Math.max(...ys) <= a.top || Math.min(...ys) >= a.bottom).toBe(true);
   });
   for (const banner of [false, true]) it(`keeps spawn clear of landscape HUD, banner=${banner}`, () => {
      const run = createRun(0, false);
      const hud = { left: 200, right: 644, top: 48, bottom: 92 };
      const avoid = [hud, ...(banner ? [{ left: 0, right: 844, top: 290, bottom: 390 }] : [])];
      const view = fitRocketView(rocketBox(run), 844, 390, avoid);
      const camera = new PerspectiveCamera(35, 844 / 390, 0.1, 1000);
      camera.position.set(view.x, view.y, view.distance);
      camera.lookAt(view.x, view.y, 0); camera.updateMatrixWorld();
      setLensShift(camera, 0, view.shift, 844, 390);
      const ys = HULL.map(([x, y]) => {
         const projected = new Vector3(run.body.x + x, run.body.y + y - BODY.centre, 0).project(camera);
         return (1 - projected.y) * 390 / 2;
      });
      expect(Math.min(...ys)).toBeGreaterThan(hud.bottom);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(24);
      expect(Math.max(...ys)).toBeLessThan(banner ? 290 : 390);
   });
   // Rects measured in headless Chrome at 844 x 390 (touch, coarse pointer): shell HUD chips,
   // the flight HUD, the award slot (measured even while hidden), the joystick and Thrust (lifted
   // above the banner when it is open).
   const shell = [{ left: 10, right: 196, top: 10, bottom: 52 }, { left: 740, right: 834, top: 10, bottom: 54 }, { left: 274, right: 570, top: 48, bottom: 92 }, { left: 290, right: 554, top: 94, bottom: 124 }];
   for (const banner of [false, true]) it(`keeps every spawn and the widest boxes clear of the side touch controls, >= 24 px tall, banner=${banner}`, () => {
      const lift = banner ? 0 : 85;
      const avoid = [...shell,
         { left: 20, right: 150, top: 152 + lift, bottom: 285 + lift },
         { left: 752, right: 824, top: 213 + lift, bottom: 285 + lift },
         ...(banner ? [{ left: 0, right: 844, top: 305, bottom: 390 }] : [])];
      const cases: Array<[number, number | null, number]> = [];
      for (let seed = 0; seed < 40; seed++) cases.push([seed, null, 0]);
      // and the widest boxes: the rocket far from the pad, crashed beside it (y 1.2), low and high
      for (const x of [-7.5, -4, 4, 7.5]) for (const y of [1.2, 4, 8, 14]) cases.push([1, x, y]);
      for (const [seed, x, y] of cases) {
         const run = createRun(seed, true);
         if (x !== null) { run.body.x = x; run.body.y = y; }
         const view = fitRocketView(rocketBox(run), 844, 390, avoid);
         const camera = new PerspectiveCamera(35, 844 / 390, 0.1, 1000);
         camera.position.set(view.x, view.y, view.distance);
         camera.lookAt(view.x, view.y, 0); camera.updateMatrixWorld();
         setLensShift(camera, 0, view.shift, 844, 390);
         const pts = HULL.map(([x, y]) => new Vector3(run.body.x + x, run.body.y + y - BODY.centre, 0).project(camera));
         const xs = pts.map((v) => (v.x + 1) * 422), ys = pts.map((v) => (1 - v.y) * 195);
         const r = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
         expect(r.bottom - r.top).toBeGreaterThanOrEqual(24);
         for (const a of avoid) expect(r.right <= a.left || r.left >= a.right || r.bottom <= a.top || r.top >= a.bottom).toBe(true);
      }
   });
});
