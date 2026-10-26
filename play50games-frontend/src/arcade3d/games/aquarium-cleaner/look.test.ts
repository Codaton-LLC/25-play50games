import { describe, expect, it } from "vitest";
import { fitView } from "@/arcade3d/core/view";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { HALL, WINDOW, coralSpots, fog, hallSpots, schoolsOf, viewFor } from "./looks";
import { createRun } from "./rules";

// a phone in portrait with the HUD and the touch controls lifted by the cookie banner, a desktop with the HUD
const SCREENS = [
   { width: 390, height: 844, avoid: [{ left: 0, top: 0, right: 390, bottom: 60 }, { left: 0, top: 514, right: 390, bottom: 844 }] },
   { width: 1280, height: 800, avoid: [{ left: 0, top: 0, right: 1280, bottom: 56 }] },
   { width: 844, height: 390, avoid: [{ left: 0, top: 0, right: 844, bottom: 56 }] },
];

describe("aquarium-cleaner camera and fog", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: one yaw (the open front faces the camera) and the fog starts past the whole window on every screen`, () => {
         const v = viewFor(id);
         expect(v.yaws).toEqual([0]);
         const [, near, far] = fog(LEVELS[id]);
         for (const s of SCREENS) {
            const f = fitView({ ...s, fov: v.fov!, area: v.area, pitch: v.pitch, yaws: v.yaws, focus: v.focus, margin: v.margin, padding: v.padding, shift: true });
            expect(f.yaw).toBe(0);
            expect(f.distance).toBeLessThan(400);
            // the far edge of the window is still before the fog begins
            expect(near).toBeGreaterThan(f.distance + WINDOW.d / 2 + 2);
            expect(far).toBeGreaterThan(near);
         }
      });
   }
});

describe("aquarium-cleaner decor never stands between the camera and the diver", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: coral against the back glass or the back of the side glass, fish high and in the back half (100 seeds)`, () => {
         for (let seed = 1; seed <= 100; seed++) {
            const run = createRun(seed, LEVELS[id]);
            for (const c of coralSpots(run, 5)) {
               expect(c.z).toBeLessThan(-run.hz + 1 + LEVELS[id].depth * 0.55 + 1e-9);
               expect(c.sx ?? c.sy ?? c.sz).toBeUndefined();
               const back = Math.abs(c.z + run.hz - 0.7) < 1e-9;
               const side = Math.abs(Math.abs(c.x) - (run.hx - 0.9)) < 1e-9;
               expect(back || side).toBe(true);
            }
            for (const s of schoolsOf(run)) {
               expect(s.y - 0.2).toBeGreaterThan(2.2);
               expect(s.cz + s.rz).toBeLessThan(0);
            }
         }
      });
   }
});

describe("aquarium-cleaner hall round the tank", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: the hall floor reaches past the fog, the plinth stays outside the glass, the front lip never hides the diver, the wall stands behind`, () => {
         const level = LEVELS[id];
         const [, , far] = fog(level);
         expect(HALL.reach).toBeGreaterThan(far);
         const spots = hallSpots(level);
         const hx = level.width / 2;
         const hz = level.depth / 2;
         for (const s of spots) {
            // nothing of the hall stands inside the tank
            const inside = Math.abs(s.x) + (s.sx ?? 1) / 2 <= hx && Math.abs(s.z) + (s.sz ?? 1) / 2 <= hz;
            expect(inside).toBe(false);
            // on the camera side (z > hz) only the low lip
            if (s.z > hz) expect((s.sy ?? 1)).toBeLessThanOrEqual(0.2);
         }
         const wall = spots.find((s) => (s.sy ?? 0) > 1)!;
         expect(wall.z + (wall.sz ?? 0) / 2).toBeLessThan(-hz - 5);
      });
   }
});
