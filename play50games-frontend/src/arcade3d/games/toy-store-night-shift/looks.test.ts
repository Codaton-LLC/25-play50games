import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { fitView } from "@/arcade3d/core/view";
import { BACK, FOG, FOV, WALL_H, WINDOW, aimBounds, decorOf, fog, signBaseSpots, signSpots, slotSpot, viewFor, wallSpots, windowBox } from "./looks";
import { SHELF_H, createRun, standable } from "./rules";

describe("toy store looks", () => {
   it("keeps decor behind the walkable floor, so it can never hide or clip the guard", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < 20; seed++) {
            const run = createRun(seed, LEVELS[id]);
            for (const d of decorOf(run)) {
               expect(d.z).toBeLessThan(-run.hz);
               expect(d.z).toBeGreaterThan(-run.hz - BACK);
               expect(standable(run, d.x, d.z, 0)).toBe(false);
            }
            const { walls } = wallSpots(LEVELS[id]);
            for (const w of walls) expect(Math.abs(w.x ?? 0) + Math.abs(w.z ?? 0)).toBeGreaterThan(0);
         }
      }
   });

   it("puts one sign and one base on every shelf, flat on its top, and the toy slots beside the sign", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(3, LEVELS[id]);
         const spots = signSpots(run);
         const total = Object.values(spots).reduce((n, list) => n + list.length, 0);
         expect(total).toBe(run.shelves.length);
         expect(signBaseSpots(run)).toHaveLength(run.shelves.length);
         for (const list of Object.values(spots)) for (const s of list) expect(s.y).toBeGreaterThan(SHELF_H);
         for (const slot of [0, 1, 2, 3]) {
            const p = slotSpot({ x: 0, z: 0 }, slot);
            expect(Math.abs(p.x)).toBeGreaterThan(0.6);
            expect(Math.abs(p.x)).toBeLessThan(1.95);
            expect(p.y).toBe(SHELF_H);
         }
      }
   });

   it("fits a window round the guard and scrolls only where the store is bigger than it", () => {
      for (const id of LEVEL_IDS) {
         const win = windowBox(LEVELS[id]);
         const aim = aimBounds(LEVELS[id]);
         expect(win.max.x - win.min.x).toBeLessThanOrEqual(WINDOW.w);
         expect(win.max.z - win.min.z).toBeLessThanOrEqual(WINDOW.d);
         expect(aim.max.x).toBeGreaterThanOrEqual(0);
         expect(aim.max.z).toBeGreaterThanOrEqual(0);
      }
   });

   it("the fog starts past the fitted camera and the whole window on a phone and a desktop, and the phone camera stays close", () => {
      for (const [w, h] of [[390, 844], [1280, 800], [844, 390]] as const) {
         for (const id of LEVEL_IDS) {
            const v = viewFor(id);
            const f = fitView({ width: w, height: h, fov: FOV, area: v.area, pitch: v.pitch, yaws: v.yaws, focus: v.focus, margin: v.margin, shift: true });
            expect(f.distance + Math.max(WINDOW.w, WINDOW.d) / 2).toBeLessThan(FOG.near);
            expect(fog(LEVELS[id])).toEqual([LEVELS[id].background, FOG.near, FOG.far]);
            if (w < h) expect(f.distance).toBeLessThan(24);
         }
      }
   });

   it("the wall on the portrait camera's side (+x, yaw pi/2) is a low counter, so it never hides the guard", () => {
      for (const id of LEVEL_IDS) {
         const { walls, trims } = wallSpots(LEVELS[id]);
         const right = walls.filter((w) => w.x > 0 && (w.sx ?? 1) < 1);
         expect(right.length).toBe(1);
         expect((right[0].sy ?? 1)).toBeLessThanOrEqual(0.8);
         expect(right[0].y).toBeCloseTo((right[0].sy ?? 1) / 2, 6);
         for (const t of trims.filter((t) => t.x > 0 && (t.sx ?? 1) < 1)) expect(t.y + (t.sy ?? 0) / 2).toBeLessThanOrEqual(0.8);
         // the back and the left walls stay full height
         expect(walls.filter((w) => (w.sy ?? 1) === WALL_H).length).toBe(2);
      }
   });
});
