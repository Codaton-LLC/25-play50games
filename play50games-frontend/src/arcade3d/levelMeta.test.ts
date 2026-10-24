import { describe, expect, it } from "vitest";
import { robotCollectorMeta } from "./games/robot-collector/meta";
import { obstacleRaceMeta } from "./games/obstacle-race/meta";
import { isLevelId, levelCount, levelMetaProblems, levelsOf, maxTotal, scoringFor } from "./levelMeta";
import { serverSyncProblems } from "./levelSync";
import { withLevels } from "./core/testing/levelFixtures";
import type { ArcadeGameMeta, ScoringRules } from "./types";

const FIVE = withLevels(robotCollectorMeta);

const wire = (s: ScoringRules): Record<string, unknown> =>
   s.kind === "points"
      ? { max_score: s.maxScore, min_duration_ms: s.minDurationMs, max_duration_ms: s.maxDurationMs, base: s.base, max_pps: s.maxPointsPerSec }
      : { max_score: s.maxScore, min_duration_ms: s.minDurationMs, max_duration_ms: s.maxDurationMs, time_base_ms: s.timeBaseMs };

const serverEntry = (meta: ArcadeGameMeta, withLevelsKey = !!meta.levels): Record<string, unknown> & { levels?: Record<string, unknown>[] } => ({
   title: meta.title,
   kind: meta.scoring.kind,
   ...wire(meta.scoring),
   enabled: true,
   ...(withLevelsKey ? { levels: levelsOf(meta).map((l) => ({ title: l.title, ...wire(l.scoring) })) } : {}),
});

describe("level meta helpers", () => {
   it("a game without levels is one level made from meta.scoring", () => {
      expect(levelsOf(robotCollectorMeta)).toEqual([{ id: 1, title: "Robot Collector", scoring: robotCollectorMeta.scoring }]);
      expect(levelCount(robotCollectorMeta)).toBe(1);
      expect(isLevelId(robotCollectorMeta, 1)).toBe(true);
      expect(isLevelId(robotCollectorMeta, 2)).toBe(false);
      expect(scoringFor(robotCollectorMeta, 1)).toBe(robotCollectorMeta.scoring);
      expect(() => scoringFor(robotCollectorMeta, 3)).toThrow();
      expect(maxTotal(robotCollectorMeta)).toBe(1470);
      expect(levelMetaProblems(robotCollectorMeta)).toEqual([]);
   });

   it("a five-level game has ids 1..5, per-level scoring and a summed maximum", () => {
      expect(levelCount(FIVE)).toBe(5);
      expect(levelsOf(FIVE).map((l) => l.id)).toEqual([1, 2, 3, 4, 5]);
      expect(isLevelId(FIVE, 5)).toBe(true);
      expect(isLevelId(FIVE, 6)).toBe(false);
      expect(isLevelId(FIVE, "2")).toBe(false);
      expect(scoringFor(FIVE, 3).maxScore).toBe(1670);
      expect(maxTotal(FIVE)).toBe(1470 * 5 + 100 * (1 + 2 + 3 + 4));
      expect(levelMetaProblems(FIVE)).toEqual([]);
      expect(levelMetaProblems(withLevels(obstacleRaceMeta))).toEqual([]);
   });

   it("reports broken level lists", () => {
      const levels = FIVE.levels!;
      expect(levelMetaProblems({ ...FIVE, levels: levels.slice(0, 4) })).toContain("needs exactly 5 levels, has 4");
      expect(levelMetaProblems({ ...FIVE, levels: [levels[1], levels[0], ...levels.slice(2)] }).join()).toContain("level 1: id 2");
      expect(levelMetaProblems({ ...FIVE, levels: [{ ...levels[0], scoring: { ...levels[0].scoring, maxScore: 1 } }, ...levels.slice(1)] })).toContain(
         "level 1 scoring must equal meta.scoring"
      );
      expect(levelMetaProblems({ ...FIVE, levels: [...levels.slice(0, 4), { ...levels[4], scoring: { ...levels[4].scoring, kind: "time" } }] }).join()).toContain(
         "level 5: kind time"
      );
      expect(levelMetaProblems({ ...FIVE, levels: [...levels.slice(0, 3), { ...levels[3], clearScore: 99999 }, levels[4]] }).join()).toContain(
         "level 4: clearScore 99999"
      );
   });
});

describe("registry sync with levels (arcade-games.json v4)", () => {
   it("a game without levels must have no `levels` key on the server", () => {
      expect(serverSyncProblems(robotCollectorMeta, serverEntry(robotCollectorMeta))).toEqual([]);
      expect(serverSyncProblems(robotCollectorMeta, serverEntry(FIVE))).toContain("the server has `levels`, meta.ts has none");
   });

   it("a five-level game matches level by level, and levels[0] the top level", () => {
      expect(serverSyncProblems(FIVE, serverEntry(FIVE))).toEqual([]);
      expect(serverSyncProblems(withLevels(obstacleRaceMeta), serverEntry(withLevels(obstacleRaceMeta)))).toEqual([]);
   });

   it("catches a missing levels array, a short one and a wrong level limit", () => {
      expect(serverSyncProblems(FIVE, serverEntry(FIVE, false)).join()).toContain("levels: server has none");
      const short = serverEntry(FIVE);
      short.levels = short.levels!.slice(0, 4);
      expect(serverSyncProblems(FIVE, short).join()).toContain("levels: server has 4");
      const wrong = serverEntry(FIVE);
      wrong.levels![2] = { ...wrong.levels![2], max_pps: 999 };
      expect(serverSyncProblems(FIVE, wrong)).toEqual(["level 3 max_pps: server 999, client 120"]);
      const top = serverEntry(FIVE);
      top.levels![0] = { ...top.levels![0], max_score: 5 };
      expect(serverSyncProblems(FIVE, top).join()).toContain("levels[0] vs top level max_score");
   });
});
