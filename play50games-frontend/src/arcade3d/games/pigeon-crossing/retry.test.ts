// Retry from level 3+ opened Paused: the remounted Scene judged the shared camera in the frame that
// can run before CameraRig's mount effect places it, while it still looked at the last run's street.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { PerspectiveCamera } from "three";
import { fitView, setLensShift, type FittedView, type ScreenRect } from "@/arcade3d/core/view";
import { FOV, LOOK_AT, STREET_VIEW, configureStreetView, createHorizon, createStreetCache, fillStreet } from "./camera";
import { LANE_SLOTS, ROW_PITCH, ROWS_PER_LEVEL, createRun, step } from "./rules";

function fitted(w: number, h: number): FittedView {
   const avoid: ScreenRect[] = [
      { left: 10, top: 10, right: 218, bottom: 52 },
      { left: w - 104, top: 10, right: w - 10, bottom: 54 },
   ];
   return fitView({ ...STREET_VIEW, width: w, height: h, fov: FOV, avoid });
}

/** Where CameraRig keeps the shared camera for a pigeon on `row` (follow = pigeon + LOOK_AT, fraction 1). */
function cameraAt(view: FittedView, w: number, h: number, row: number, camera = new PerspectiveCamera(FOV, w / h, 0.1, 400)): PerspectiveCamera {
   const z = -row * ROW_PITCH + LOOK_AT[2];
   camera.position.set(view.offset[0], view.offset[1], z + view.offset[2]);
   camera.lookAt(0, 0, z);
   setLensShift(camera, view.shift[0], view.shift[1], w, h);
   camera.updateMatrixWorld();
   return camera;
}

const UP = { pressed: { up: true, down: false, left: false, right: false } };

describe("pigeon-crossing Retry remount", () => {
   it("a new run cannot fill its ring from the last run's camera once that run got far; placed at its pigeon it always can", () => {
      // [width, height, first last-run row whose camera no longer fits a row-0 run]
      for (const [w, h, first] of [[1280, 800, 28], [375, 812, 22]] as const) {
         const view = fitted(w, h);
         for (let lastRow = 0; lastRow <= 10 * ROWS_PER_LEVEL; lastRow++) {
            const run = createRun(7), cache = createStreetCache(), horizon = createHorizon();
            configureStreetView(cache, view, w, h);
            const camera = cameraAt(view, w, h, lastRow);
            const fits = fillStreet(run, cache, horizon, camera);
            expect(fits, `${w}x${h}, last run on row ${lastRow}`).toBe(lastRow < first);
            if (!fits) {
               // rows 0 .. the old view's far edge: more than the ring holds (the frame check paused here)
               expect(horizon.first).toBe(0);
               expect(horizon.last - horizon.first + 1).toBeGreaterThan(LANE_SLOTS);
               // a blocked ring keeps the new pigeon still: step() refuses it
               expect(run.horizonBlocked).toBe(true);
               expect(step(run, 16, UP).hopStarted).toBe(false);
            }
            // CameraRig's mount placement at this run's pigeon (row 0), with the cache that measured the old camera
            expect(fillStreet(run, cache, horizon, cameraAt(view, w, h, 0, camera)), `${w}x${h}, placed after row ${lastRow}`).toBe(true);
            expect(horizon.first).toBe(0);
            expect(run.horizonBlocked).toBe(false);
         }
         // level 1 Retries never paused; from level 2 on they could (the playtest: rows 46..49)
         expect(first).toBeGreaterThan(ROWS_PER_LEVEL);
         expect(first).toBeLessThan(2 * ROWS_PER_LEVEL);
      }
   });

   it("StreetCamera judges the actual camera only after the rig's mount effect; the fitted-view gate and the pre-step check stay unconditional", () => {
      const text = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
      const source = ts.createSourceFile("Scene.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const components = new Map<string, ts.FunctionExpression>();
      const collect = (node: ts.Node): void => {
         if (ts.isFunctionExpression(node) && node.name) components.set(node.name.text, node);
         ts.forEachChild(node, collect);
      };
      collect(source);
      const hooks = (fn: ts.Node, name: string): string[] => {
         const out: string[] = [];
         const find = (node: ts.Node): void => {
            if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name && node.arguments[0]) out.push(node.arguments[0].getText(source));
            ts.forEachChild(node, find);
         };
         find(fn);
         return out;
      };

      const camera = components.get("StreetCamera");
      expect(camera).toBeDefined();
      const body = camera!.getText(source);
      // the rig is StreetCamera's child, so its passive mount effect (the placement) runs before StreetCamera's
      expect(body).toMatch(/return <CameraRig [^>]*follow=\{layout\.follow\}/);
      expect(body).toContain("const placed = useRef(false);");
      // placed is set in a passive effect only (a layout effect would run before the rig places the camera)
      expect(hooks(camera!, "useEffect").filter((cb) => cb.includes("placed.current = true"))).toHaveLength(1);
      expect(hooks(camera!, "useLayoutEffect").some((cb) => cb.includes("placed.current"))).toBe(false);
      expect(body.match(/placed\.current = /g)).toHaveLength(1);

      const frames = hooks(camera!, "useFrame").filter((cb) => cb.includes("fillVisible("));
      expect(frames).toHaveLength(2);
      for (const frame of frames) {
         const guard = frame.search(/!placed\.current\)?\s*return;/);
         expect(guard, frame).toBeGreaterThan(0);
         expect(guard).toBeLessThan(frame.indexOf("fillVisible("));
         // the fitted-view gate (a too-small window) pauses before the guard, placed or not
         if (frame.includes("if (gate.reason) {")) expect(frame.indexOf("if (gate.reason) {")).toBeLessThan(guard);
      }
      expect(frames.filter((frame) => frame.includes("state.pause()") && frame.indexOf("if (gate.reason) {") >= 0)).toHaveLength(1);

      // the Simulation still checks the ring before every step, without the guard
      const simulation = components.get("Simulation");
      expect(simulation).toBeDefined();
      const steps = hooks(simulation!, "useRunFrame");
      expect(steps).toHaveLength(1);
      expect(steps[0]).not.toContain("placed");
      expect(steps[0].indexOf("fillVisible(")).toBeLessThan(steps[0].indexOf("step(run"));
      expect(steps[0]).toContain("useArcadeStore.getState().pause()");
   });
});
