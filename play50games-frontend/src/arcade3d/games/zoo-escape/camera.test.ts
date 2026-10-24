// The follow camera: windows per screen, one yaw (up = north), bounds that keep the window inside the
// stage on the south and the sides and at most 3 m past the north gate.
import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import { fitView } from "@/arcade3d/core/view";
import { STAGES, type StageIndex } from "./level";
import { FOV, LOOK_AHEAD, NORTH_PEEK, PITCH, WINDOWS, aimAt, screenKind, stageBounds, viewFor, windowHalf } from "./camera";

describe("camera", () => {
   it("picks the window by screen and keeps one cached view per kind", () => {
      expect(screenKind(390, 844)).toBe("portrait");
      expect(screenKind(844, 390)).toBe("landscape");
      expect(screenKind(1280, 800)).toBe("large");
      expect(WINDOWS).toEqual({ portrait: { w: 8.5, d: 12 }, landscape: { w: 16, d: 7.5 }, large: { w: 16, d: 14 } });
      expect(windowHalf(390, 844)).toEqual({ hx: 4.25, hz: 6 });
      expect(viewFor(390, 844)).toBe(viewFor(380, 820));
      expect(viewFor(390, 844).yaws).toEqual([0]);
      expect(PITCH).toBeCloseTo((62 * Math.PI) / 180, 12);
      expect(FOV).toBe(45);
   });

   it("maps the stick's up to north (-z), towards every exit", () => {
      const d = inputToWorld(0, -1, 0);
      expect(d.x).toBeCloseTo(0, 12);
      expect(d.z).toBeCloseTo(-1, 12);
      expect(aimAt(1, 5, { x: 0, y: 0, z: 0 })).toEqual({ x: 1, y: 0, z: 5 - LOOK_AHEAD });
   });

   it("bounds the aim so the window stays inside the stage (south, sides) and peeks at most 3 m past the gate", () => {
      for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
         const { hx, hz } = windowHalf(w, h);
         for (const s of [0, 1, 2] as StageIndex[]) {
            const b = stageBounds(s, hx, hz, { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } });
            const st = STAGES[s];
            expect(b.min.x).toBeLessThanOrEqual(b.max.x);
            expect(b.min.z).toBeLessThanOrEqual(b.max.z);
            if (st.bounds.x1 - st.bounds.x0 >= 2 * hx) {
               expect(b.min.x - hx).toBeGreaterThanOrEqual(st.bounds.x0 - 1e-9);
               expect(b.max.x + hx).toBeLessThanOrEqual(st.bounds.x1 + 1e-9);
            } else expect(b.min.x).toBeCloseTo((st.bounds.x0 + st.bounds.x1) / 2, 9);
            if (b.min.z < b.max.z) {
               expect(b.max.z + hz).toBeCloseTo(st.bounds.z1, 9);
               expect(b.min.z - hz).toBeCloseTo(st.gate.z - NORTH_PEEK, 9);
            }
         }
      }
   });

   it("fits the phone windows at a sensible distance (pure fit, no HUD)", () => {
      for (const [w, h] of [[390, 844], [844, 390]]) {
         const v = viewFor(w, h);
         const fit = fitView({ ...v, width: w, height: h, fov: FOV });
         expect(fit.yaw).toBe(0);
         expect(fit.distance).toBeGreaterThan(5);
         expect(fit.distance).toBeLessThan(40);
      }
   });
});
