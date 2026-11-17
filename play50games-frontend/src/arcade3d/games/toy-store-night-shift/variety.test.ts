import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { SHARED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { ASSETS, GLB_SIZE } from "./assets";
import { LEVELS } from "./levels";
import { decorOf, departmentOf } from "./looks";
import { createRun, objectivesReachable, standable } from "./rules";

describe("toy store departments", () => {
   it("gives every department a distinct palette and shelf arrangement", () => {
      expect(new Set(LEVEL_IDS.map((id) => departmentOf(LEVELS[id]).floor)).size).toBe(5);
      for (const id of [2, 3, 4, 5] as const) {
         const run = createRun(9, LEVELS[id]);
         const original = createRun(9, { ...LEVELS[id], shelfGap: undefined, rowPitch: undefined, rowOffsets: undefined });
         expect(run.shelves.map((s) => [s.x, s.z])).not.toEqual(original.shelves.map((s) => [s.x, s.z]));
      }
   });
   it("keeps level 1's original footprint and shelf positions", () => {
      const run = createRun(9, LEVELS[1]);
      expect(run.hx).toBe(7.7);
      expect(run.hz).toBe(5);
      expect(run.shelves.map((s) => [s.x, s.z])).toEqual([[-2.7, -1.8], [2.7, -1.8], [0, 1.8]]);
   });
   for (const id of LEVEL_IDS) it(`level ${id}: props clear the entire play area and objectives remain reachable`, () => {
      for (let seed = 0; seed < 10; seed++) {
         const run = createRun(seed, LEVELS[id]);
         expect(standable(run, run.start.x, run.start.z)).toBe(true);
         expect(objectivesReachable(run)).toBe(true);
         for (const prop of decorOf(run)) {
            const size = prop.kind === "crate" ? { x: SHARED_GLB_SIZE.crate.width, z: SHARED_GLB_SIZE.crate.depth } : GLB_SIZE[prop.kind];
            const scale = ASSETS[prop.kind].scale ?? 1;
            const halfZ = (Math.abs(Math.sin(prop.rotY)) * size.x + Math.abs(Math.cos(prop.rotY)) * size.z) * scale / 2;
            expect(prop.z + halfZ).toBeLessThan(-run.hz);
         }
      }
   });
});
