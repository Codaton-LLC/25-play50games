import { beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ ARCADE_ENABLED: true, ARCADE_LEADERBOARD: false, ARCADE_API_MOCK: false }));
vi.mock("../flags", () => flags);

const api = vi.hoisted(() => ({ submit: vi.fn(), leaderboard: vi.fn(), me: vi.fn(), setPrivacy: vi.fn() }));
vi.mock("@/lib/api/arcade", async (importOriginal) => {
   const original = await importOriginal<typeof import("@/lib/api/arcade")>();
   return { ...original, arcadeApi: api };
});

import { ArcadeApiError } from "@/lib/api/arcade";
import {
   ARCADE_SCORES_EVENT,
   computeTimeScore,
   isRankedRun,
   normalizeRun,
   readLocalScores,
   saveRunToAccount,
   scoresKey,
   submitScore,
   syncServerScores,
   unrankedResult,
   type FinishedRun,
} from "./scores";
import { getGameMeta } from "../registry";

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
   clear() {
      this.data.clear();
   }
}

const events: string[] = [];
let local: MemoryStorage;
let session: MemoryStorage;

beforeEach(() => {
   local = new MemoryStorage();
   session = new MemoryStorage();
   events.length = 0;
   vi.stubGlobal("window", {
      localStorage: local,
      sessionStorage: session,
      dispatchEvent: (e: Event) => events.push(e.type),
   });
   vi.stubGlobal("localStorage", local);
   vi.stubGlobal("CustomEvent", class extends Event {
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
         super(type);
         this.detail = init?.detail;
      }
   });
   flags.ARCADE_LEADERBOARD = false;
   Object.values(api).forEach((fn) => fn.mockReset());
});

const run = (over: Partial<FinishedRun> = {}): FinishedRun => ({
   slug: "robot-collector",
   score: 900,
   durationMs: 45000,
   finishedAt: "2026-10-05T10:00:00.000Z",
   ...over,
});

describe("scoring helpers", () => {
   it("computes time scores like the server", () => {
      const rules = getGameMeta("obstacle-race")!.scoring;
      expect(computeTimeScore(rules, 15000)).toBe(28500);
      expect(computeTimeScore(rules, 400000)).toBe(0);
   });

   it("clamps points and derives time scores", () => {
      expect(normalizeRun(run({ score: 99999 }), getGameMeta("robot-collector")!.scoring).score).toBe(1600);
      expect(normalizeRun(run({ score: -5 }), getGameMeta("robot-collector")!.scoring).score).toBe(0);
      const timed = normalizeRun(run({ slug: "obstacle-race", score: 1, durationMs: 42000 }), getGameMeta("obstacle-race")!.scoring);
      expect(timed.score).toBe(25800);
   });

   it("ranks time games only on a win, points games on every ending but quit", () => {
      const time = getGameMeta("obstacle-race")!.scoring;
      const points = getGameMeta("robot-collector")!.scoring;
      expect(isRankedRun(time, "win")).toBe(true);
      expect(isRankedRun(time, "lose")).toBe(false);
      expect(isRankedRun(time, "timeup")).toBe(false);
      expect(isRankedRun(points, "lose")).toBe(true);
      expect(isRankedRun(points, "timeup")).toBe(true);
      expect(isRankedRun(points, "quit")).toBe(false);
   });

   it("reports an unranked run without saving anything", async () => {
      await submitScore(run({ slug: "obstacle-race", durationMs: 60000 }), null);
      events.length = 0;
      const result = unrankedResult("obstacle-race", null);
      expect(result).toMatchObject({ score: 0, best: 24000, isNewBest: false, plays: 1, status: "unranked" });
      expect(readLocalScores(null)["obstacle-race"]!.plays).toBe(1);
      expect(events).toHaveLength(0);
   });
});

