import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { createRun } from "./rules";
import { hintFor, nextTarget } from "./guide";

describe("food-catcher clarity guide", () => {
   it("gives guidance on every level without mutating the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(101, LEVELS[id]);
         const before = JSON.stringify(run);
         nextTarget(run);
         expect(hintFor(run).text).toBeTruthy();
         expect(JSON.stringify(run)).toBe(before);
      }
   });
   it("ignores hazards and inactive items, and warns on the last life", () => {
      const run = createRun(101);
      expect(nextTarget(run)).toBe(-1);
      Object.assign(run.items[0], { active: true, bad: true, bornMs: 0, speed: 1 });
      Object.assign(run.items[1], { active: true, bad: false, bornMs: 0, speed: 1 });
      expect(nextTarget(run)).toBe(1);
      run.lives = 1;
      expect(hintFor(run).tone).toBe("warn");
      run.ended = "lose";
      expect(hintFor(run).text).toBeNull();
   });
});
