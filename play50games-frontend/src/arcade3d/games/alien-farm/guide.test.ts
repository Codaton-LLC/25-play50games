// guide.ts: the beacons go to the next crop (while there is room) and to the beam (while carrying); read-only.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { basketFull, beamGoal, cropGoal, farmHint, hintCode, toolCooling } from "./guide";
import { HARVEST, createRun, guidePlot } from "./rules";

describe("alien-farm guide", () => {
   it("marks the crop guidePlot picks, none when the basket is full, and never changes the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(7, LEVELS[id]);
         const before = JSON.stringify(run);
         expect(cropGoal(run)).toBe(guidePlot(run));
         expect(JSON.stringify(run)).toBe(before);
         expect(beamGoal(run)).toBe(false);
         run.cargoCount = 2;
         expect(beamGoal(run)).toBe(true);
         run.cargoCount = run.level.capacity;
         expect(basketFull(run)).toBe(true);
         expect(cropGoal(run)).toBe(-1);
      }
   });

   it("says pick, carry, full, spores and daze, with the right button", () => {
      const run = createRun(3, LEVELS[1]);
      run.time = 1;
      const crop = cropGoal(run);
      expect(crop).toBeGreaterThanOrEqual(0);
      expect(farmHint(run, hintCode(run, crop), false).text).toMatch(/press E/);
      expect(farmHint(run, hintCode(run, crop), true).text).toMatch(/tap Pick/);
      run.cargoCount = 2;
      expect(farmHint(run, hintCode(run, crop), false)).toMatchObject({ tone: "carry" });
      expect(farmHint(run, hintCode(run, crop), false).text).toContain(`2 / ${HARVEST.capacity}`);
      run.cargoCount = HARVEST.capacity;
      expect(farmHint(run, hintCode(run, -1), false).tone).toBe("ready");
      run.farmer.inSpore = true;
      expect(farmHint(run, hintCode(run, -1), false)).toMatchObject({ tone: "warn", sticky: true });
      run.stunUntil = run.time + 1;
      expect(farmHint(run, hintCode(run, -1), false).text).toMatch(/Dazed/);
   });

   it("tells when the tool is cooling", () => {
      const run = createRun(1, LEVELS[1]);
      run.time = 5;
      expect(toolCooling(run)).toBe(false);
      run.cooldownUntil = 5.4;
      expect(toolCooling(run)).toBe(true);
   });
});
