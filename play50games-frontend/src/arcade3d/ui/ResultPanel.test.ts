import { describe, expect, it } from "vitest";
import type { ScoringRules } from "../types";
import { formatScore } from "../core/format";
import { resultBestText, resultScoreText } from "./ResultPanel";

const TIME: ScoringRules = {
   kind: "time",
   maxScore: 30000,
   minDurationMs: 15000,
   maxDurationMs: 300000,
   base: 0,
   maxPointsPerSec: 0,
   timeBaseMs: 300000,
   unitLabel: "time",
   display: "time",
};

const POINTS: ScoringRules = {
   kind: "points",
   maxScore: 5000,
   minDurationMs: 3000,
   maxDurationMs: 75000,
   base: 600,
   maxPointsPerSec: 120,
   unitLabel: "pts",
   display: "int",
};

describe("result panel text", () => {
   it("shows Not ranked and No best yet for an unranked time run with no best", () => {
      expect(formatScore(0, TIME, 300000)).toBe("5:00.00");
      expect(formatScore(0, TIME, null)).toBe("0 time");
      expect(resultScoreText(0, TIME, 300000, "unranked")).toBe("Not ranked");
      expect(resultBestText(0, TIME, 300000, null, false)).toBe("No best yet");
   });

   it("keeps an existing best on an unranked time run and does not show this run's clock", () => {
      expect(resultScoreText(0, TIME, 300000, "unranked")).toBe("Not ranked");
      expect(resultBestText(21000, TIME, 300000, 90000, false)).toBe("Best 1:30.00");
   });

   it("shows the finish time for a ranked time win, including a first best", () => {
      expect(resultScoreText(21000, TIME, 90000, "login-required")).toBe("1:30.00");
      expect(resultBestText(21000, TIME, 90000, 90000, true)).toBe("Best 1:30.00");
      expect(resultScoreText(18000, TIME, 120000, "synced")).toBe("2:00.00");
      expect(resultBestText(21000, TIME, 120000, 90000, false)).toBe("Best 1:30.00");
   });

   it("leaves points games on the number, with or without a best", () => {
      expect(resultScoreText(0, POINTS, 75000, "unranked")).toBe("0 pts");
      expect(resultBestText(0, POINTS, 75000, null, false)).toBe("Best 0 pts");
      expect(resultScoreText(1250, POINTS, 40000, "saved-local")).toBe("1,250 pts");
      expect(resultBestText(1600, POINTS, 40000, null, false)).toBe("Best 1,600 pts");
      expect(resultBestText(1250, POINTS, 40000, null, true)).toBe("Best 1,250 pts");
   });
});
