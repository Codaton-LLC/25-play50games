// Local scores with levels: lazy migration, per-level merge, totals, unlocks, the submit payload
// with and without the server's features.levels, the sync with per-level server bests, and the
// level pick. robot-collector and obstacle-race get five levels here (testing/levelFixtures.ts).
import { beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ ARCADE_ENABLED: true, ARCADE_LEADERBOARD: false, ARCADE_API_MOCK: false, ARCADE_LEVELS: true }));
vi.mock("../flags", () => flags);

const api = vi.hoisted(() => ({ submit: vi.fn(), leaderboard: vi.fn(), me: vi.fn(), setPrivacy: vi.fn(), games: vi.fn(), startRun: vi.fn() }));
vi.mock("@/lib/api/arcade", async (importOriginal) => {
   const original = await importOriginal<typeof import("@/lib/api/arcade")>();
   return { ...original, arcadeApi: api };
});

vi.mock("../registry", async (importOriginal) => {
   const original = await importOriginal<typeof import("../registry")>();
   const { withLevels } = await import("./testing/levelFixtures");
   const five = new Map(["robot-collector", "obstacle-race"].map((slug) => [slug, withLevels(original.getGameMeta(slug)!)]));
   return { ...original, getGameMeta: (slug: string) => five.get(slug) ?? original.getGameMeta(slug) };
});

import { getGameMeta } from "../registry";
import { normalizeEntry, readLocalScores, submitScore, syncServerScores, unrankedResult, type FinishedRun } from "./scores";
import { levelBestText, levelClearedText, levelProgress, levelTotalText, pickInitialLevel } from "./levelProgress";
import { resetLevelSupport } from "./levelSupport";
import { trackArcade } from "./analytics";
import { robotCollectorMeta } from "../games/robot-collector/meta";
import type { LevelId } from "../types";

class MemoryStorage {
   private data = new Map<string, string>();
   getItem(k: string) {
      return this.data.has(k) ? this.data.get(k)! : null;
   }
   setItem(k: string, v: string) {
      this.data.set(k, String(v));
   }
   removeItem(k: string) {
      this.data.delete(k);
   }
}

let local: MemoryStorage;
let session: MemoryStorage;
const pushed: unknown[] = [];

beforeEach(() => {
   local = new MemoryStorage();
   session = new MemoryStorage();
   pushed.length = 0;
   vi.stubGlobal("window", {
      localStorage: local,
      sessionStorage: session,
      dispatchEvent: () => true,
      dataLayer: { push: (e: unknown) => pushed.push(e) },
   });
   vi.stubGlobal("localStorage", local);
   vi.stubGlobal("CustomEvent", class extends Event {
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
         super(type);
         this.detail = init?.detail;
      }
   });
   // dataLayer must be an array for trackArcade
   (window as unknown as { dataLayer: unknown[] }).dataLayer = Object.assign([], { push: (e: unknown) => pushed.push(e) });
   flags.ARCADE_LEADERBOARD = false;
   flags.ARCADE_LEVELS = true;
   Object.values(api).forEach((fn) => fn.mockReset());
   resetLevelSupport();
});

const ROBOT = () => getGameMeta("robot-collector")!;
const RACE = () => getGameMeta("obstacle-race")!;

let clock = 0;
const run = (over: Partial<FinishedRun> = {}): FinishedRun => ({
   slug: "robot-collector",
   score: 900,
   durationMs: 45000,
   finishedAt: `2026-10-24T10:00:${String(clock++ % 60).padStart(2, "0")}.000Z`,
   endReason: "timeup",
   ...over,
});

const OLD_ENTRY = { best: 900, bestDurationMs: 45000, plays: 4, lastPlayed: "2026-10-01T00:00:00Z", rank: 7 };

