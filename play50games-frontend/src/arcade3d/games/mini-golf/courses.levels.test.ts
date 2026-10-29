// Each level's own course (levels.ts `course`, course.ts specs 9-14) re-proves its limits from its
// own holes (README "Server limits ... one proof per level"): the ceiling from the pars, the earliest
// end from each hole's tee-to-cup distance at the 6 m/s clamp (or its pick-up gaps, whichever is
// sooner) plus the 2 s hole-outs. Level 1 and level 5 keep their courses.
import { describe, expect, it, vi } from "vitest";
import { LEVEL_IDS } from "../../types";
import { SPEC_PARS, buildHole, courseSpecs, generateCourse } from "./course";
import { LEVELS } from "./levels";
import { COURSE_LOOKS, feltRects, onFelt } from "./looks";
import { BALL } from "./physics";
import { PROPOSED_LEVEL_LIMITS, TICK } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

/** The analytic earliest end of a level's course (s), README's per-hole bound. */
function earliestEnd(id: (typeof LEVEL_IDS)[number]): number {
   const level = LEVELS[id];
   let total = (level.holes - 1) * TICK.holeOut;
   for (const spec of courseSpecs(level.holes, level.course)) {
      const hole = buildHole(spec, false);
      const free = hole.turntable ? 2 * (hole.turntable.half + BALL.radius) : 0;
      const capture = (Math.hypot(hole.tee.x - hole.cup.x, hole.tee.z - hole.cup.z) - level.cupRadius - free) / BALL.vCap;
      const wet = hole.ponds.length > 0 || hole.terrain === "ramp";
      const strokes = hole.par + level.pickUpOver;
      const pickup = wet ? (Math.ceil(strokes / 2) - 1) * TICK.ready : (strokes - 1) * TICK.ready;
      total += Math.min(capture, pickup);
   }
   return total;
}

describe("mini-golf level courses", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: the ceiling and the earliest end of its own course fit its limits`, () => {
         const level = LEVELS[id];
         const specs = courseSpecs(level.holes, level.course);
         const ceiling = specs.reduce((s, k) => s + 100 * (SPEC_PARS[k] + 2) + 200, 0);
         const limits = PROPOSED_LEVEL_LIMITS[id];
         expect(ceiling).toBeLessThanOrEqual(limits.maxScore);
         expect(ceiling).toBe(limits.maxScore);
         const end = earliestEnd(id);
         expect(end * 1000, `earliest end ${end.toFixed(3)} s`).toBeGreaterThanOrEqual(limits.minDurationMs);
         // the line: every final score fits base + pps * minDuration
         expect(limits.base + limits.maxPointsPerSec * (limits.minDurationMs / 1000)).toBeGreaterThanOrEqual(limits.maxScore);
      });
   }

   it("level 1 and level 5 keep their courses; levels 2-4 each play their own new layouts", () => {
      for (let seed = 0; seed < 16; seed++) expect(generateCourse(seed, 6, LEVELS[1].course)).toEqual(generateCourse(seed));
      expect(LEVELS[1].course).toBeUndefined();
      expect(LEVELS[5].course).toBeUndefined();
      const names = ([2, 3, 4] as const).map((id) => courseSpecs(6, LEVELS[id].course).map((k) => buildHole(k, false).name));
      expect(names[0].filter((n) => n.startsWith("Ramp")).length).toBeGreaterThanOrEqual(3);
      expect(names[1].filter((n) => n.startsWith("Windmill")).length).toBeGreaterThanOrEqual(3);
      expect(names[2].filter((n) => n.startsWith("Neon")).length).toBeGreaterThanOrEqual(2);
      // every new layout: tee and cup on its felt, on both mirrors, with its own look per level
      for (let k = 9; k < 15; k++) for (const m of [false, true]) {
         const hole = buildHole(k, m);
         const rects = feltRects(hole);
         expect(onFelt(rects, hole.tee.x, hole.tee.z), `${hole.name} tee`).toBe(true);
         expect(onFelt(rects, hole.cup.x, hole.cup.z), `${hole.name} cup`).toBe(true);
      }
      expect(new Set(LEVEL_IDS.map((id) => COURSE_LOOKS[id].railMid)).size).toBe(5);
      expect(COURSE_LOOKS[4].railGlow).not.toBeNull();
   });
});
