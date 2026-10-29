// guide.ts: the beacon and the hint follow the run and never change it.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { LOW_BATTERY, canScoop, emptyGoal, hintCode, hintFor, nextGoal } from "./guide";
import { CRUISE_Y, FLOOR_Y, createRun } from "./rules";

describe("submarine-treasure-dive guide", () => {
   it("points at a treasure on every level and never changes the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(3, LEVELS[id]);
         const before = JSON.stringify(run);
         const goal = emptyGoal();
         nextGoal(run, goal);
         expect(goal.kind).toBe("treasure");
         expect(hintFor(run, goal).text).toMatch(/Dive/);
         expect(JSON.stringify(run)).toBe(before);
      }
   });

   it("says ready only near the treasure, scooping once low, then sends the sub to the dock", () => {
      const run = createRun(3, LEVELS[1]);
      const goal = emptyGoal();
      nextGoal(run, goal);
      run.sub.x = goal.x;
      run.sub.z = goal.z;
      run.sub.y = CRUISE_Y;
      expect(canScoop(run)).toBe(false);
      expect(hintFor(run, nextGoal(run, goal)).text).toMatch(/Hold Dive to sink/);
      const high = hintCode(run, goal);
      run.sub.y = FLOOR_Y;
      expect(hintFor(run, goal).text).toMatch(/Scooping/);
      expect(hintCode(run, goal)).not.toBe(high);
      for (const t of run.treasures) t.taken = true;
      run.found = run.treasures.length;
      expect(nextGoal(run, goal)).toMatchObject({ kind: "dock", x: run.dock.x, z: run.dock.z });
      expect(hintFor(run, goal).text).toMatch(/dock/);
      run.over = "win";
      expect(nextGoal(run, goal).kind).toBe("none");
      expect(hintCode(run, goal)).toBe(0);
   });

   it("keeps its treasure against a slightly nearer one and warns on a low battery", () => {
      const run = createRun(3, LEVELS[1]);
      const goal = emptyGoal();
      nextGoal(run, goal);
      const index = goal.index;
      run.sub.x += 0.01;
      expect(nextGoal(run, goal).index).toBe(index);
      run.sub.battery = LOW_BATTERY - 1;
      expect(hintFor(run, goal).tone).toBe("warn");
      expect(hintFor(run, goal).text).toMatch(/Battery low/);
   });
});