describe("lazy migration", () => {
   it("turns an entry from before levels into level 1 on read, without writing", () => {
      local.setItem("play50games_3d_scores:guest", JSON.stringify({ "robot-collector": OLD_ENTRY }));
      const entry = readLocalScores(null)["robot-collector"]!;
      expect(entry).toMatchObject({ best: 900, bestDurationMs: 45000, plays: 4, rank: 7 });
      // 900 reaches level 1's clearScore (500): level 2 opens
      expect(entry.levels).toEqual({ "1": { best: 900, bestDurationMs: 45000, plays: 4, lastPlayed: "2026-10-01T00:00:00Z", cleared: true } });
      expect(JSON.parse(local.getItem("play50games_3d_scores:guest")!)["robot-collector"]).toEqual(OLD_ENTRY);
   });

   it("keeps the best number as it was for a one-level game and with the flag off", () => {
      expect(normalizeEntry("museum-guard", OLD_ENTRY)).toMatchObject({ best: 900, bestDurationMs: 45000, levels: { "1": { best: 900, cleared: false } } });
      flags.ARCADE_LEVELS = false;
      const stored = { ...OLD_ENTRY, levels: { "1": { ...OLD_ENTRY, cleared: true }, "2": { ...OLD_ENTRY, best: 1200, cleared: false } } };
      expect(normalizeEntry("robot-collector", stored)).toMatchObject({ best: 900, bestDurationMs: 45000 });
   });

   it("drops unknown level keys and malformed level entries, never throws", () => {
      const stored = {
         ...OLD_ENTRY,
         levels: { "1": { best: 300, bestDurationMs: null, plays: 1, lastPlayed: "", cleared: false }, "7": { best: 1 }, "2": { best: "x" }, "03": { best: 5 }, "4": null },
      };
      const entry = normalizeEntry("robot-collector", stored)!;
      expect(Object.keys(entry.levels!)).toEqual(["1"]);
      expect(entry.best).toBe(300);
      expect(normalizeEntry("robot-collector", { best: "oops" })).toBeNull();
      expect(normalizeEntry("robot-collector", null)).toBeNull();
      local.setItem("play50games_3d_scores:guest", "{not json");
      expect(readLocalScores(null)).toEqual({});
   });

   it("a time game's stored best is a finished run: level 1 counts as cleared", () => {
      const entry = normalizeEntry("obstacle-race", { best: 24000, bestDurationMs: 60000, plays: 2, lastPlayed: "", rank: null })!;
      expect(entry.levels!["1"]!.cleared).toBe(true);
      // levels on: one of five finished, so no total yet
      expect(entry).toMatchObject({ best: 0, bestDurationMs: null });
   });
});

