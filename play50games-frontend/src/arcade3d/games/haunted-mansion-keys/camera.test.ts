import { describe, expect, it } from "vitest";
import { VIEW_SOLIDS_MAX } from "@/arcade3d/core/camera/CameraViews";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { cameraSolidList } from "./looks";
import { createRun } from "./rules";

const area = (b: { min: { x: number; z: number }; max: { x: number; z: number } }) => (b.max.x - b.min.x) * (b.max.z - b.min.z);

describe("haunted camera solids", () => {
   it("walls and furniture fit the camera's slots on every level and seed", () => {
      let most = 0;
      for (const id of LEVEL_IDS) {
         for (let seed = 1; seed <= 40; seed++) {
            const run = createRun(seed, LEVELS[id]);
            const list = cameraSolidList(run.walls, run.solids);
            most = Math.max(most, list.length);
            expect(list.length).toBeLessThanOrEqual(VIEW_SOLIDS_MAX);
            // every wall is kept, then the furniture
            expect(list.slice(0, run.walls.length)).toEqual(run.walls);
         }
      }
      console.info(`haunted camera solids: most boxes on any level or seed ${most} of ${VIEW_SOLIDS_MAX}`);
   });

   it("the furniture is ordered largest footprint first", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(7, LEVELS[id]);
         const furniture = cameraSolidList(run.walls, run.solids).slice(run.walls.length);
         for (let i = 1; i < furniture.length; i++) {
            expect(area(furniture[i - 1])).toBeGreaterThanOrEqual(area(furniture[i]));
         }
      }
   });
});
