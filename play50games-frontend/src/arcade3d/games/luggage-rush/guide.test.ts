// guide.ts: the beacons and the hint follow the front bag and never change the run.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { emptyGoal, frontBag, hintCode, hintFor, nextGoal, wantedChoice, wrongDiverter } from "./guide";
import { SEG, createRun, placeBag } from "./rules";

describe("luggage-rush guide", () => {
   it("wants diverters straight for the first chute and down the spine for the last", () => {
      expect([0, 1, 2, 3].map((d) => wantedChoice(0, d))).toEqual([0, 0, 0, 0]);
      expect([0, 1, 2, 3].map((d) => wantedChoice(1, d))).toEqual([1, 0, 0, 0]);
      expect([0, 1, 2, 3].map((d) => wantedChoice(3, d))).toEqual([1, 1, 1, 0]);
   });

   it("says nothing without a bag and never changes the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(2, LEVELS[id]);
         const before = JSON.stringify(run);
         expect(nextGoal(run, emptyGoal()).kind).toBe("none");
         expect(hintFor(emptyGoal(), true).text).toBeNull();
         expect(JSON.stringify(run)).toBe(before);
      }
   });

   it("flips the first wrong diverter for the front bag, then points at its chute", () => {
      const run = createRun(2, LEVELS[1]);
      expect(placeBag(run, 1, false, false)).toBeGreaterThanOrEqual(0);
      const bag = frontBag(run);
      expect(bag?.segment).toBe(SEG.entry);
      const goal = emptyGoal();
      expect(nextGoal(run, goal)).toMatchObject({ kind: "flip", diverter: 0, flight: 1 });
      expect(hintFor(goal, true).text).toMatch(/Tap diverter 1.*blue square/);
      expect(hintFor(goal, false).text).toMatch(/Press A/);
      const before = hintCode(goal);
      run.choices[0] = 1;
      expect(nextGoal(run, goal)).toMatchObject({ kind: "chute", flight: 1 });
      expect(hintFor(goal, false).text).toMatch(/chute 2/);
      expect(hintCode(goal)).not.toBe(before);
   });

   it("ignores a locked diverter and a bag already past the last one", () => {
      const run = createRun(2, LEVELS[1]);
      placeBag(run, 2, false, false);
      run.choices[0] = 1;
      run.choices[1] = 1;
      run.choices[2] = 1;
      run.time = 1;
      expect(wrongDiverter(run, run.bags.find((b) => b.alive)!)).toBe(-1);
      for (const b of run.bags) if (b.alive) b.segment = SEG.chuteG;
      expect(frontBag(run)).toBeNull();
   });
});