describe("per-level saves, totals and unlocks", () => {
   it("points: best becomes the sum of the level bests; the result carries the level's best", async () => {
      const first = await submitScore(run({ score: 450 }), null);
      expect(first).toMatchObject({ level: 1, best: 450, isNewBest: true, total: 450, newlyCleared: false, unlockedLevel: null });
      const cleared = await submitScore(run({ score: 520 }), null);
      expect(cleared).toMatchObject({ level: 1, best: 520, total: 520, newlyCleared: true, unlockedLevel: 2 });
      const second = await submitScore(run({ level: 2, score: 300 }), null);
      expect(second).toMatchObject({ level: 2, best: 300, isNewBest: true, total: 820, plays: 3, newlyCleared: false });
      const worse = await submitScore(run({ score: 100 }), null);
      expect(worse).toMatchObject({ level: 1, best: 520, isNewBest: false, total: 820, newlyCleared: false });
      const entry = readLocalScores(null)["robot-collector"]!;
      expect(entry).toMatchObject({ best: 820, plays: 4 });
      expect(entry.levels!["1"]).toMatchObject({ best: 520, plays: 3, cleared: true });
      expect(entry.levels!["2"]).toMatchObject({ best: 300, plays: 1, cleared: false });
   });

   it("a win clears a level whatever its score; level 5 has no target", async () => {
      const result = await submitScore(run({ level: 1, score: 10, endReason: "win" }), null);
      expect(result).toMatchObject({ newlyCleared: true, unlockedLevel: 2 });
      const l5 = await submitScore(run({ level: 5, score: 99999, endReason: "timeup" }), null);
      // clamped to level 5's maxScore; no clearScore on level 5, so only a win clears it
      expect(l5).toMatchObject({ best: 1870, newlyCleared: false, unlockedLevel: null });
   });

   it("clamps a run to its own level's limits", async () => {
      expect((await submitScore(run({ level: 1, score: 99999 }), null)).score).toBe(1470);
      expect((await submitScore(run({ level: 3, score: 99999 }), null)).score).toBe(1670);
   });

   it("unlock rule: cleared n opens n+1, a score keeps a level open, nothing re-locks", () => {
      const meta = ROBOT();
      const entry = normalizeEntry("robot-collector", {
         ...OLD_ENTRY,
         levels: {
            "1": { best: 520, bestDurationMs: 1, plays: 1, lastPlayed: "", cleared: false },
            "2": { best: 100, bestDurationMs: 1, plays: 1, lastPlayed: "", cleared: true },
            "4": { best: 50, bestDurationMs: 1, plays: 1, lastPlayed: "", cleared: false },
         },
      });
      const progress = levelProgress(meta, entry);
      expect(progress.levels.map((l) => [l.id, l.cleared, l.unlocked])).toEqual([
         [1, true, true], // 520 >= clearScore 500
         [2, true, true], // stored win flag
         [3, false, true],
         [4, false, true], // has a score (another device)
         [5, false, false],
      ]);
      expect(progress).toMatchObject({ total: 670, cleared: 2, complete: false });
      expect(levelClearedText(progress)).toBe("2 of 5 levels cleared");
      expect(levelTotalText(meta, progress)).toBe("Total 670 pts");
      expect(levelBestText(progress.levels[0], meta.scoring)).toBe("520 pts");
      expect(levelBestText(progress.levels[2], meta.scoring)).toBe("–");
      // nothing stored: only level 1
      expect(levelProgress(meta, null).levels.map((l) => l.unlocked)).toEqual([true, false, false, false, false]);
      // levels off: one tile's worth of data, the game's best
      expect(levelProgress(meta, entry, false).levels).toHaveLength(1);
   });

   it("time games: per-level best times, a total time only once all 5 are finished", async () => {
      const meta = RACE();
      for (const id of [1, 2, 3, 4] as LevelId[]) {
         const result = await submitScore(run({ slug: "obstacle-race", level: id, durationMs: 60000 + id * 1000, endReason: "win" }), null);
         expect(result).toMatchObject({ level: id, bestDurationMs: 60000 + id * 1000, total: 0, totalDurationMs: null, newlyCleared: true });
      }
      let progress = levelProgress(meta, readLocalScores(null)["obstacle-race"]);
      expect(levelTotalText(meta, progress)).toBe("Finish all 5 levels to rank");
      expect(levelBestText(progress.levels[1], meta.scoring)).toBe("1:02.00");
      expect(progress.levels[4]).toMatchObject({ unlocked: true, best: null });

      const last = await submitScore(run({ slug: "obstacle-race", level: 5, durationMs: 70000, endReason: "win" }), null);
      expect(last).toMatchObject({ level: 5, totalDurationMs: 61000 + 62000 + 63000 + 64000 + 70000 });
      progress = levelProgress(meta, readLocalScores(null)["obstacle-race"]);
      expect(progress).toMatchObject({ complete: true, cleared: 5, totalDurationMs: 320000 });
      expect(levelTotalText(meta, progress)).toBe("Total time 5:20.00");
      // the summed time scores, so higher stays better
      expect(readLocalScores(null)["obstacle-race"]!.best).toBe(last.total);
      expect(last.total).toBeGreaterThan(0);
   });

   it("unrankedResult shows the level's best and the game's total", async () => {
      await submitScore(run({ score: 600 }), null);
      await submitScore(run({ level: 2, score: 300 }), null);
      expect(unrankedResult("robot-collector", null, 2)).toMatchObject({ status: "unranked", level: 2, best: 300, total: 900, newlyCleared: false });
      expect(unrankedResult("robot-collector", null)).toMatchObject({ level: 1, best: 600 });
   });
});

