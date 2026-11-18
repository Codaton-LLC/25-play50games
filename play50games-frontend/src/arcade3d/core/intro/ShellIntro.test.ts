import { describe, expect, it } from "vitest";
import { introLevelName } from "./ShellIntro";
import type { ScoringRules } from "../../types";

const RULES: ScoringRules = { kind: "points", maxScore: 1, minDurationMs: 1, maxDurationMs: 2, base: 0, maxPointsPerSec: 1, unitLabel: "pts", display: "int" };

describe("introLevelName", () => {
   it("names the picked level from meta.levels", () => {
      const levels = [1, 2, 3, 4, 5].map((id) => ({ id: id as 1 | 2 | 3 | 4 | 5, title: `T${id}`, scoring: RULES }));
      expect(introLevelName({ levels }, 1)).toBe("Level 1 — T1");
      expect(introLevelName({ levels }, 4)).toBe("Level 4 — T4");
   });

   it("is empty for a game without levels", () => {
      expect(introLevelName({}, 1)).toBe("");
   });
});
