// guide.ts: the beacon and the hint follow the run and never change it.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { LOW_AIR, emptyGoal, hintCode, hintFor, nextGoal, workTenths } from "./guide";
import { CARRY_MAX, createRun } from "./rules";

describe("aquarium-cleaner guide", () => {
   it("picks a goal on every level and never changes the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(5, LEVELS[id]);
         const before = JSON.stringify(run);
         const goal = emptyGoal();
         nextGoal(run, goal);
         expect(goal.kind).not.toBe("none");
         expect(hintFor(run, goal).text).toBeTruthy();
         expect(JSON.stringify(run)).toBe(before);
      }
   });

   it("sends a full-handed diver to the basket, and the hatch once every task is done", () => {
      const run = createRun(5, LEVELS[1]);
      const goal = emptyGoal();
      for (let i = 0; i < CARRY_MAX && i < run.trash.length; i++) {
         run.trash[i].state = 1;
         run.carried.push(i);
      }
      if (run.carried.length === CARRY_MAX) {
         expect(nextGoal(run, goal).kind).toBe("basket");
         expect(hintFor(run, goal).text).toMatch(/basket/);
      }
      run.done = run.tasks;
      expect(nextGoal(run, goal).kind).toBe("hatch");
      run.over = "win";
      expect(nextGoal(run, goal).kind).toBe("none");
      expect(hintCode(run, goal)).toBe(0);
   });

   it("points at the bubble column when the air is low", () => {
      const run = createRun(5, LEVELS[1]);
      run.hero.x = run.column.x + 6;
      run.hero.air = LOW_AIR - 1;
      const goal = emptyGoal();
      expect(nextGoal(run, goal).kind).toBe("column");
      expect(hintFor(run, goal).tone).toBe("warn");
      run.hero.air = 100;
      expect(nextGoal(run, goal).kind).not.toBe("column");
   });

   it("keeps its goal against a slightly nearer one, and shows the work percent", () => {
      const run = createRun(5, LEVELS[1]);
      const goal = emptyGoal();
      nextGoal(run, goal);
      const kind = goal.kind;
      const index = goal.index;
      run.hero.x += 0.01;
      nextGoal(run, goal);
      expect([goal.kind, goal.index]).toEqual([kind, index]);
      run.holdKind = 1;
      run.holdIndex = 0;
      run.holdTime = 0.5;
      expect(workTenths(run)).toBe(5);
      expect(hintFor(run, goal).text).toMatch(/50%|High patch/);
      expect(hintCode(run, goal)).not.toBe(0);
   });
});
