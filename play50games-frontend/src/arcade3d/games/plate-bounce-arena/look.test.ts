// Each table has its own light (the world's arc), and the shell's environment reads the same table.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVEL_LOOK, chase, levelEnvironment } from "./look";

describe("a light per table", () => {
   it("warm hall, garden, ice, neon night, Rollo's stage", () => {
      expect(new Set(LEVEL_IDS.map((id) => LEVEL_LOOK[id].background)).size).toBe(5);
      for (const id of LEVEL_IDS) expect(definition.levels![id - 1].environment).toEqual(levelEnvironment(id));
      expect(LEVEL_LOOK[1].lighting).toBe("indoor");
      expect(LEVEL_LOOK[3].lighting).toBe("snow");
      expect(LEVEL_LOOK[4].lighting).toBe("night");
   });

   it("the chase lights stay in 0..1 and run faster with the combo", () => {
      let lit1 = 0;
      let lit5 = 0;
      let prev1 = 0;
      let prev5 = 0;
      for (let t = 0; t < 10; t += 0.01) {
         const a = chase(0, 8, t, 1);
         const b = chase(0, 8, t, 5);
         expect(a).toBeGreaterThanOrEqual(0);
         expect(a).toBeLessThanOrEqual(1);
         if (a > 0 && prev1 === 0) lit1++;
         if (b > 0 && prev5 === 0) lit5++;
         prev1 = a;
         prev5 = b;
      }
      expect(lit5).toBeGreaterThan(lit1);
   });
});
