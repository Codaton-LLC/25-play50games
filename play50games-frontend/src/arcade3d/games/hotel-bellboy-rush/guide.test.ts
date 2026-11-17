// guide.ts: the beacons go to the desk, then the elevator when a ride is due, and never to the door.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { nextGoal, type Goal } from "./guide";
import { DESK_POINT, PAD_POINT, createRun } from "./rules";

const fresh = (): Goal => ({ kind: 0, x: 0, z: 0 });

describe("hotel-bellboy-rush guide", () => {
   it("points at the desk while the trolley is empty, and never changes the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(5, LEVELS[id]);
         const before = JSON.stringify(run);
         expect(nextGoal(run, fresh())).toMatchObject({ kind: 1, x: DESK_POINT.x, z: DESK_POINT.z });
         expect(JSON.stringify(run)).toBe(before);
         run.over = "win";
         expect(nextGoal(run, fresh()).kind).toBe(0);
      }
   });

   it("points at the elevator only while the bag is for another floor, never at a door", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(5, LEVELS[id]);
         run.carrying = true;
         const bag = run.bags[run.next];
         run.floor = bag.floor;
         expect(nextGoal(run, fresh()).kind).toBe(0);
         if (run.level.floors > 1) {
            run.floor = bag.floor === 1 ? 2 : 1;
            expect(nextGoal(run, fresh())).toMatchObject({ kind: 2, x: PAD_POINT.x, z: PAD_POINT.z });
            run.hero.ride = 0.5;
            expect(nextGoal(run, fresh()).kind).toBe(0);
         }
      }
   });
});
