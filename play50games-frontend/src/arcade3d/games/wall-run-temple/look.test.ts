// Each level has its own sky and light (the world's arc), and the shell's environment reads the same table.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVEL_LOOK, levelEnvironment, lightningFlash } from "./look";

describe("a sky per level", () => {
   it("misty morning, green noon, golden hour, blue night with torches, the storm", () => {
      expect(new Set(LEVEL_IDS.map((id) => LEVEL_LOOK[id].skyTop)).size).toBe(5);
      for (const id of LEVEL_IDS) expect(definition.levels![id - 1].environment).toEqual(levelEnvironment(id));
      expect(LEVEL_LOOK[3].lighting).toBe("sunset");
      expect(LEVEL_LOOK[4].lighting).toBe("night");
      expect(LEVEL_LOOK[4].torches).toBe(true);
      for (const id of LEVEL_IDS) expect(LEVEL_LOOK[id].lightning).toBe(id === 5);
      for (let t = 0; t < 30; t += 0.013) {
         expect(lightningFlash(t)).toBeGreaterThanOrEqual(0);
         expect(lightningFlash(t)).toBeLessThanOrEqual(1);
      }
   });
});