describe("submitScore", () => {
   it("keeps guest and user scores under separate keys", async () => {
      await submitScore(run({ score: 500 }), null);
      await submitScore(run({ score: 700 }), 42);
      expect(scoresKey(null)).toBe("play50games_3d_scores:guest");
      expect(readLocalScores(null)["robot-collector"]!.best).toBe(500);
      expect(readLocalScores(42)["robot-collector"]!.best).toBe(700);
      expect(events).toContain(ARCADE_SCORES_EVENT);
   });

   it("tracks best and plays locally when the leaderboard is off", async () => {
      const first = await submitScore(run({ score: 800 }), null);
      const second = await submitScore(run({ score: 600 }), null);
      expect(first).toMatchObject({ isNewBest: true, best: 800, plays: 1, status: "leaderboard-off" });
      expect(second).toMatchObject({ isNewBest: false, best: 800, plays: 2 });
      expect(api.submit).not.toHaveBeenCalled();
   });

   it("asks guests to log in when the leaderboard is on", async () => {
      flags.ARCADE_LEADERBOARD = true;
      const result = await submitScore(run(), null);
      expect(result.status).toBe("login-required");
      expect(api.submit).not.toHaveBeenCalled();
   });

   it("syncs logged-in scores and stores the server rank", async () => {
      flags.ARCADE_LEADERBOARD = true;
      local.setItem("play50games_jwt_token", "jwt");
      api.submit.mockResolvedValue({
         success: true,
         data: { slug: "robot-collector", score: 900, best_score: 1200, is_new_best: false, plays: 5, rank: 3 },
      });
      const result = await submitScore(run(), 7);
      expect(api.submit).toHaveBeenCalledWith({ slug: "robot-collector", score: 900, duration_ms: 45000 });
      expect(result).toMatchObject({ status: "synced", best: 1200, rank: 3, isNewBest: false });
      expect(readLocalScores(7)["robot-collector"]).toMatchObject({ best: 1200, rank: 3 });
   });

   it("drops a rejected JWT and asks for a fresh login", async () => {
      flags.ARCADE_LEADERBOARD = true;
      local.setItem("play50games_jwt_token", "dead");
      api.submit.mockRejectedValue(new ArcadeApiError("unauthorized", "no", 401));
      const result = await submitScore(run(), 7);
      expect(result.status).toBe("login-required");
      expect(local.getItem("play50games_jwt_token")).toBeNull();
   });

   it.each([
      ["rate_limited", "rate-limited"],
      ["banned", "banned"],
      ["invalid_data", "rejected"],
      ["network", "offline"],
      ["api_key", "config-error"],
      ["server", "saved-local"],
   ] as const)("maps %s to %s and keeps the token", async (code, status) => {
      flags.ARCADE_LEADERBOARD = true;
      local.setItem("play50games_jwt_token", "jwt");
      api.submit.mockRejectedValue(new ArcadeApiError(code, code));
      const result = await submitScore(run(), 7);
      expect(result.status).toBe(status);
      expect(local.getItem("play50games_jwt_token")).toBe("jwt");
      expect(readLocalScores(7)["robot-collector"]!.best).toBe(900);
   });
});

describe("saveRunToAccount", () => {
   it("counts a retried run once per account", async () => {
      flags.ARCADE_LEADERBOARD = true;
      const finished = run({ finishedAt: "2026-10-05T11:00:00.000Z" });
      const first = await saveRunToAccount(finished, 9);
      expect(first.status).toBe("login-required");
      local.setItem("play50games_jwt_token", "jwt");
      api.submit.mockResolvedValue({
         success: true,
         data: { slug: "robot-collector", score: 900, best_score: 900, is_new_best: true, plays: 1, rank: 4 },
      });
      const second = await saveRunToAccount(finished, 9);
      expect(second).toMatchObject({ status: "synced", rank: 4, isNewBest: true });
      expect(api.submit).toHaveBeenCalledTimes(1);
      expect(readLocalScores(9)["robot-collector"]).toMatchObject({ plays: 1, best: 900, rank: 4 });
   });
});

describe("syncServerScores", () => {
   it("replaces local bests with server data, at most every 5 minutes", async () => {
      flags.ARCADE_LEADERBOARD = true;
      local.setItem("play50games_jwt_token", "jwt");
      api.me.mockResolvedValue({
         "robot-collector": { best: 1500, best_duration_ms: 30000, plays: 9, last_played: "2026-10-04T00:00:00Z", rank: 2 },
      });
      await syncServerScores(7);
      await syncServerScores(7);
      expect(api.me).toHaveBeenCalledTimes(1);
      expect(readLocalScores(7)["robot-collector"]).toMatchObject({ best: 1500, plays: 9, rank: 2 });
   });

   it("does nothing for guests or when the leaderboard is off", async () => {
      await syncServerScores(7);
      expect(api.me).not.toHaveBeenCalled();
   });
});
