// The store's level actions (levelId, selectLevel, menu) and the pure level rules in levels.ts.
import { beforeEach, describe, expect, it } from "vitest";
import type { StoreApi } from "zustand/vanilla";
import { COUNTDOWN_MS, createArcadeStore, type ArcadeStore } from "./useArcadeStore";
import {
   definitionLevelProblems,
   isLevelCleared,
   levelEnvironment,
   levelInstructions,
   levelRunConfig,
   levelTotals,
   levelsActive,
   resolveActiveLevel,
   type LocalLevels,
} from "./levels";
import type { GameDefinition, LevelSpec } from "./types";
import { robotCollectorMeta } from "../games/robot-collector/meta";
import { obstacleRaceMeta } from "../games/obstacle-race/meta";
import { withLevels } from "./testing/levelFixtures";
import { LEVEL_IDS, type LevelId } from "../types";

let store: StoreApi<ArcadeStore>;
const s = () => store.getState();

function advance(ms: number) {
   for (let left = ms; left > 0; left -= 50) s().tick(Math.min(50, left));
}

beforeEach(() => {
   store = createArcadeStore();
});

describe("store: levelId, selectLevel, menu", () => {
   it("starts at level 1; configure() can pick a level, and keeps the picked one otherwise", () => {
      expect(s().levelId).toBe(1);
      s().configure({ durationMs: 30000 }, 3);
      expect(s()).toMatchObject({ levelId: 3, phase: "loading" });
      s().configure({ durationMs: 30000 });
      expect(s().levelId).toBe(3);
   });

   it("selectLevel in ready sets the level and its run config without going back to loading", () => {
      s().configure({ durationMs: 30000, lives: 3 });
      s().markReady();
      const runId = s().runId;
      s().selectLevel(2, { durationMs: 45000, lives: 2, resultDelayMs: 0 });
      expect(s()).toMatchObject({ phase: "ready", levelId: 2, runId, timeLeftMs: 45000, lives: 2 });
      expect(s().config).toEqual({ durationMs: 45000, lives: 2, resultDelayMs: 0 });
      s().start();
      advance(COUNTDOWN_MS);
      expect(s()).toMatchObject({ phase: "playing", levelId: 2, timeLeftMs: 45000, lives: 2 });
   });

   it("ignores selectLevel while loading, counting down, playing or paused (never mid-run)", () => {
      s().configure({ durationMs: 30000 });
      s().selectLevel(4, { durationMs: 1000 });
      expect(s().levelId).toBe(1);
      s().markReady();
      s().start();
      s().selectLevel(4, { durationMs: 1000 });
      expect(s().levelId).toBe(1);
      advance(COUNTDOWN_MS);
      s().selectLevel(4, { durationMs: 1000 });
      s().pause();
      s().selectLevel(4, { durationMs: 1000 });
      expect(s()).toMatchObject({ levelId: 1, config: { durationMs: 30000 } });
   });

   it("Next level: selectLevel in over keeps the result on screen, restart() plays the new level", () => {
      s().configure({ durationMs: 30000, resultDelayMs: 500 });
      s().markReady();
      s().start();
      advance(COUNTDOWN_MS + 1000);
      s().addScore(700);
      s().end("win");
      advance(600);
      expect(s().overMs).toBe(500);
      s().selectLevel(2, { durationMs: 40000, resultDelayMs: 900 });
      // still over, the panel still counts as shown under the longer delay, the result untouched
      expect(s()).toMatchObject({ phase: "over", levelId: 2, overMs: 900, score: 700, endReason: "win" });
      const runId = s().runId;
      s().restart();
      expect(s()).toMatchObject({ phase: "countdown", levelId: 2, runId: runId + 1, timeLeftMs: 40000, score: 0 });
   });

   it("menu() takes an ended or paused run back to ready with the same runId and level", () => {
      s().configure({ durationMs: 30000, lives: 3 });
      s().markReady();
      s().selectLevel(3, { durationMs: 30000, lives: 3 });
      s().start();
      advance(COUNTDOWN_MS + 500);
      s().loseLife();
      s().pause();
      const runId = s().runId;
      s().menu();
      expect(s()).toMatchObject({ phase: "ready", runId, levelId: 3, lives: 3, pausedFrom: null, endReason: null, elapsedMs: 0 });
      s().start();
      advance(COUNTDOWN_MS);
      s().end("lose");
      s().menu();
      expect(s()).toMatchObject({ phase: "ready", runId: runId + 1, endReason: null, score: 0 });
   });

   it("menu() does nothing in loading, ready, countdown or playing", () => {
      s().configure({});
      s().menu();
      expect(s().phase).toBe("loading");
      s().markReady();
      s().start();
      s().menu();
      expect(s().phase).toBe("countdown");
      advance(COUNTDOWN_MS);
      s().menu();
      expect(s().phase).toBe("playing");
   });

   it("start()/restart() keep the level, reset() sets level 1 again", () => {
      s().configure({});
      s().markReady();
      s().selectLevel(5, {});
      s().start();
      s().restart();
      expect(s().levelId).toBe(5);
      s().reset();
      expect(s().levelId).toBe(1);
   });
});

