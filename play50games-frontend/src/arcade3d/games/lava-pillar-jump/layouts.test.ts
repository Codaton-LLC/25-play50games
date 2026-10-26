// Lava Pillar Jump plays its own courses: a long S-shaped sweep of uneven basalt pillars across the cavern,
// with lava that starts just under the start shelf and climbs faster every level. Not a reskin of Rooftop
// Roll Climb (whose rows zigzag a metre or two either side of a line).
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { PROPOSED_LEVEL_LIMITS as ROOFTOP_LIMITS, courseFor as rooftopCourse } from "../rooftop-roll-climb/rules";
import { LEVELS } from "./levels";
import { pillarXZ } from "./pillars";
import { PROPOSED_LEVEL_LIMITS, courseFor, createRun, lavaY } from "./rules";

describe("the sweep", () => {
   it("the route swings wide across the cavern in long arcs, not a zigzag round a line", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const xs = c.supports.map((s) => s.cx);
         expect(Math.max(...xs) - Math.min(...xs), `L${id} width`).toBeGreaterThan(7);
         // the sign of the sideways step changes only every few pillars (a zigzag changes every step)
         let flips = 0;
         for (let i = 2; i < xs.length; i++) if (Math.sign(xs[i] - xs[i - 1]) !== Math.sign(xs[i - 1] - xs[i - 2])) flips++;
         expect(flips, `L${id} direction changes`).toBeLessThan(xs.length / 2.5);
         const first = pillarXZ(LEVELS[id].spec, 0);
         expect(Math.abs(first.x) + Math.abs(first.z)).toBe(0);
      }
   });

   it("the basalt is uneven: rises differ in size and pillar tops differ in width, every rise still under the jump's room", () => {
      for (const id of LEVEL_IDS) {
         const s = courseFor(id).supports;
         const rises = s.slice(1).map((p, i) => p.top - s[i].top).filter((r) => r > 0);
         expect(Math.max(...rises) - Math.min(...rises), `L${id} rises`).toBeGreaterThan(0.4);
         expect(Math.max(...rises)).toBeLessThan(2.6);
         const widths = s.filter((p) => p.kind === "roof").map((p) => p.hw);
         expect(Math.max(...widths) - Math.min(...widths), `L${id} widths`).toBeGreaterThan(0.2);
      }
   });

   it("is its own game: its courses and limits differ from Rooftop Roll Climb's on every level but the first", () => {
      for (const id of LEVEL_IDS) {
         const a = courseFor(id).supports.map((s) => s.cx);
         const b = rooftopCourse(id).supports.map((s) => s.cx);
         expect(a.join()).not.toBe(b.join());
      }
      const same = LEVEL_IDS.filter((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]) === JSON.stringify(ROOFTOP_LIMITS[id]));
      expect(same).toEqual([1]);
   });
});

describe("the lava", () => {
   it("starts just under the start shelf and climbs faster every level", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(c.lava0).toBe(-4.5);
         if (id > 1) expect(c.lavaRate).toBeGreaterThan(courseFor((id - 1) as 1 | 2 | 3 | 4).lavaRate);
      }
      expect(courseFor(1).lavaRate).toBeLessThanOrEqual(0.2);
      expect(courseFor(5).lavaRate).toBeGreaterThanOrEqual(0.7);
      const run = createRun(1, 5);
      expect(lavaY(run.course, 10_000)).toBeCloseTo(-4.5 + run.course.lavaRate * 10, 9);
   });
});
