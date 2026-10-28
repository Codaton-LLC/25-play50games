import { describe, expect, it } from "vitest";
import { createRun, step, currentAt, rotateFan, createInput } from "./rules";

describe("redirect the wind", () => {
   it("rotates a nearby fan through four directions and toggles it separately", () => {
      const r = createRun(1);
      const f = r.fans[0];
      for (let i = 0; i < 4; i++) rotateFan(f);
      expect(f.dir).toBe(0);
      r.hero.z = f.z;
      step(r, 16, { ...createInput(), actionPressed: true, jumpHeld: true });
      expect(f.on).toBe(false);
   });
   it("an upward current lifts without a jump, with vector addition at intersections", () => {
      const r = createRun(2);
      const f = r.fans[0];
      const p = { x: f.x, y: f.y + 1, z: f.z };
      const a = currentAt(r, p);
      expect(a.y).toBe(7);
      r.fans.push({ ...f, dir: 1, y: p.y, index: 999 });
      const b = currentAt(r, p);
      expect(b.y).toBe(7);
      expect(b.z).toBe(-7);
      Object.assign(r.hero, p);
      step(r, 100, createInput());
      expect(r.hero.y).toBeGreaterThan(p.y);
   });
   it("pauses the storm during a first room setup and reveals a hint after 20 seconds", () => {
      const r = createRun(1);
      for (let i = 0; i < 210; i++) step(r, 100, createInput());
      expect(r.stormMs).toBe(0);
      expect(r.hint).toBe(true);
      expect(r.hero.hp).toBe(5);
   });
   it("ignores nonfinite time and never lets a large frame teleport the hero", () => {
      const r = createRun(1);
      step(r, Number.NaN, createInput());
      expect(r.ms).toBe(0);
      step(r, 10000, { ...createInput(), moveZ: -1 });
      expect(r.ms).toBe(250);
      expect(r.hero.z).toBeGreaterThan(-4);
   });
});
