import { describe, expect, it } from "vitest";
import { VIEW_SOLIDS_MAX } from "@/arcade3d/core/camera/CameraViews";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { TOP_DISTANCE, fogFor, obstacleBoxes, topDistanceFor, wallBoxes, wallSpots } from "./looks";
import { createRun } from "./rules";

describe("wizard camera views", () => {
   it("the top view sits inside the clear part of the fog on every level", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const fogNear = fogFor(level)[1];
         const top = topDistanceFor(level);
         expect(top).toBeGreaterThan(0);
         expect(top).toBeLessThanOrEqual(TOP_DISTANCE);
         // half the fog's start at most: a margin for the lab edge and the lens shift
         expect(top).toBeLessThanOrEqual(fogNear * 0.5 + 1e-9);
      }
   });

   it("the camera solids (wall ring + cauldron, shelves, table) fit the hook's slots on every level", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         for (let seed = 1; seed <= 20; seed++) {
            const run = createRun(seed, level);
            const walls = wallSpots(level);
            const boxes = obstacleBoxes(run);
            // one cauldron, one per shelf, one table
            expect(boxes.length).toBe(run.shelves.length + 2);
            const out = Array.from({ length: VIEW_SOLIDS_MAX }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }));
            const n = wallBoxes(walls, out);
            expect(n + boxes.length).toBeLessThanOrEqual(VIEW_SOLIDS_MAX);
         }
      }
   });
});