const FIVE = withLevels(robotCollectorMeta);
const FIVE_TIME = withLevels(obstacleRaceMeta);

const spec = (id: LevelId, over: Partial<LevelSpec<{ n: number }>> = {}): LevelSpec<{ n: number }> => ({
   id,
   description: `Level ${id}`,
   config: { n: id * 10 },
   ...over,
});

const DEFINITION = {
   slug: "robot-collector",
   instructions: ["Collect batteries."],
   durationMs: 60000,
   lives: 3,
   resultDelayMs: 800,
   environment: { background: "#101010", lighting: "day" },
   levels: LEVEL_IDS.map((id) =>
      id === 4 ? spec(id, { durationMs: 50000, lives: 1, environment: { lighting: "night" }, instructions: ["Watch the dark."] }) : spec(id)
   ),
} as unknown as GameDefinition<{ n: number }>;

const PLAIN = { slug: "robot-collector", instructions: ["Go."], durationMs: 60000 } as unknown as GameDefinition;

describe("level rules", () => {
   it("levels are active only with the flag on and five levels in meta.ts", () => {
      expect(levelsActive(FIVE, true)).toBe(true);
      expect(levelsActive(FIVE, false)).toBe(false);
      expect(levelsActive(robotCollectorMeta, true)).toBe(false);
      // the default reads NEXT_PUBLIC_ARCADE_LEVELS, off in tests
      expect(levelsActive(FIVE)).toBe(false);
   });

   it("a level clears on a win or on reaching its clearScore", () => {
      const l2 = FIVE.levels![1];
      expect(l2.clearScore).toBe(600);
      expect(isLevelCleared("win", 0, l2)).toBe(true);
      expect(isLevelCleared("timeup", 600, l2)).toBe(true);
      expect(isLevelCleared("lose", 599, l2)).toBe(false);
      // no clearScore (level 5, time games): only a win
      expect(isLevelCleared("timeup", 99999, FIVE.levels![4])).toBe(false);
      expect(isLevelCleared("win", 1, FIVE_TIME.levels![0])).toBe(true);
      expect(isLevelCleared("timeup", 99999, FIVE_TIME.levels![0])).toBe(false);
   });

   it("levelRunConfig / environment / instructions apply a level's overrides over the definition", () => {
      expect(levelRunConfig(DEFINITION, 1)).toEqual({ durationMs: 60000, lives: 3, resultDelayMs: 800 });
      expect(levelRunConfig(DEFINITION, 4)).toEqual({ durationMs: 50000, lives: 1, resultDelayMs: 800 });
      expect(levelRunConfig(PLAIN, 1)).toEqual({ durationMs: 60000, lives: undefined, resultDelayMs: undefined });
      expect(levelEnvironment(DEFINITION, 1)).toEqual({ background: "#101010", lighting: "day" });
      expect(levelEnvironment(DEFINITION, 4)).toEqual({ background: "#101010", lighting: "night" });
      expect(levelInstructions(DEFINITION, 4)).toEqual(["Watch the dark."]);
      expect(levelInstructions(DEFINITION, 2)).toEqual(["Collect batteries."]);
   });

   it("resolveActiveLevel gives the level's meta, spec and config; a plain game gives level 1 with no spec", () => {
      const l3 = resolveActiveLevel(FIVE, DEFINITION, 3);
      expect(l3).toMatchObject({ id: 3, meta: { id: 3, title: "Copy Room" }, config: { n: 30 } });
      expect(l3.spec?.description).toBe("Level 3");
      const plain = resolveActiveLevel(robotCollectorMeta, PLAIN, 1);
      expect(plain).toEqual({ id: 1, meta: { id: 1, title: "Robot Collector", scoring: robotCollectorMeta.scoring }, spec: null, config: undefined });
      // an id the game does not have falls back to level 1
      expect(resolveActiveLevel(robotCollectorMeta, PLAIN, 4).id).toBe(1);
   });

   it("meta.levels and definition.levels must match", () => {
      expect(definitionLevelProblems(FIVE, DEFINITION)).toEqual([]);
      expect(definitionLevelProblems(robotCollectorMeta, PLAIN)).toEqual([]);
      expect(definitionLevelProblems(FIVE, PLAIN)).toEqual(["meta.levels is set but definition.levels is not"]);
      expect(definitionLevelProblems(robotCollectorMeta, DEFINITION)).toEqual(["definition.levels is set but meta.levels is not"]);
      const short = { ...DEFINITION, levels: DEFINITION.levels!.slice(0, 4) } as GameDefinition;
      expect(definitionLevelProblems(FIVE, short)[0]).toContain("level ids differ");
   });
});

