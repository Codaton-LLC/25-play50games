// guide.ts: bale -> (next bale) -> bay for every trip, the slow-down warning, read-only.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { bayCentre, bumpAtBale, farmHint, hintCode, nextGoal, type FarmGoal } from "./guide";
import { HITCH_SPEED, createRun, inBay } from "./rules";

const fresh = (): FarmGoal => ({ bale: -1, x: 0, z: 0 });

describe("farm guide", () => {
   it("points at this trip's bales, then the bay, on every level", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(13, LEVELS[id]);
         const before = JSON.stringify(run);
         const g = nextGoal(run, fresh());
         expect(JSON.stringify(run)).toBe(before);
         for (let n = 0; n < run.level.balesPerTrip; n++) {
            const goal = nextGoal(run, fresh());
            expect(goal.bale).toBeGreaterThanOrEqual(0);
            expect(run.bales[goal.bale].trip).toBe(run.trip);
            run.bales[goal.bale].state = "hitched";
         }
         const bay = nextGoal(run, g);
         expect(bay.bale).toBe(-1);
         const c = bayCentre(run);
         expect(inBay(run, c.x, c.z)).toBe(true);
         expect(farmHint(run, hintCode(run, bay)).tone).toBe("carry");
      }
   });

   it("warns to slow down near a bale above the hitch speed", () => {
      const run = createRun(2, LEVELS[1]);
      const g = nextGoal(run, fresh());
      run.tractor.x = g.x;
      run.tractor.z = g.z - 3;
      run.tractor.speed = HITCH_SPEED;
      expect(farmHint(run, hintCode(run, g)).tone).toBe("warn");
      expect(bumpAtBale(run)).toBe(false);
      run.tractor.z = g.z - 2.2;
      expect(bumpAtBale(run)).toBe(true);
      run.tractor.speed = 1;
      expect(farmHint(run, hintCode(run, g)).tone).toBeUndefined();
   });
});
