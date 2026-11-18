import { describe, expect, it } from "vitest";
import {
   ALL_STARS,
   STAR_BIT,
   evaluateStars,
   goalMet,
   goalText,
   mergeStarMask,
   newStarMask,
   starCount,
   starLabels,
   starSpecProblems,
   type StarSpec,
} from "./stars";

const TIME: StarSpec = { orbTotal: 18, goal: { kind: "time", targetMs: 20000 } };

describe("evaluateStars", () => {
   it("three stars and the badge for a perfect run", () => {
      const r = evaluateStars(TIME, { cleared: true, orbs: 18, goalValue: 19999, hits: 0 });
      expect(r).toEqual({ clear: true, allOrbs: true, goal: true, noHit: true, mask: ALL_STARS, stars: 3 });
   });

   it("each star on its own", () => {
      expect(evaluateStars(TIME, { cleared: true, orbs: 17, goalValue: 25000, hits: 2 })).toMatchObject({ stars: 1, mask: STAR_BIT.clear, noHit: false });
      expect(evaluateStars(TIME, { cleared: true, orbs: 18, goalValue: 25000, hits: 1 }).mask).toBe(STAR_BIT.clear | STAR_BIT.orbs);
      expect(evaluateStars(TIME, { cleared: true, orbs: 0, goalValue: 20000, hits: 0 }).mask).toBe(STAR_BIT.clear | STAR_BIT.goal);
   });

   it("nothing without a clear", () => {
      expect(evaluateStars(TIME, { cleared: false, orbs: 18, goalValue: 1, hits: 0 })).toMatchObject({ stars: 0, mask: 0, noHit: false });
   });

   it("game goals: knock-offs at least, HP lost at most; NaN never passes", () => {
      expect(goalMet({ kind: "atLeast", target: 10, label: "Knock-offs" }, 10)).toBe(true);
      expect(goalMet({ kind: "atLeast", target: 10, label: "Knock-offs" }, 9)).toBe(false);
      expect(goalMet({ kind: "atMost", target: 2, label: "HP lost" }, 2)).toBe(true);
      expect(goalMet({ kind: "atMost", target: 2, label: "HP lost" }, 3)).toBe(false);
      expect(goalMet({ kind: "time", targetMs: 1 }, Number.NaN)).toBe(false);
   });

   it("a level with no orbs gives the orb star on a clear", () => {
      expect(evaluateStars({ orbTotal: 0, goal: TIME.goal }, { cleared: true, orbs: 0, goalValue: 99999, hits: 3 }).allOrbs).toBe(true);
   });
});

describe("masks", () => {
   it("count, merge (union) and new stars", () => {
      expect([0, 1, 3, 5, 7].map(starCount)).toEqual([0, 1, 2, 2, 3]);
      expect(mergeStarMask(STAR_BIT.clear | STAR_BIT.orbs, STAR_BIT.clear | STAR_BIT.goal)).toBe(ALL_STARS);
      expect(newStarMask(STAR_BIT.clear | STAR_BIT.orbs, ALL_STARS)).toBe(STAR_BIT.goal);
      expect(mergeStarMask(0, 0xff)).toBe(ALL_STARS);
   });
});

describe("labels and validation", () => {
   it("readable labels", () => {
      expect(starLabels(TIME)).toEqual(["Clear the level", "All 18 orbs", "Finish in 20 s"]);
      expect(goalText({ kind: "time", targetMs: 20500 })).toBe("Finish in 20.5 s");
      expect(goalText({ kind: "atLeast", target: 12, label: "Knock-offs" })).toBe("Knock-offs 12+");
      expect(goalText({ kind: "atMost", target: 0, label: "HP lost" })).toBe("HP lost 0 or less");
   });

   it("flags bad specs", () => {
      expect(starSpecProblems(TIME)).toEqual([]);
      expect(starSpecProblems({ orbTotal: -1, goal: { kind: "time", targetMs: 0 } })).toHaveLength(2);
      expect(starSpecProblems({ orbTotal: 1, goal: { kind: "atLeast", target: 3, label: "" } })).toHaveLength(1);
   });
});
