// The camera's pure parts: the start pose behind the cart on the rails, the pivot over the cart, and the
// intro's shots.
import { describe, expect, it } from "vitest";
import { orbitPosition } from "@/arcade3d/menu2/camera/orbit";
import { LEVEL_IDS } from "@/arcade3d/types";
import { CAVE_ORBIT, INTRO_STEP, PIVOT_UP, insideTube, introKeyframes, orbitPivot, orbitScale, playCamera, tubeFraction, yawAt } from "./camera";
import { courseFor } from "./rules";
import { centreAt } from "./track";

describe("the orbit camera", () => {
   it("starts behind the cart (opposite the rails' forward) and above it", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const pc = playCamera(c, 16 / 10);
         const p = centreAt(c, 0, { x: 0, y: 0, z: 0, h: 0 });
         const fx = -Math.sin(p.h);
         const fz = -Math.cos(p.h);
         const back = (pc.position[0] - p.x) * fx + (pc.position[2] - p.z) * fz;
         expect(back).toBeLessThan(-4);
         expect(pc.position[1]).toBeGreaterThan(p.y + PIVOT_UP);
      }
   });

   it("the yaw behind the rails is their heading; the orbit there sits behind the pivot", () => {
      const c = courseFor(2);
      const s = 120;
      const yaw = yawAt(c, s);
      const pv = orbitPivot(c, s, 0, 0, { x: 0, y: 0, z: 0 });
      const cam = orbitPosition(pv.x, pv.y, pv.z, yaw, CAVE_ORBIT.pitch ?? 0, 7, { x: 0, y: 0, z: 0 });
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      expect((cam.x - pv.x) * fx + (cam.z - pv.z) * fz).toBeLessThan(-5);
   });

   it("a portrait screen stands the camera farther back", () => {
      expect(orbitScale(390 / 844)).toBeGreaterThan(1.2);
      expect(orbitScale(1280 / 800)).toBe(1);
   });

   it("the intro dollies down the cave inside the tunnel: shots at most INTRO_STEP m apart, each over the rails", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const keys = introKeyframes(c).slice(c.loop ? 1 : 0);
         expect(keys.length).toBeGreaterThanOrEqual(6);
         for (let i = 0; i < keys.length; i++) {
            const [x, , z] = keys[i].position;
            // the nearest centre-line sample is within the tunnel's half width (9 m) less a margin
            let best = Infinity;
            for (let j = 0; j < c.samples.length; j += 4) best = Math.min(best, Math.hypot(c.samples[j] - x, c.samples[j + 2] - z));
            expect(best).toBeLessThan(3);
            if (i > 0) {
               const [px, , pz] = keys[i - 1].position;
               expect(Math.hypot(x - px, z - pz)).toBeLessThanOrEqual(INTRO_STEP + 1);
            }
         }
      }
   });

   it("the default chase camera sits inside the cave all along every level; a camera turned out through the wall is pulled in", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         let pulled = 0;
         for (let s = 10; s < c.finishS - 10; s += 15) {
            const yaw = yawAt(c, s);
            const pv = orbitPivot(c, s, 0, 0, { x: 0, y: 0, z: 0 });
            const behind = orbitPosition(pv.x, pv.y, pv.z, yaw, CAVE_ORBIT.pitch ?? 0, (CAVE_ORBIT.distance ?? 7) * orbitScale(390 / 844), { x: 0, y: 0, z: 0 });
            expect(tubeFraction(c, s - 6, pv, behind), `L${id} s=${s}`).toBe(1);
            // turned 90° to the side at the max distance: outside the tube, pulled in until inside
            const side = orbitPosition(pv.x, pv.y, pv.z, yaw + Math.PI / 2, 0.1, CAVE_ORBIT.maxDistance ?? 13, { x: 0, y: 0, z: 0 });
            const k = tubeFraction(c, s - 6, pv, side);
            if (k < 1) pulled++;
            const x = pv.x + (side.x - pv.x) * k;
            const y = pv.y + (side.y - pv.y) * k;
            const z = pv.z + (side.z - pv.z) * k;
            if (!(c.loop && s > c.loop.s0 + 4 && s < c.loop.s1 - 4)) expect(insideTube(c, s - 6, x, y, z) || k <= 0.15).toBe(true);
         }
         expect(pulled).toBeGreaterThan(0);
      }
   });
});
