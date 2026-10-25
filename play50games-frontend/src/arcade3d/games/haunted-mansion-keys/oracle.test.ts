import { describe, expect, it } from "vitest";
import { LEVEL_IDS, type LevelId } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { createRun, validateLevelSolvability } from "./rules";

describe("haunted-mansion-keys smoke", () => {
   it("builds every level deterministically and verifies solvability", () => {
      for (const id of LEVEL_IDS) {
         for (let seed = 0; seed < 5; seed++) {
            const run = createRun(seed, LEVELS[id as LevelId]);
            expect(validateLevelSolvability(run)).toBe(true);
            expect(run.keys).toHaveLength(LEVELS[id as LevelId].keys);
         }
      }
   });
});
