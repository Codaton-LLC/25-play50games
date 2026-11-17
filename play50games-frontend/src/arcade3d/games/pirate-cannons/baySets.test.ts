// Each level's bay (looks.ts BAY_THEMES, BaySets.tsx): background ships stay behind the play sea
// (beyond the far lane, out of every lane's line), the storm is level 4's, the flagship level 5's,
// level 1 is today's sunny bay, and the five bays differ in light, sky and sea.
import { describe, expect, it, vi } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { levelEnvironment } from "@/arcade3d/core/levels";
import { BACKGROUND_SHIPS } from "./BaySets";
import definition from "./index";
import { BAY_THEMES, COLORS } from "./looks";
import { LANES } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

describe("pirate-cannons level bays", () => {
   it("background ships stay well behind the far lane", () => {
      const far = Math.min(...LANES);
      for (const set of Object.values(BACKGROUND_SHIPS)) for (const s of set) expect(s.z, `ship at (${s.x}, ${s.z})`).toBeLessThan(far - 15 - 3 * s.scale);
   });

   it("the five bays differ; the storm is level 4, the flagship level 5, level 1 is today's", () => {
      expect(BAY_THEMES[1]).toMatchObject({ skyTop: COLORS.skyTop, sky: COLORS.sky, sea: COLORS.sea, amplitude: 0.16, ships: "none", rain: false });
      expect(levelEnvironment(definition, 1)).toEqual(definition.environment);
      expect(new Set(LEVEL_IDS.map((id) => BAY_THEMES[id].sky)).size).toBe(5);
      expect(new Set(LEVEL_IDS.map((id) => BAY_THEMES[id].ships)).size).toBeGreaterThanOrEqual(4);
      expect(BAY_THEMES[4].rain && BAY_THEMES[4].lightning).toBe(true);
      expect(BAY_THEMES[5].ships).toBe("flagship");
      for (const id of LEVEL_IDS.slice(1)) expect(levelEnvironment(definition, id)!.lighting).toBe(BAY_THEMES[id].lighting);
   });
});
