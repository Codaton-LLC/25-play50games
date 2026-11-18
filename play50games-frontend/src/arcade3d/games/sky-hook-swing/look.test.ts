// Each level has its own sky and light; the shell's environment comes from the same table.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVEL_LOOK, levelEnvironment, lightningFlash } from "./look";

describe("a sky per level", () => {
   it("five different skies, the shell gets each level's own fog and lighting preset", () => {
      expect(new Set(LEVEL_IDS.map((id) => LEVEL_LOOK[id].skyTop)).size).toBe(5);
      expect(definition.environment).toEqual(levelEnvironment(1));
      for (const id of LEVEL_IDS) expect(definition.levels![id - 1].environment).toEqual(levelEnvironment(id));
      expect(LEVEL_LOOK[4].lighting).toBe("sunset");
      expect(LEVEL_LOOK[5].lighting).toBe("night");
   });

   it("only the storm level flashes, and the flash stays in 0..1", () => {
      for (const id of LEVEL_IDS) expect(LEVEL_LOOK[id].lightning).toBe(id === 5);
      for (let t = 0; t < 30; t += 0.013) {
         const f = lightningFlash(t);
         expect(f).toBeGreaterThanOrEqual(0);
         expect(f).toBeLessThanOrEqual(1);
      }
   });
});