describe("the submit payload", () => {
   const synced = (over: Record<string, unknown> = {}) => ({
      success: true,
      data: { slug: "robot-collector", score: 300, best_score: 900, is_new_best: true, plays: 2, rank: 4, ...over },
   });

   beforeEach(() => {
      flags.ARCADE_LEADERBOARD = true;
      local.setItem("play50games_jwt_token", "jwt");
   });

   it("level 1 is sent exactly as before levels, without asking the server for features", async () => {
      api.submit.mockResolvedValue(synced({ score: 900 }));
      await submitScore(run(), 7);
      expect(api.submit.mock.calls[0][0]).toEqual({ slug: "robot-collector", score: 900, duration_ms: 45000 });
      expect(api.games).not.toHaveBeenCalled();
   });

   it("levels 2-5 carry `level` when the server advertises features.levels (one cached read)", async () => {
      api.games.mockResolvedValue({ games: {}, features: { levels: true } });
      api.submit.mockResolvedValue(synced({ level: 2, level_best_score: 300, is_new_level_best: true }));
      const result = await submitScore(run({ level: 2, score: 300 }), 7, "r1.t");
      expect(api.submit.mock.calls[0][0]).toEqual({ slug: "robot-collector", score: 300, duration_ms: 45000, level: 2, run_token: "r1.t" });
      expect(result).toMatchObject({ status: "synced", level: 2, best: 300, isNewBest: true, rank: 4 });
      await submitScore(run({ level: 3, score: 100 }), 7);
      expect(api.games).toHaveBeenCalledTimes(1);
      expect(readLocalScores(7)["robot-collector"]!.levels!["2"]!.best).toBe(300);
   });

   it("a server without features.levels never receives levels 2-5 (kept on this device)", async () => {
      api.games.mockResolvedValue({ games: {}, run_tokens: { mode: "optional", ready: true } });
      const result = await submitScore(run({ level: 2, score: 300 }), 7);
      expect(api.submit).not.toHaveBeenCalled();
      expect(result).toMatchObject({ status: "saved-local", level: 2, best: 300 });
   });

   it("a failed features read sends nothing and asks again next time", async () => {
      api.games.mockRejectedValueOnce(new Error("offline"));
      expect((await submitScore(run({ level: 2 }), 7)).status).toBe("saved-local");
      api.games.mockResolvedValueOnce({ games: {}, features: { levels: true } });
      api.submit.mockResolvedValue(synced({ level: 2, level_best_score: 900 }));
      expect((await submitScore(run({ level: 2 }), 7)).status).toBe("synced");
      expect(api.games).toHaveBeenCalledTimes(2);
   });

   it("takes the server's level best when it is higher and keeps the local total from the levels", async () => {
      await submitScore(run({ score: 600 }), null); // a guest run, not on this account
      api.submit.mockResolvedValue(synced({ score: 600, best_score: 1700, level: 1, level_best_score: 1100, is_new_level_best: false }));
      const result = await submitScore(run({ score: 600 }), 7);
      expect(result).toMatchObject({ best: 1100, bestDurationMs: null, isNewBest: false, total: 1100 });
      expect(readLocalScores(7)["robot-collector"]).toMatchObject({ best: 1100, rank: 4 });
   });

   it("with the levels flag off a run is level 1 in every way", async () => {
      flags.ARCADE_LEVELS = false;
      api.submit.mockResolvedValue(synced({ score: 900, best_score: 900 }));
      const result = await submitScore(run({ score: 900 }), 7);
      expect(api.submit.mock.calls[0][0]).not.toHaveProperty("level");
      expect(result).toMatchObject({ level: 1, best: 900, total: 900, unlockedLevel: null });
   });
});

