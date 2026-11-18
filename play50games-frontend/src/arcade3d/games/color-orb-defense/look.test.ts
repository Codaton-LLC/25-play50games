// Each level has its own light (the card's arc), and the shell's environment reads the same table.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import definition from "./index";
import { LEVEL_LOOK, levelEnvironment } from "./look";

describe("a light per level", () => {
   it("clear morning, golden afternoon, sunset, stormy dusk, violet night", () => {
      expect(new Set(LEVEL_IDS.map((id) => LEVEL_LOOK[id].background)).size).toBe(5);
      for (const id of LEVEL_IDS) expect(definition.levels![id - 1].environment).toEqual(levelEnvironment(id));
      expect(LEVEL_LOOK[1].lighting).toBe("day");
      expect(LEVEL_LOOK[3].lighting).toBe("sunset");
      expect(LEVEL_LOOK[4].lighting).toBe("night");
      expect(LEVEL_LOOK[5].lighting).toBe("night");
   });
});
