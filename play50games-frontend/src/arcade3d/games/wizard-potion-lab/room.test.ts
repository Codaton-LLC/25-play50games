// Each level is its own room (levels.ts `theme`, looks.ts LAB_THEMES, Room.tsx). Visual only: the
// props stand beyond the wall ring or flat on the floor, so the walk, the shelves and the proof are
// unchanged.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { LAB_THEMES } from "./looks";
import { ringProps } from "./Room";
import { createRun } from "./rules";

describe("wizard potion lab rooms", () => {
   it("five rooms, each with its own props, floor and glow; level 1 keeps today's look", () => {
      const themes = LEVEL_IDS.map((id) => LEVELS[id].theme);
      expect(new Set(themes).size).toBe(5);
      expect(LEVELS[1].theme).toBe("beginner");
      expect(LAB_THEMES.beginner.props).toBe("none");
      expect(new Set(themes.map((t) => LAB_THEMES[t].props)).size).toBe(5);
      expect(new Set(themes.map((t) => LAB_THEMES[t].glow)).size).toBe(5);
      expect(new Set(themes.map((t) => LAB_THEMES[t].floorGlow)).size).toBe(5);
      expect(LAB_THEMES[LEVELS[2].theme].props).toBe("mushrooms");
      expect(LAB_THEMES[LEVELS[3].theme].props).toBe("crystals");
      expect(LAB_THEMES[LEVELS[4].theme].props).toBe("forest");
   });

   it("big props stand beyond the wall ring, never in the walk", () => {
      for (const id of LEVEL_IDS) {
         const r = LEVELS[id].radius;
         for (const s of ringProps(r, 16, 1.4, 1.8)) expect(Math.hypot(s.x, s.z)).toBeGreaterThanOrEqual(r + 1.4 - 1e-9);
      }
   });

   it("the sliding ingredient has a rail on every wander level (one shelf)", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(5, LEVELS[id]);
         expect(run.shelves.filter((s) => s.wander)).toHaveLength(LEVELS[id].wander ? 1 : 0);
      }
   });
});