describe("syncServerScores with levels", () => {
   beforeEach(() => {
      flags.ARCADE_LEADERBOARD = true;
      local.setItem("play50games_jwt_token", "jwt");
   });

   it("takes the server's per-level bests, keeps local-only levels and their cleared flags", async () => {
      await submitScore(run({ level: 3, score: 200, endReason: "win" }), 7).catch(() => {});
      api.me.mockResolvedValue({
         "robot-collector": {
            best: 1300,
            best_duration_ms: null,
            plays: 5,
            last_played: "2026-10-23T00:00:00Z",
            rank: 2,
            levels: {
               "1": { best: 800, best_duration_ms: 40000, plays: 3, last_played: "2026-10-23T00:00:00Z" },
               "2": { best: 500, best_duration_ms: 41000, plays: 2, last_played: "2026-10-22T00:00:00Z" },
               "9": { best: 5, best_duration_ms: 1, plays: 1, last_played: "" },
            },
         },
      });
      await syncServerScores(7, true);
      const entry = readLocalScores(7)["robot-collector"]!;
      expect(Object.keys(entry.levels!).sort()).toEqual(["1", "2", "3"]);
      expect(entry.levels!["3"]).toMatchObject({ best: 200, cleared: true });
      expect(entry).toMatchObject({ best: 1500, plays: 5, rank: 2 });
      // a synced best that reaches the clear target counts as cleared (the server knows scores, not wins)
      expect(levelProgress(ROBOT(), entry).levels.map((l) => l.cleared)).toEqual([true, false, true, false, false]);
   });

   it("an older server's one best becomes level 1", async () => {
      api.me.mockResolvedValue({ "robot-collector": { best: 700, best_duration_ms: 30000, plays: 2, last_played: "", rank: 3 } });
      await syncServerScores(7, true);
      expect(readLocalScores(7)["robot-collector"]!.levels!["1"]).toMatchObject({ best: 700, plays: 2 });
   });
});

describe("pickInitialLevel", () => {
   const progress = () =>
      levelProgress(
         ROBOT(),
         normalizeEntry("robot-collector", {
            ...OLD_ENTRY,
            levels: {
               "1": { best: 900, bestDurationMs: 1, plays: 1, lastPlayed: "", cleared: true },
               "2": { best: 900, bestDurationMs: 1, plays: 1, lastPlayed: "", cleared: true },
            },
         })
      ).levels;

   it("honours an unlocked request, else the highest unlocked level below it", () => {
      expect(pickInitialLevel(progress(), 2, null)).toBe(2);
      expect(pickInitialLevel(progress(), 5, null)).toBe(3);
      expect(pickInitialLevel(progress(), 99, 1)).toBe(3);
   });

   it("without a request: the last played level, else the first open uncleared one, else 5", () => {
      expect(pickInitialLevel(progress(), null, 1)).toBe(1);
      expect(pickInitialLevel(progress(), null, 5)).toBe(3);
      expect(pickInitialLevel(progress(), null, null)).toBe(3);
      const allCleared = progress().map((l) => ({ ...l, cleared: true, unlocked: true }));
      expect(pickInitialLevel(allCleared, null, null)).toBe(5);
      expect(pickInitialLevel(levelProgress(robotCollectorMeta, null).levels, 4, 3)).toBe(1);
   });
});

describe("analytics", () => {
   it("adds `level` only when given, and knows arcade_level_cleared", () => {
      trackArcade("arcade_start", { game: "robot-collector", score: 0, duration_ms: 0 });
      trackArcade("arcade_level_cleared", { game: "robot-collector", score: 520.4, duration_ms: 40000, level: 2 });
      expect(pushed).toEqual([
         { event: "arcade_start", game: "robot-collector", score: 0, duration_ms: 0 },
         { event: "arcade_level_cleared", game: "robot-collector", score: 520, duration_ms: 40000, level: 2 },
      ]);
   });
});
