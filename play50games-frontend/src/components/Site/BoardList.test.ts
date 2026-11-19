// The leaderboard's spoken status (BoardList boardStatusText), read on /leaderboards as boards change.
import { describe, expect, it } from "vitest";
import { boardStatusText } from "./BoardList";

describe("boardStatusText", () => {
   const base = { loading: false, error: null, rows: 0, me: false };
   it("says loading, failed, empty and ready", () => {
      expect(boardStatusText("Robot Collector", { ...base, loading: true })).toBe("Loading the Robot Collector leaderboard.");
      expect(boardStatusText("Robot Collector", { ...base, error: "x" })).toBe("The Robot Collector leaderboard did not load.");
      expect(boardStatusText("Robot Collector", base)).toBe("Robot Collector: no scores yet.");
      expect(boardStatusText("Robot Collector", { ...base, rows: 1 })).toBe("Robot Collector leaderboard, 1 row.");
      expect(boardStatusText("Robot Collector", { ...base, rows: 20 })).toBe("Robot Collector leaderboard, 20 rows.");
   });
});
