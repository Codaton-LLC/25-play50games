// camera.ts against the README "Fitted views" table (insets 0, no banner, HUD 54 px tall).
import { describe, expect, it } from "vitest";
import { CHASE, RUNNER_DRAWN, chaseInsets, chaseProject, fitChase, type ChaseInsets } from "./camera";

const README_SAFE: ChaseInsets = { top: CHASE.defaultTop, bottom: CHASE.bottom, left: CHASE.side, right: CHASE.side };

interface Row {
   w: number;
   h: number;
   fov: number;
   camera: [number, number];
   look: number;
   binding: string;
   runner: number;
   feet: number;
   apex: number;
   lanes0: [number, number];
   lanes3: [number, number];
   floor: [number, number, number, number];
   horizon: number;
}

const TABLE: Row[] = [
   { w: 375, h: 812, fov: 60, camera: [7.33, 10.43], look: -15.13, binding: "width", runner: 81, feet: 650, apex: 507, lanes0: [12, 363], lanes3: [8, 367], floor: [452, 336, 294, 272], horizon: 204 },
   { w: 812, h: 375, fov: 50, camera: [4.3, 6.98], look: -8.02, binding: "runner", runner: 74, feet: 300, apex: 169, lanes0: [253, 559], lanes3: [247, 565], floor: [175, 121, 104, 96], horizon: 72 },
   { w: 1280, h: 800, fov: 50, camera: [3.79, 6.15], look: -7.06, binding: "runner", runner: 180, feet: 640, apex: 317, lanes0: [270, 1010], lanes3: [254, 1026], floor: [358, 248, 215, 200], horizon: 154 },
];

describe("fitChase (README table)", () => {
   for (const row of TABLE) {
      it(`${row.w} x ${row.h}`, () => {
         const fit = fitChase(row.w, row.h, README_SAFE);
         const at = (x: number, y: number, z: number) => chaseProject(fit, row.w, row.h, [x, y, z]);
         expect(fit.fov).toBe(row.fov);
         expect(fit.binding).toBe(row.binding);
         expect(fit.position[0]).toBe(0);
         expect(fit.position[1]).toBeCloseTo(row.camera[0], 1);
         expect(fit.position[2]).toBeCloseTo(row.camera[1], 1);
         expect(fit.lookAt[2]).toBeCloseTo(row.look, 1);
         const feet = at(0, 0, 0)[1];
         expect(Math.abs(feet - row.feet)).toBeLessThanOrEqual(1);
         expect(Math.abs(feet - at(0, RUNNER_DRAWN.height, 0)[1] - row.runner)).toBeLessThanOrEqual(1);
         expect(Math.abs(at(0, 2.65, 0)[1] - row.apex)).toBeLessThanOrEqual(1);
         expect(Math.abs(at(-3, 0, 0)[0] - row.lanes0[0])).toBeLessThanOrEqual(1);
         expect(Math.abs(at(3, 0, 0)[0] - row.lanes0[1])).toBeLessThanOrEqual(1);
         expect(Math.abs(at(-3, 0, 0.3)[0] - row.lanes3[0])).toBeLessThanOrEqual(1);
         expect(Math.abs(at(3, 0, 0.3)[0] - row.lanes3[1])).toBeLessThanOrEqual(1);
         [-10, -30, -50, -70].forEach((z, i) => expect(Math.abs(at(0, 0, z)[1] - row.floor[i])).toBeLessThanOrEqual(1));
         expect(Math.abs(at(0, 0, -1e6)[1] - row.horizon)).toBeLessThanOrEqual(1);
         // the horizon is below the HUD line on every view, so rule (d) never binds
         expect(row.horizon).toBeGreaterThan(CHASE.defaultTop);
      });
   }

   it("keeps the runner, its jump and the lanes inside the safe rect on more screens", () => {
      for (const [w, h] of [[390, 844], [915, 412], [360, 640], [768, 1024], [1920, 1080], [320, 568]]) {
         const fit = fitChase(w, h, README_SAFE);
         for (const x of [-3, 3]) for (const z of [-0.3, 0.3]) {
            const [sx, sy] = chaseProject(fit, w, h, [x, 0, z]);
            expect(sx).toBeGreaterThanOrEqual(CHASE.side - 0.5);
            expect(sx).toBeLessThanOrEqual(w - CHASE.side + 0.5);
            expect(sy).toBeLessThanOrEqual(h - CHASE.bottom + 0.5);
         }
         expect(chaseProject(fit, w, h, [2.45, 2.65, 0.3])[1]).toBeGreaterThanOrEqual(CHASE.defaultTop - 0.5);
         expect(fit.position[1]).toBeGreaterThanOrEqual(CHASE.minHeight - 1e-6);
      }
   });

   it("lifts the runner above the cookie banner and moves only the safe rect", () => {
      const open = fitChase(375, 812, { ...README_SAFE, bottom: CHASE.bottom + 120 });
      const feet = chaseProject(open, 375, 812, [0, 0, 0])[1];
      const safeH = 812 - (CHASE.bottom + 120) - CHASE.defaultTop;
      expect(Math.abs(feet - (812 - CHASE.bottom - 120 - CHASE.feetShare * safeH))).toBeLessThanOrEqual(0.5);
      expect(chaseProject(open, 375, 812, [3, 0, 0.3])[1]).toBeLessThanOrEqual(812 - CHASE.bottom - 120 + 0.5);
   });
});

describe("chaseInsets", () => {
   it("reads the HUD bottom, the side insets and the cookie banner from the safe area", () => {
      const hud = [
         { left: 10, top: 10, right: 300, bottom: 54 },
         { left: 290, top: 10, right: 365, bottom: 54 },
      ];
      expect(chaseInsets({ hud, obstructions: [] }, 375, 812)).toEqual({ top: 64, bottom: 16, left: 8, right: 8 });
      const notch = [
         { left: 54, top: 10, right: 400, bottom: 60 },
         { left: 700, top: 10, right: 768, bottom: 60 },
      ];
      expect(chaseInsets({ hud: notch, obstructions: [{ left: 0, top: 300, right: 812, bottom: 375 }] }, 812, 375)).toEqual({
         top: 70,
         bottom: 91,
         left: 52,
         right: 42,
      });
   });

   it("falls back to the README 64 px before the HUD is measured", () => {
      expect(chaseInsets({ hud: [], obstructions: [] }, 375, 812)).toEqual({ top: 64, bottom: 16, left: 8, right: 8 });
   });
});
