import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { createRun, buildCourse } from "./rules";
import { hintFor, nextTarget } from "./guide";

describe("obstacle-race clarity guide", () => {
   it("gives guidance on every level without mutating the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(buildCourse(LEVELS[id]));
         const before = JSON.stringify(run);
         nextTarget(run);
         expect(hintFor(run).text).toBeTruthy();
         expect(JSON.stringify(run)).toBe(before);
      }
   });
   it("advances from checkpoints to the finish, warning during recovery", () => {
      const run = createRun(buildCourse(LEVELS[1]));
      expect(nextTarget(run).z).toBe(-run.course.checkpoints[1].line);
      run.checkpoint = 3;
      expect(nextTarget(run).z).toBe(-run.course.finish.line);
      expect(hintFor(run).text).toMatch(/finish arch/);
      run.runner.state = "lost";
      expect(hintFor(run).tone).toBe("warn");
      run.ended = "win";
      expect(nextTarget(run).hidden).toBe(true);
      expect(hintFor(run).text).toBeNull();
   });
});