const entry = (best: number, bestDurationMs: number | null = null) => ({ best, bestDurationMs, plays: 1, lastPlayed: "2026-10-24T00:00:00Z", cleared: false });

describe("totals", () => {
   it("points: the plain sum of the levels' bests", () => {
      const levels: LocalLevels = { "1": entry(500, 30000), "2": entry(700, 40000), "4": entry(300, 20000) };
      expect(levelTotals(FIVE, levels, true)).toEqual({ best: 1500, bestDurationMs: 90000 });
      expect(levelTotals(FIVE, { "1": entry(500, 30000), "2": entry(700, null) }, true)).toEqual({ best: 1200, bestDurationMs: null });
      expect(levelTotals(FIVE, {}, true)).toEqual({ best: 0, bestDurationMs: null });
   });

   it("time: the summed best time only once all five levels are finished", () => {
      const four: LocalLevels = { "1": entry(25000, 30000), "2": entry(25000, 31000), "3": entry(25000, 32000), "4": entry(25000, 33000) };
      expect(levelTotals(FIVE_TIME, four, true)).toEqual({ best: 0, bestDurationMs: null });
      const five: LocalLevels = { ...four, "5": entry(25000, 34000) };
      expect(levelTotals(FIVE_TIME, five, true)).toEqual({ best: 125000, bestDurationMs: 160000 });
   });

   it("levels off: level 1's best and time, exactly as before", () => {
      const levels: LocalLevels = { "1": entry(500, 30000), "2": entry(700, 40000) };
      expect(levelTotals(FIVE, levels, false)).toEqual({ best: 500, bestDurationMs: 30000 });
      expect(levelTotals(FIVE_TIME, { "1": entry(24000, 60000) }, false)).toEqual({ best: 24000, bestDurationMs: 60000 });
      expect(levelTotals(robotCollectorMeta, { "1": entry(900, 45000) }, true)).toEqual({ best: 900, bestDurationMs: 45000 });
   });
});
