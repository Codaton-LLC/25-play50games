import { describe, expect, it } from "vitest";
import { chaseFov, createChaseState, portraitPullback, stepChase } from "@/arcade3d/core/chaseCamera";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { CHASE, FOG, FOV, SKY, STORM_FOG_END, fogAt, fogFor } from "./looks";
import { createRun, step } from "./rules";
import { flatsFor, makeHeight } from "./terrain";

describe("mars-rover-mission camera, fog and sky", () => {
   it("the chase camera sits behind the rover's heading, so steering left turns the view left (the rules' right turns clockwise)", () => {
      const run = createRun(3, LEVELS[1], 1);
      const cam = stepChase(createChaseState(), { x: run.rover.x, y: 0, z: run.rover.z, yaw: run.rover.yaw }, CHASE, 1 / 60);
      // the camera is behind the rover: the rover's forward points away from it
      const fx = Math.sin(run.rover.yaw);
      const fz = Math.cos(run.rover.yaw);
      expect((run.rover.x - cam.x) * fx + (run.rover.z - cam.z) * fz).toBeGreaterThan(CHASE.distance - 1e-6);
      // drive with the stick pushed left (moveX -1): the rover ends up on the camera's left
      run.rocks.length = 0;
      for (let i = 0; i < 60; i++) step(run, { moveX: -1, moveY: -1 }, 1 / 60);
      const rightX = -Math.cos(cam.yaw);
      const rightZ = Math.sin(cam.yaw);
      expect((run.rover.x - cam.x) * rightX + (run.rover.z - cam.z) * rightZ).toBeLessThan(0);
   });

   it("a portrait phone pulls back and widens the lens; a desk keeps the base lens", () => {
      expect(chaseFov(1280 / 800, FOV, 62, 75)).toBe(FOV);
      expect(chaseFov(390 / 844, FOV, 62, 75)).toBeGreaterThan(FOV);
      expect(portraitPullback(390 / 844)).toBeGreaterThan(1);
      expect(portraitPullback(1280 / 800)).toBe(1);
   });

   it("the fog starts beyond the rover at every pull-back (only the storm's last minute veils it, under 25 %), the sky's horizon is the fog colour", () => {
      for (const id of LEVEL_IDS) {
         const back = Math.hypot(CHASE.distance, CHASE.height) * portraitPullback(390 / 844);
         if (!LEVELS[id].storm) expect(fogAt(id, LEVELS[id], 1).near).toBeGreaterThan(back);
         const f = fogAt(id, LEVELS[id], 1);
         expect(Math.max(0, (back - f.near) / (f.far - f.near))).toBeLessThan(0.25);
         expect(fogAt(id, LEVELS[id], 0.5).near).toBeGreaterThan(Math.hypot(CHASE.distance, CHASE.height));
         expect(SKY[id].bottom).toBe(FOG[id].color);
         expect(fogFor(LEVELS[id], id)).toEqual([FOG[id].color, FOG[id].near, FOG[id].far]);
      }
   });

   it("only L4's dust storm closes in as the clock runs down; it is the thickest haze", () => {
      for (const id of [1, 2, 3, 5] as LevelId[]) {
         expect(fogAt(id, LEVELS[id], 1)).toEqual({ near: FOG[id].near, far: FOG[id].far });
         expect(FOG[id].far - FOG[id].near).toBeGreaterThan(FOG[4].far - FOG[4].near);
      }
      expect(fogAt(4, LEVELS[4], 0)).toEqual({ near: FOG[4].near, far: FOG[4].far });
      expect(fogAt(4, LEVELS[4], 1).near).toBeCloseTo(STORM_FOG_END.near, 9);
      expect(fogAt(4, LEVELS[4], 1).far).toBeCloseTo(STORM_FOG_END.far, 9);
      expect(fogAt(4, LEVELS[4], 0.5).far).toBeLessThan(FOG[4].far);
   });
});

describe("mars-rover-mission terrain", () => {
   it("rings, pads, the base, props and crevasses stand on flat ground; the cliffs rise beyond the plain", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         for (let seed = 1; seed <= 20; seed++) {
            const run = createRun(seed, level, id);
            const h = makeHeight(level, id, flatsFor(run), run.boulders.map((b) => b.x));
            for (const s of run.sites) {
               const h0 = h(s.x, s.z);
               for (const [dx, dz] of [[1.8, 0], [-1.8, 0], [0, 1.8], [0, -1.8]]) expect(Math.abs(h(s.x + dx, s.z + dz) - h0)).toBeLessThan(1e-9);
            }
            const b0 = h(run.basePad.x, run.basePad.z);
            expect(Math.abs(h(run.basePad.x + 2.4, run.basePad.z) - b0)).toBeLessThan(1e-9);
            // dunes stay gentle on the plain; cliffs stand beyond it
            for (let x = -level.width / 2; x <= level.width / 2; x += 3) expect(Math.abs(h(x, 0))).toBeLessThan(0.8);
            expect(h(0, -level.depth / 2 - 20)).toBeGreaterThan(2.5);
         }
      }
   });
});
