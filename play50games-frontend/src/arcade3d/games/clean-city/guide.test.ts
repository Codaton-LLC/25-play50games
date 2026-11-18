// guide.ts: the beacon and the hint follow the run and never change it.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { emptyGoal, gained, hintCode, hintFor, nextGoal } from "./guide";
import { START_PAD, createRun } from "./rules";

describe("clean-city guide", () => {
   it("points at a piece on every level and never changes the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(7, LEVELS[id]);
         const before = JSON.stringify(run.litter);
         const goal = emptyGoal();
         nextGoal(run, goal);
         expect(goal.kind).toBe("litter");
         expect(hintFor(run, goal).text).toBeTruthy();
         expect(JSON.stringify(run.litter)).toBe(before);
      }
   });

   it("sends the runner to the start ring while delivering and goes quiet at the end", () => {
      const run = createRun(7, LEVELS[1]);
      const goal = emptyGoal();
      run.delivering = true;
      expect(nextGoal(run, goal)).toMatchObject({ kind: "pad", x: START_PAD.x, z: START_PAD.z });
      expect(hintFor(run, goal).text).toMatch(/start ring/);
      run.ended = "win";
      expect(hintCode(run, goal)).toBe(0);
      expect(hintFor(run, goal).text).toBeNull();
   });

   it("keeps its piece against a slightly nearer one, and measures what a pickup added", () => {
      const run = createRun(7, LEVELS[1]);
      const goal = emptyGoal();
      nextGoal(run, goal);
      const index = goal.index;
      run.runner.x += 0.01;
      expect(nextGoal(run, goal).index).toBe(index);
      expect(gained(run, run.score - 60)).toBe(60);
      expect(gained(run, run.score + 5)).toBe(0);
   });

   it("names the sorting batch on the sorting level", () => {
      const run = createRun(7, LEVELS[5]);
      const goal = emptyGoal();
      nextGoal(run, goal);
      expect(hintFor(run, goal).text).toMatch(/bottles and bags/);
      run.targetKind = 2;
      expect(hintFor(run, goal).text).toMatch(/cans and bananas/);
   });
});
