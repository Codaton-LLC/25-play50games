import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { BACK, aimBounds, decorOf, signBaseSpots, signSpots, slotSpot, wallSpots, windowBox } from "./looks";
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
         expect(win.max.x - win.min.x).toBeLessThanOrEqual(18);
         expect(win.max.z - win.min.z).toBeLessThanOrEqual(12);
         expect(aim.max.x).toBeGreaterThanOrEqual(0);
         expect(aim.max.z).toBeGreaterThanOrEqual(0);
      }
   });
});
