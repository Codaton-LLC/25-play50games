import { describe, it, expect } from "vitest";
import { createOrbit, DEFAULT_ORBIT } from "../../menu2/camera/orbit";
import { FACTORY_ORBIT, factorySolids } from "./camera";
import { createRun, createStepInput, step } from "./rules";
describe("shared free orbit contract", () => {
   it("retains shared gestures, zoom and auto-follow settings", () => {
      const o = createOrbit(FACTORY_ORBIT);
      expect(o.viewYaw).toBe(FACTORY_ORBIT.yaw);
      expect(FACTORY_ORBIT.dragYawPerPx).toBe(DEFAULT_ORBIT.dragYawPerPx);
      expect(FACTORY_ORBIT.maxDistance).toBeGreaterThan(FACTORY_ORBIT.minDistance);
      expect(FACTORY_ORBIT.autoFollow).toBe(true);
   });
   it("a quarter turn rotates movement and supplies camera collision boxes", () => {
      const a = createRun(), b = createRun(), i = createStepInput();
      i.moveZ = -1;
      step(a, 100, i);
      i.yaw = Math.PI / 2;
      step(b, 100, i);
      expect(a.hero.z).toBeLessThan(b.hero.z);
      expect(b.hero.x).toBeLessThan(a.hero.x);
      const boxes = Array.from({ length: 4 }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
      expect(factorySolids(boxes)).toBe(3);
      for (const box of boxes.slice(0, 3))
         expect(box.min.x).toBeLessThan(box.max.x);
   });
});
