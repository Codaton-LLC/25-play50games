import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { SCENERY, SCENERY_AREA } from "./scenery";
import { ARENA } from "./rules";

describe("robot-collector scenery", () => {
   it("leaves training unchanged and gives every later level its own workstation layout", () => {
      expect(SCENERY[1]).toBeUndefined();
      const layouts = LEVEL_IDS.slice(1).map((id) => SCENERY[id]!);
      expect(new Set(layouts.map((look) => look.floor)).size).toBe(4);
      expect(new Set(layouts.map((look) => JSON.stringify(look.stations))).size).toBe(4);
      expect(layouts.map((look) => look.stations.length)).toEqual([3, 4, 5, 6]);
   });

   for (const id of LEVEL_IDS.slice(1)) it(`L${id}: all solid set pieces stay outside the driving area and inside the camera bounds`, () => {
      for (const prop of SCENERY[id]!.stations) {
         expect(Math.abs(prop.z) - 0.4).toBeGreaterThan(ARENA.halfZ);
         expect(prop.x - 1.5).toBeGreaterThanOrEqual(SCENERY_AREA.min.x);
         expect(prop.x + 1.5).toBeLessThanOrEqual(SCENERY_AREA.max.x);
         expect(prop.z - 0.4).toBeGreaterThanOrEqual(SCENERY_AREA.min.z);
         expect(prop.z + 0.4).toBeLessThanOrEqual(SCENERY_AREA.max.z);
      }
   });
});
