// guide.ts: the beacon and the hint follow the run and never change it.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { chaseNear, emptyGoal, hintCode, hintFor, nextGoal } from "./guide";
import { createRun } from "./rules";

describe("cat-vs-robot-vacuum guide", () => {
   it("points at a fish on every level and never changes the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(4, LEVELS[id]);
         const before = JSON.stringify(run);
         const goal = emptyGoal();
         nextGoal(run, goal);
         expect(goal.kind).toBe("treat");
         expect(hintFor(run, goal).text).toMatch(/fish/);
         expect(JSON.stringify(run)).toBe(before);
      }
   });

   it("sends the cat to the bed when every fish is eaten, and goes quiet at the end", () => {
      const run = createRun(4, LEVELS[1]);
      const goal = emptyGoal();
      for (const t of run.treats) t.got = true;
      run.collected = run.treats.length;
      expect(nextGoal(run, goal)).toMatchObject({ kind: "bed", x: run.home.x, z: run.home.z });
      expect(hintFor(run, goal).text).toMatch(/bed/);
      run.over = "win";
      expect(nextGoal(run, goal).kind).toBe("none");
      expect(hintCode(run, goal)).toBe(0);
   });

   it("warns when a vacuum chases from close by, unless the cat is hopping", () => {
      const run = createRun(4, LEVELS[1]);
      const goal = emptyGoal();
      nextGoal(run, goal);
      const v = run.vacuums[0];
      v.mode = "chase";
      v.agent.x = run.cat.x + 1;
      v.agent.z = run.cat.z;
      expect(chaseNear(run)).toBe(true);
      expect(hintFor(run, goal).tone).toBe("warn");
      run.cat.hop = 0.2;
      expect(chaseNear(run)).toBe(false);
   });

   it("keeps its fish against a slightly nearer one", () => {
      const run = createRun(4, LEVELS[1]);
      const goal = emptyGoal();
      nextGoal(run, goal);
      const index = goal.index;
      run.cat.x += 0.01;
      expect(nextGoal(run, goal).index).toBe(index);
   });
});
