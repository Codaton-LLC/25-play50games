// The camera's pure parts: the start pose behind the cart on the rails, the pivot over the cart, and the
// intro's shots.
import { describe, expect, it } from "vitest";
import { orbitPosition } from "@/arcade3d/menu2/camera/orbit";
import { LEVEL_IDS } from "@/arcade3d/types";
import { CAVE_ORBIT, PIVOT_UP, introKeyframes, orbitPivot, orbitScale, playCamera, yawAt } from "./camera";
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

   it("a portrait screen stands the camera farther back; the intro has 4 shots", () => {
      expect(orbitScale(390 / 844)).toBeGreaterThan(1.2);
      expect(orbitScale(1280 / 800)).toBe(1);
      for (const id of LEVEL_IDS) expect(introKeyframes(courseFor(id))).toHaveLength(4);
   });
});
