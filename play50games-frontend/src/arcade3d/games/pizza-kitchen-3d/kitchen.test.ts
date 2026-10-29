// Each level is its own room (levels.ts `theme`, looks.ts KITCHENS, Decor.tsx). Visual only: props sit
// on the back wall, over the ovens or past the ends of the line, never in the cook's strip.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { DINING_GAP, WALL_FACE, diningTables } from "./Decor";
import { LEVELS } from "./levels";
import { KITCHENS } from "./looks";
import { TUNING, kitchenHalf } from "./rules";

describe("pizza kitchen rooms", () => {
   it("five rooms with their own floor, wall and props; level 1 keeps today's kitchen", () => {
      const themes = LEVEL_IDS.map((id) => LEVELS[id].theme);
      expect(new Set(themes).size).toBe(5);
      expect(KITCHENS[LEVELS[1].theme].decor).toBe("none");
      expect(new Set(themes.map((t) => KITCHENS[t].decor)).size).toBe(5);
      expect(new Set(themes.map((t) => KITCHENS[t].wall)).size).toBe(5);
      expect(new Set(themes.map((t) => `${KITCHENS[t].tile}${KITCHENS[t].tileAlt}`)).size).toBe(5);
   });

   it("wall props stay on the wall, behind the counters", () => {
      expect(WALL_FACE).toBeLessThan(TUNING.counterZ - 0.45);
      expect(WALL_FACE).toBeLessThan(TUNING.minZ);
   });

   it("the Restaurant Rush dining room stands past both ends of the line", () => {
      const half = kitchenHalf(LEVELS[3]);
      for (const t of diningTables(half)) expect(Math.abs(t.x) - 0.75 - 0.21).toBeGreaterThanOrEqual(half + DINING_GAP - 1e-9);
   });
});
