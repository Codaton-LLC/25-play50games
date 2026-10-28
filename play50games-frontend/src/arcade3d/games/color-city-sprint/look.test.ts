import { describe, expect, it } from "vitest";
import { isNightLevel, levelEnvironment } from "./look";
import definition from "./index";

describe("look", () => {
   it("levels 4 and 5 are night, the others stay on the day preset", () => {
      expect(isNightLevel(1)).toBe(false);
      expect(isNightLevel(4)).toBe(true);
      expect(isNightLevel(5)).toBe(true);
      expect(levelEnvironment(4)?.lighting).toBe("night");
      expect(definition.levels?.[3].environment?.lighting).toBe("night");
      expect(definition.levels?.[0].environment).toBeUndefined();
   });
});
