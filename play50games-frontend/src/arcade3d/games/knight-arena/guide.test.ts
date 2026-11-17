import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { createRun } from "./rules";
import { hintFor, nextTarget } from "./guide";

describe("knight-arena clarity guide", () => {
   it("gives guidance on every level without mutating the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(101, LEVELS[id]);
         const before = JSON.stringify(run);
         nextTarget(run);
         expect(hintFor(run).text).toBeTruthy();
         expect(JSON.stringify(run)).toBe(before);
      }
   });
   it("shows beat readiness, tomato warnings, spin and completion", () => {
      const run = createRun(101);
      const cue = run.map.cues[0];
      run.timeMs = cue.beatTimeMs;
      expect(nextTarget(run)).toBe(cue);
      expect(hintFor(run).tone).toBe("ready");
      cue.kind = "tomato";
      expect(hintFor(run).tone).toBe("warn");
      cue.status = "hit";
      run.spinMeter = 100;
      expect(hintFor(run).text).toMatch(/Spin ready/);
      run.finished = true;
      expect(hintFor(run).text).toBeNull();
   });
});
