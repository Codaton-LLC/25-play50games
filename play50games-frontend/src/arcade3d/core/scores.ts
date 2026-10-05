// 3D Arcade scores: localStorage first, then the WordPress leaderboard for logged-in users.
// Fully separate from classic progress (different keys, different endpoints). Owned by Claude.
import type { ArcadeSlug, ScoringRules } from "../types";
import { getGameMeta } from "../registry";
import { ARCADE_LEADERBOARD } from "../flags";
import { arcadeApi, ArcadeApiError } from "@/lib/api/arcade";
import { getJwtToken, removeJwtToken } from "@/lib/api/apiUtils";
import { setAuthStatus } from "@/lib/storage/progressStorage";

export const ARCADE_SCORES_EVENT = "play50games_3d_scores_updated";
const SYNC_KEY_PREFIX = "play50games_3d_sync:u";
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Scores are kept per user so switching accounts never shows someone else's bests. */
export const scoresKey = (userId: number | null): string =>
   userId ? `play50games_3d_scores:u${userId}` : "play50games_3d_scores:guest";

export interface LocalScoreEntry {
   best: number;
   bestDurationMs: number | null;
   plays: number;
   lastPlayed: string;
   rank: number | null;
}

export type LocalScores = Partial<Record<ArcadeSlug, LocalScoreEntry>>;

export interface FinishedRun {
   slug: ArcadeSlug;
   score: number;
   durationMs: number;
   finishedAt: string;
}

export type SubmitStatus =
   | "synced"
   | "saved-local"
   | "login-required"
   | "rate-limited"
   | "rejected"
   | "banned"
   | "offline"
   | "leaderboard-off"
   | "config-error";

export interface SubmitResult {
   slug: ArcadeSlug;
   score: number;
   best: number;
   isNewBest: boolean;
   plays: number;
   rank: number | null;
   status: SubmitStatus;
}

// ---------- pure helpers ----------

/** Time games: faster = higher score. The server computes the same value. */
export function computeTimeScore(rules: ScoringRules, durationMs: number): number {
   if (rules.kind !== "time" || !rules.timeBaseMs) return 0;
   return Math.max(0, Math.floor((rules.timeBaseMs - durationMs) / 10));
}

/** Clamps a run to the game's limits; for time games the score is derived from the duration. */
export function normalizeRun(run: FinishedRun, rules: ScoringRules): FinishedRun {
   const durationMs = Math.max(0, Math.round(run.durationMs));
   const raw = rules.kind === "time" ? computeTimeScore(rules, durationMs) : Math.round(run.score);
   const score = Math.min(rules.maxScore, Math.max(0, raw));
   return { ...run, score, durationMs };
}

export function mergeRun(prev: LocalScoreEntry | undefined, run: FinishedRun): { entry: LocalScoreEntry; isNewBest: boolean } {
   const isNewBest = !prev || run.score > prev.best;
   return {
      isNewBest,
      entry: {
         best: isNewBest ? run.score : prev!.best,
         bestDurationMs: isNewBest ? run.durationMs : prev!.bestDurationMs,
         plays: (prev?.plays ?? 0) + 1,
         lastPlayed: run.finishedAt,
         rank: prev?.rank ?? null,
      },
   };
}

// ---------- storage ----------

function storage(): Storage | null {
   try {
      return typeof window !== "undefined" ? window.localStorage : null;
   } catch {
      return null;
   }
}

export function readLocalScores(userId: number | null): LocalScores {
   const raw = storage()?.getItem(scoresKey(userId));
   if (!raw) return {};
   try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
   } catch {
      return {};
   }
}

function writeLocalScores(userId: number | null, scores: LocalScores): void {
   try {
      storage()?.setItem(scoresKey(userId), JSON.stringify(scores));
   } catch {
      // storage full or blocked: scores just are not persisted
   }
   if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(ARCADE_SCORES_EVENT, { detail: { userId } }));
   }
}

function patchLocalEntry(userId: number | null, slug: ArcadeSlug, patch: Partial<LocalScoreEntry>): void {
   const scores = readLocalScores(userId);
   const current = scores[slug];
   if (!current) return;
   scores[slug] = { ...current, ...patch };
   writeLocalScores(userId, scores);
}

// ---------- submit ----------

function statusFromError(error: unknown): SubmitStatus {
   if (!(error instanceof ArcadeApiError)) return "saved-local";
   switch (error.code) {
      case "unauthorized":
         // dead or forged token: drop it so the UI offers a fresh login
         removeJwtToken();
         setAuthStatus(false);
         return "login-required";
      case "banned":
         return "banned";
      case "rate_limited":
         return "rate-limited";
      case "invalid_data":
      case "not_found":
         return "rejected";
      case "network":
         return "offline";
      case "api_key":
         return "config-error";
      default:
         return "saved-local";
   }
}

/** Saves a finished run locally, then sends it to the leaderboard when the player is logged in. */
export async function submitScore(run: FinishedRun, userId: number | null): Promise<SubmitResult> {
   const meta = getGameMeta(run.slug);
   if (!meta) throw new Error(`Unknown arcade game: ${run.slug}`);

   const normalized = normalizeRun(run, meta.scoring);
   const scores = readLocalScores(userId);
   const { entry, isNewBest } = mergeRun(scores[run.slug], normalized);
   scores[run.slug] = entry;
   writeLocalScores(userId, scores);

   const result: SubmitResult = {
      slug: run.slug,
      score: normalized.score,
      best: entry.best,
      isNewBest,
      plays: entry.plays,
      rank: entry.rank,
      status: "saved-local",
   };

   if (!ARCADE_LEADERBOARD) return { ...result, status: "leaderboard-off" };
   if (!userId || !getJwtToken()) return { ...result, status: "login-required" };

   try {
      const { data } = await arcadeApi.submit({
         slug: run.slug,
         score: normalized.score,
         duration_ms: normalized.durationMs,
      });
      const best = Math.max(entry.best, data.best_score);
      patchLocalEntry(userId, run.slug, { best, rank: data.rank });
      return { ...result, best, rank: data.rank, isNewBest: data.is_new_best, status: "synced" };
   } catch (error) {
      return { ...result, status: statusFromError(error) };
   }
}

/** Result screen: a guest logged in on the spot and wants this run on their account. */
export function saveRunToAccount(run: FinishedRun, userId: number): Promise<SubmitResult> {
   return submitScore(run, userId);
}

/** Replaces local bests with the server's for a logged-in user (at most every 5 minutes). */
export async function syncServerScores(userId: number, force = false): Promise<void> {
   if (!ARCADE_LEADERBOARD || !getJwtToken()) return;

   const syncKey = `${SYNC_KEY_PREFIX}${userId}`;
   let session: Storage | null = null;
   try {
      session = typeof window !== "undefined" ? window.sessionStorage : null;
   } catch {
      session = null;
   }
   const last = Number(session?.getItem(syncKey) || 0);
   if (!force && Date.now() - last < SYNC_INTERVAL_MS) return;

   try {
      const server = await arcadeApi.me();
      const scores = readLocalScores(userId);
      for (const [slug, s] of Object.entries(server)) {
         if (!s) continue;
         scores[slug as ArcadeSlug] = {
            best: s.best,
            bestDurationMs: s.best_duration_ms,
            plays: s.plays,
            lastPlayed: s.last_played,
            rank: s.rank,
         };
      }
      writeLocalScores(userId, scores);
      session?.setItem(syncKey, String(Date.now()));
   } catch (error) {
      statusFromError(error);
   }
}
