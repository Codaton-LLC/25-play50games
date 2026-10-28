import { describe, expect, it } from "vitest";
import definition from "./index";
import { COLORS, isDuskLevel, levelEnvironment } from "./look";
import { FOG } from "./World";

describe("dusk on the long gaps", () => {
   it("levels 4 and 5 change the sky; 1 to 3 stay on the day", () => {
      expect(definition.environment).toMatchObject({ background: COLORS.background, fog: [FOG.color, FOG.near, FOG.far], lighting: "day" });
      for (const id of [1, 2, 3]) {
         expect(isDuskLevel(id)).toBe(false);
         expect(levelEnvironment(id)).toBeNull();
         expect(definition.levels![id - 1].environment).toBeUndefined();
      }
      for (const id of [4, 5] as const) {
         expect(levelEnvironment(id)).not.toBeNull();
         expect(definition.levels![id - 1].environment).toEqual(levelEnvironment(id));
      }
   });
});
