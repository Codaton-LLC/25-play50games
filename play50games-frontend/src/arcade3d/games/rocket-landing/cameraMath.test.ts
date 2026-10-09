import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { HULL } from "./assets";
import { BODY, createRun } from "./rules";
import { fitRocketView, rocketBox } from "./cameraMath";
import { setLensShift } from "@/arcade3d/core/view";

describe("live rocket camera", () => {
   it("keeps the landed nose below the award and above controls", () => {
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
      const ys = HULL.map(([x, y]) => (1 - new Vector3(run.body.x + x, run.body.y + y - BODY.centre, 0).project(camera).y) * 195);
      expect(Math.min(...ys)).toBeGreaterThan(124);
      expect(Math.max(...ys)).toBeLessThan(210);
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
});
