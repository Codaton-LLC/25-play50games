import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { createRun } from "./rules";
import { hintFor, nextTarget } from "./guide";

describe("robot-collector clarity guide", () => {
   it("gives guidance on every level without mutating the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(101, LEVELS[id]);
         const before = JSON.stringify(run);
         nextTarget(run);
         expect(hintFor(run).text).toBeTruthy();
         expect(JSON.stringify(run)).toBe(before);
      }
   });
   it("keeps an active target, replaces collected ones and shows floor warnings", () => {
      const run = createRun(101);
      const target = nextTarget(run);
      expect(target).toBeGreaterThanOrEqual(0);
      expect(nextTarget(run, target)).toBe(target);
      run.progress.taken[target] = true;
      expect(nextTarget(run, target)).not.toBe(target);
      run.slowed = true;
      expect(hintFor(run).tone).toBe("warn");
      run.slowed = false;
      run.belted = true;
      expect(hintFor(run).tone).toBe("carry");
      run.progress.collected = run.progress.taken.length;
      expect(nextTarget(run)).toBe(-1);
      expect(hintFor(run).text).toBeNull();
   });
});
