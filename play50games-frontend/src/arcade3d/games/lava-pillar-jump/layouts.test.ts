// Lava Pillar Jump plays its own courses: a long S-shaped sweep of uneven basalt pillars across the cavern,
// with lava that starts just under the start shelf and climbs faster every level. Not a reskin of Rooftop
// Roll Climb (whose rows zigzag a metre or two either side of a line).
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { PROPOSED_LEVEL_LIMITS as ROOFTOP_LIMITS, courseFor as rooftopCourse } from "../rooftop-roll-climb/rules";
import { LEVELS } from "./levels";
import { pillarXZ } from "./pillars";
import { H_JUMP, PROPOSED_LEVEL_LIMITS, SURGE, courseFor, createRun, lavaBase, lavaY } from "./rules";

describe("the sweep", () => {
   it("the route swings wide across the cavern in long arcs, not a zigzag round a line", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         // the route (level 5's arena ring round the golem is not part of the sweep)
         const xs = c.supports.slice(0, c.route).map((s) => s.cx);
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
         const c = courseFor(id);
         const s = c.supports.slice(0, c.route);
         // the plain rises (a vent climb is taller on purpose)
         const rises = s.slice(1).map((p, i) => (s[i].vent?.lift ? 0 : p.top - s[i].top)).filter((r) => r > 0);
         expect(Math.max(...rises) - Math.min(...rises), `L${id} rises`).toBeGreaterThan(0.4);
         expect(Math.max(...rises)).toBeLessThan(2.6);
         const widths = s.filter((p) => p.kind === "roof").map((p) => p.hw);
         expect(Math.max(...widths) - Math.min(...widths), `L${id} widths`).toBeGreaterThan(0.2);
      }
   });

   it("is its own game: its courses differ from Rooftop Roll Climb's on every level, and only this cavern has a heartbeat, vents and hot tops", () => {
      for (const id of LEVEL_IDS) {
         const a = courseFor(id).supports.map((s) => s.cx);
         const b = rooftopCourse(id).supports.map((s) => s.cx);
         expect(a.join()).not.toBe(b.join());
         const c = courseFor(id);
         expect(c.beatMs).toBeGreaterThan(0);
         expect(c.supports.some((s) => s.vent)).toBe(true);
         expect(c.supports.some((s) => s.heat)).toBe(true);
         expect("beatMs" in rooftopCourse(id)).toBe(false);
      }
      // the limits are this cavern's own: no level row equals Rooftop's
      const same = LEVEL_IDS.filter((id) => JSON.stringify(PROPOSED_LEVEL_LIMITS[id]) === JSON.stringify(ROOFTOP_LIMITS[id]));
      expect(same.length).toBeLessThanOrEqual(1);
   });

   it("the threat comes from below and from the feet: a vent climb no jump makes on every level, and level 5 ends in a ring round the boss (not a gate)", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         const lift = c.supports.findIndex((s, i) => i < c.route - 1 && s.vent?.lift);
         expect(lift, `L${id}`).toBeGreaterThan(0);
         expect(c.supports[lift + 1].top - c.supports[lift].top).toBeGreaterThan(H_JUMP);
      }
      const a = courseFor(5).arena!;
      expect(a.ring).toHaveLength(6);
      for (const k of a.ring) expect(Math.hypot(courseFor(5).supports[k].cx - a.cx, courseFor(5).supports[k].cz - a.cz)).toBeCloseTo(a.radius, 1);
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
      expect(courseFor(5).lavaRate).toBeGreaterThanOrEqual(0.6);
      const run = createRun(1, 5);
      expect(lavaBase(run.course, 10_000)).toBeCloseTo(-4.5 + run.course.lavaRate * 10, 9);
      // the surge rides on the tide: never below it, at most SURGE.height over it
      for (let ms = 0; ms < 30_000; ms += 37) {
         const d = lavaY(run.course, ms) - lavaBase(run.course, ms);
         expect(d).toBeGreaterThanOrEqual(0);
         expect(d).toBeLessThanOrEqual(SURGE.height + 1e-9);
      }
   });
});
