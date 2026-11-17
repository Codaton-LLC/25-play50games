import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { citySpots, destinationFor, districtFor } from "./looks";
import { createRun, padsReachable } from "./rules";

describe("taxi district scenery", () => {
   it("each district has its own palette and set-piece arrangement", () => {
      expect(new Set(LEVEL_IDS.map((id) => JSON.stringify(districtFor(id)))).size).toBe(5);
      expect(citySpots(1).landmarks).toEqual([]);
      for (const id of [2, 3, 4, 5] as const) expect(citySpots(id).landmarks.length).toBeGreaterThan(0);
      expect(citySpots(3).landmarks).not.toEqual(citySpots(4).landmarks);
   });
   it("Downtown distinguishes office/home drop-offs while pickups and L1 keep their original cues", () => {
      const run = createRun(19, LEVELS[2]);
      expect(destinationFor(run)).toBeNull();
      run.phase = 1;
      for (const [i, label, color] of [[0, "Office drop-off", "#38bdf8"], [1, "Home drop-off", "#22c55e"]] as const) {
         run.fares[0].drop = run.pads.findIndex((p) => p.i === i);
         expect(run.fares[0].drop).toBeGreaterThanOrEqual(0);
         expect(destinationFor(run)).toEqual({ label, color });
      }
      const neighborhood = createRun(19, LEVELS[1]);
      neighborhood.phase = 1;
      expect(destinationFor(neighborhood)).toBeNull();
   });
   for (const id of LEVEL_IDS) {
      it(`L${id}: new props stay inside existing solids, leaving roads and pads clear`, () => {
         const run = createRun(19, LEVELS[id]);
         expect(padsReachable(run)).toBe(true);
         for (const p of citySpots(id).landmarks) {
            expect(run.buildings.some((b) => p.x - p.sx! / 2 >= b.min.x && p.x + p.sx! / 2 <= b.max.x && p.z - p.sz! / 2 >= b.min.z && p.z + p.sz! / 2 <= b.max.z && p.y + p.sy! / 2 <= b.max.y)).toBe(true);
         }
         expect(run.buildings.some((b) => run.x >= b.min.x && run.x <= b.max.x && run.z >= b.min.z && run.z <= b.max.z)).toBe(false);
      });
   }
});
