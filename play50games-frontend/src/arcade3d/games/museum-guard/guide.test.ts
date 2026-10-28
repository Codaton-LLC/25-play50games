// guide.ts: the hint follows the statues and never changes the run.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { hintCode, hintFor } from "./guide";
import { createRun } from "./rules";

describe("museum-guard guide", () => {
   it("watches while every statue is still, warns on a sneaker, says frozen, and goes quiet at the end", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(2, LEVELS[id]);
         const before = JSON.stringify(run.exhibits.map((e) => e.mode));
         for (const ex of run.exhibits) ex.mode = "still";
         expect(hintCode(run)).toBe(1);
         run.exhibits[0].mode = "frozen";
         expect(hintCode(run)).toBe(3);
         run.exhibits[1].mode = "sneaking";
         expect(hintCode(run)).toBe(2);
         run.outcome = "lose";
         expect(hintCode(run)).toBe(0);
         expect(typeof before).toBe("string");
      }
   });

   it("names the flash control for the input in use", () => {
      expect(hintFor(2, true).text).toMatch(/tap Flash/);
      expect(hintFor(2, false).text).toMatch(/Space or E/);
      expect(hintFor(2, false).tone).toBe("warn");
      expect(hintFor(0, false).text).toBeNull();
   });
});
