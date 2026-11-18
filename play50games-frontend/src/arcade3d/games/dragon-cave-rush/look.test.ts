// The cave's look (look.ts): the light per level, the tunnel mesh round the rails (open over the level 5
// loop), the floor strip, and the breath flash.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { breathLight, buildCave, buildFloor, caveLight, levelEnvironment } from "./look";
import { courseFor } from "./rules";

describe("the cave's look", () => {
   it("level 3 is the dark one; every level lights at night with its fog", () => {
      expect(caveLight(3, true).ambient).toBeLessThan(caveLight(1, false).ambient);
      for (const id of LEVEL_IDS) expect(levelEnvironment(id, id === 3).lighting).toBe("night");
   });

   it("the tunnel: finite vertices, a valid index, under 30k triangles; level 5 leaves the loop open", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const m = buildCave(c);
         expect(m.positions.every(Number.isFinite)).toBe(true);
         const n = m.positions.length / 3;
         expect(m.colors.length).toBe(m.positions.length);
         for (const i of m.indices) expect(i).toBeLessThan(n);
         expect(m.indices.length).toBeGreaterThan(1000);
         expect(m.indices.length / 3).toBeLessThan(30_000);
         const f = buildFloor(c);
         expect(f.indices.length % 3).toBe(0);
         // every floor triangle faces up (else it renders black from the light above)
         for (let t = 0; t < f.indices.length; t += 3) {
            const [a, b, d] = [f.indices[t] * 3, f.indices[t + 1] * 3, f.indices[t + 2] * 3];
            const ux = f.positions[b] - f.positions[a];
            const uz = f.positions[b + 2] - f.positions[a + 2];
            const vx = f.positions[d] - f.positions[a];
            const vz = f.positions[d + 2] - f.positions[a + 2];
            expect(uz * vx - ux * vz).toBeGreaterThanOrEqual(0); // 0: the clamped first rings at s = 0
         }
      }
      const l5 = courseFor(5);
      expect(buildCave(l5).indices.length).toBeLessThan(buildCave({ ...l5, loop: null }).indices.length);
   });

   it("a breath lights the track ahead for 1.2 s, then fades", () => {
      expect(breathLight(-1)).toBe(0);
      expect(breathLight(0)).toBe(1);
      expect(breathLight(1100)).toBeGreaterThan(0.25);
      expect(breathLight(3000)).toBe(0);
   });
});
