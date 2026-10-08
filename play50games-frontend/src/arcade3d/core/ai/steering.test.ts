import { describe, expect, it } from "vitest";
import { createRng } from "../math";
import { arrive, flee, seek, separate, wander } from "./steering";
const agent = () => ({ x: 0, y: 0, z: 0, vx: 1, vy: 0, vz: 0, yaw: 0 });
describe("steering", () => {
   it("seeks, arrives and flees with reused output", () => {
      const a = agent(), target = { x: 10, y: 0, z: 0 }, out = { x: 0, y: 0, z: 0 };
      expect(seek(a, target, 3, out)).toBe(out); expect(out.x).toBe(2);
      arrive(a, { ...target, x: 1 }, 3, 3, out); expect(out.x).toBe(0);
      flee(a, target, 3, out); expect(out.x).toBe(-4);
      seek(a, a, 3, out); expect(out.x).toBe(-1);
   });
   it("wanders deterministically and separates neighbors", () => {
      const a = agent(), s1 = { angle: 0 }, s2 = { angle: 0 }, r1 = createRng(7), r2 = createRng(7);
      const out1 = { x: 0, y: 0, z: 0 }, out2 = { ...out1 };
      for (let i = 0; i < 50; i++) {
         wander(a, s1, r1, 2, 1, 0.1, out1); wander(a, s2, r2, 2, 1, 0.1, out2); expect(out1).toEqual(out2);
      }
      separate(a, [a, { x: 0.1, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }], 1, 2, out1); expect(out1.x).toBe(-2);
   });
   it("moves two coincident agents apart", () => {
      const a = agent(), b = agent(), neighbors = [a, b];
      const fa = { x: 0, y: 0, z: 0 }, fb = { ...fa };
      separate(a, neighbors, 1, 2, fa); separate(b, neighbors, 1, 2, fb);
      a.x += fa.x; b.x += fb.x; expect(Math.abs(a.x - b.x)).toBeGreaterThan(1);
   });
   it("scales wander variance with elapsed time", () => {
      const a = agent(), state = { angle: 0 }, out = { x: 0, y: 0, z: 0 };
      wander(a, state, () => 1, 2, 3, 0.25, out); expect(state.angle).toBe(1.5);
      for (const hz of [30, 60, 144]) {
         let variance = 0;
         for (let i = 0; i < hz; i++) {
            state.angle = 0; wander(a, state, () => 1, 2, 3, 1 / hz, out); variance += state.angle ** 2;
         }
         expect(variance).toBeCloseTo(9, 12);
      }
   });
});
