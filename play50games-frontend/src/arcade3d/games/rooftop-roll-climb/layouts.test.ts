// Rooftop Roll Climb plays its own courses: a zigzag of city blocks, each a fire-escape climb up to a
// slanted tin roof that you roll down to bank speed for the leap across the street. Not a reskin of
// Lava Pillar Jump (a sweep of pillars over a rising tide) or Sky Tower Jump (a vertical tower of islands).
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { courseFor as lavaCourse, PROPOSED_LEVEL_LIMITS as LAVA_LIMITS } from "../lava-pillar-jump/rules";
import { courseFor as skyCourse } from "../sky-tower-jump/rules";
import { LEVELS } from "./levels";
import { PROPOSED_LEVEL_LIMITS, courseFor } from "./rules";

describe("the zigzag skyline", () => {
   it("switches back block by block: the route runs out along +x, back along -x, and climbs every block", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const decks = c.supports.filter((s) => s.role === "deck");
         expect(decks.length, `L${id}`).toBe(LEVELS[id].spec.blocks);
         for (let i = 1; i < decks.length; i++) expect(decks[i].top, `L${id} deck ${i}`).toBeGreaterThan(decks[i - 1].top);
         const slopes = c.supports.filter((s) => s.slope && !s.keep && !s.arena);
         for (let i = 1; i < slopes.length; i++) expect(slopes[i].slope!.dir).toBe(-slopes[i - 1].slope!.dir);
         // the whole skyline climbs away from the camera (-z)
         expect(c.supports[c.goal].cz).toBeLessThan(-20);
      }
   });

   it("is its own game: only this one has slanted roofs, and its courses and limits differ from the pillar and tower games", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(c.supports.filter((s) => s.slope).length, `L${id}`).toBeGreaterThanOrEqual(LEVELS[id].spec.blocks);
         expect(lavaCourse(id).supports.some((s) => "slope" in s && (s as { slope: unknown }).slope)).toBe(false);
         expect(skyCourse(id).supports.some((s) => "slope" in s && (s as { slope: unknown }).slope)).toBe(false);
         const a = c.supports.map((s) => s.cx).join();
         expect(a).not.toBe(lavaCourse(id).supports.map((s) => s.cx).join());
         expect(a).not.toBe(skyCourse(id).supports.map((s) => s.cx).join());
         expect(JSON.stringify(PROPOSED_LEVEL_LIMITS[id])).not.toBe(JSON.stringify(LAVA_LIMITS[id]));
      }
   });

   it("level 1 ends on two chained slopes (land curled, keep the roll) and level 5 on Ashback's half-pipe arena", () => {
      const c1 = courseFor(1);
      expect(c1.supports[c1.goal - 1].keep).toBe(true);
      expect(c1.supports[c1.goal - 2].slope).not.toBeNull();
      const a = courseFor(5).arena!;
      const s = courseFor(5).supports;
      expect(s[a.rampA].slope!.dir).toBe(-s[a.rampB].slope!.dir);
      expect(s[a.pad].top).toBeLessThan(s[a.entry].top);
      expect(s[a.far].top).toBe(s[a.entry].top);
   });
});
