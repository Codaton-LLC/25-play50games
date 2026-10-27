// 3D Arcade scores: localStorage first, then the WordPress leaderboard for logged-in users.
// Fully separate from classic progress (different keys, different endpoints). Owned by Claude.
//
// Levels (docs/arcade-levels.md §3, core/README.md "Levels"): every entry keeps its per-level
// bests in `levels` ("1".."5"); `best` / `bestDurationMs` are the game's totals, recomputed from
// the levels on every read (levelTotals): with levels off, or for a one-level game, that is level
// 1's best, exactly the number stored before levels existed. Entries written before levels are
// migrated lazily on read (their best becomes level 1's) and saved in the new shape on the next
// save. A run carries its `level` (default 1); level 1 is sent exactly as before, levels 2-5 only
// to a server that advertises `features.levels` (levelSupport.ts).
import type { ArcadeGameMeta, ArcadeSlug, LevelId, ScoringRules } from "../types";
import type { EndReason } from "./types";
import { getGameMeta, isLevelId, levelMetaFor, levelsOf } from "../registry";
import { ARCADE_LEADERBOARD } from "../flags";
import { arcadeApi, ArcadeApiError } from "@/lib/api/arcade";
import { getJwtToken, removeJwtToken } from "@/lib/api/apiUtils";
import { setAuthStatus } from "@/lib/storage/progressStorage";
import { isLevelCleared, levelKey, levelTotals, levelsActive, type LocalLevels } from "./levels";
import { levelEntryCleared, levelProgress } from "./levelProgress";
import { serverSupportsLevels } from "./levelSupport";

export const ARCADE_SCORES_EVENT = "play50games_3d_scores_updated";
const SYNC_KEY_PREFIX = "play50games_3d_sync:u";
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Scores are kept per user so switching accounts never shows someone else's bests. */
export const scoresKey = (userId: number | null): string =>
   userId ? `play50games_3d_scores:u${userId}` : "play50games_3d_scores:guest";

/** One level's local best (docs/arcade-levels.md §3.1). */
export interface LocalLevelEntry {
   best: number;
   bestDurationMs: number | null;
   plays: number;
   lastPlayed: string;
   /** a run on this level was a win or reached its clearScore */
   cleared: boolean;
}

export interface LocalScoreEntry {
   /**
    * The number the board ranks: the sum of the level bests for a game whose levels are on (time
    * games: only once all 5 are finished, else 0); otherwise level 1's best, as before levels.
    */
   best: number;
   /** the summed best time (time games: only with all 5 levels finished); level 1's otherwise */
   bestDurationMs: number | null;
   /** all levels */
   plays: number;
   lastPlayed: string;
   /** the server rank of the board value */
   rank: number | null;
   /** keys "1".."5"; always present once read (normalizeEntry) */
   levels?: LocalLevels;
}

export type LocalScores = Partial<Record<ArcadeSlug, LocalScoreEntry>>;

export interface FinishedRun {
   slug: ArcadeSlug;
   score: number;
   durationMs: number;
   finishedAt: string;
   /** the level played; omitted = 1 */
   level?: LevelId;
   /** how the run ended: a "win" clears its level (isLevelCleared) */
   endReason?: EndReason | null;
   /**
    * Players in the run (local multiplayer, menu2/multiplayer). Omitted or 1 = a solo run. A run with
    * more than one player never goes into the solo board: submitScore saves and sends nothing.
    */
   players?: number;
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
   | "config-error"
   /** time game that did not finish (lose/timeup): nothing was saved or sent */
   | "unranked"
   /** the server requires a run ticket and this run has none (its start failed): saved on this device */
   | "ranking-unavailable";

export interface SubmitResult {
   slug: ArcadeSlug;
   score: number;
   /** the best on this run's level (a one-level game: the game's best, as before levels) */
   best: number;
   /** duration of the level's best run, when known (time games show it instead of the score) */
   bestDurationMs: number | null;
   /** a new best on this level */
   isNewBest: boolean;
   /** all plays of the game */
   plays: number;
   rank: number | null;
   status: SubmitStatus;
   level: LevelId;
   /** the game's total after this run (LocalScoreEntry.best) */
   total: number;
   /** time games: the summed best time once all 5 levels are finished, else null */
   totalDurationMs: number | null;
   /** this run cleared its level for the first time */
   newlyCleared: boolean;
   /** the level this run unlocked (levels on only), else null */
   unlockedLevel: LevelId | null;
}

// ---------- pure helpers ----------

/** Time games: faster = higher score. The server computes the same value. */
export function computeTimeScore(rules: ScoringRules, durationMs: number): number {
   if (rules.kind !== "time" || !rules.timeBaseMs) return 0;
   return Math.max(0, Math.floor((rules.timeBaseMs - durationMs) / 10));
}

/** Clamps a run to its level's limits; for time games the score is derived from the duration. */
export function normalizeRun(run: FinishedRun, rules: ScoringRules): FinishedRun {
   const durationMs = Math.max(0, Math.round(run.durationMs));
   const raw = rules.kind === "time" ? computeTimeScore(rules, durationMs) : Math.round(run.score);
   const score = Math.min(rules.maxScore, Math.max(0, raw));
   return { ...run, score, durationMs };
}

/**
 * Time games rank only finished runs: a lost or timed-out run has no finish time, and deriving
 * a score from its duration would reward dying early. Points games rank every run but "quit".
 * A local multiplayer run (`players` > 1) is never ranked on the solo board.
 */
export function isRankedRun(rules: ScoringRules, endReason: EndReason | null, players = 1): boolean {
   if (endReason === "quit" || isMultiplayerRun(players)) return false;
   return rules.kind !== "time" || endReason === "win";
}

/** More than one player played the run (local multiplayer): never on the solo leaderboard. */
export function isMultiplayerRun(players: number | undefined | null): boolean {
   return typeof players === "number" && players > 1;
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function parseLevelEntry(raw: unknown): LocalLevelEntry | null {
   if (!raw || typeof raw !== "object") return null;
   const r = raw as Record<string, unknown>;
   if (!finite(r.best)) return null;
   return {
      best: r.best,
      bestDurationMs: finite(r.bestDurationMs) ? r.bestDurationMs : null,
      plays: finite(r.plays) ? r.plays : 0,
      lastPlayed: typeof r.lastPlayed === "string" ? r.lastPlayed : "",
      cleared: r.cleared === true,
   };
}

/**
 * One stored entry in today's shape (never throws): an entry from before levels gets
 * `levels: { "1": its best }`; unknown level keys and malformed level entries are dropped; `best`
 * and `bestDurationMs` are recomputed from the levels (levelTotals). null = unusable entry.
 */
export function normalizeEntry(slug: string, raw: unknown, active?: boolean): LocalScoreEntry | null {
   if (!raw || typeof raw !== "object") return null;
   const r = raw as Record<string, unknown>;
   if (!finite(r.best)) return null;
   const base: LocalScoreEntry = {
      best: r.best,
      bestDurationMs: finite(r.bestDurationMs) ? r.bestDurationMs : null,
      plays: finite(r.plays) ? r.plays : 0,
      lastPlayed: typeof r.lastPlayed === "string" ? r.lastPlayed : "",
      rank: finite(r.rank) ? r.rank : null,
   };
   const meta = getGameMeta(slug);
   if (!meta) return { ...base, ...(r.levels && typeof r.levels === "object" ? { levels: r.levels as LocalLevels } : {}) };

   const levels: LocalLevels = {};
   if (r.levels && typeof r.levels === "object") {
      for (const [key, value] of Object.entries(r.levels as Record<string, unknown>)) {
         const id = Number(key);
         const level = isLevelId(meta, id) && key === String(id) ? parseLevelEntry(value) : null;
         if (level) levels[levelKey(id as LevelId)] = level;
      }
   } else {
      // written before levels: the game's best was level 1's
      const first: LocalLevelEntry = {
         best: base.best,
         bestDurationMs: base.bestDurationMs,
         plays: base.plays,
         lastPlayed: base.lastPlayed,
         cleared: false,
      };
      first.cleared = levelEntryCleared(meta, levelMetaFor(meta, 1), first);
      levels["1"] = first;
   }
   return { ...base, levels, ...levelTotals(meta, levels, active ?? levelsActive(meta)) };
}

/** Merges a run (already normalized, its level's limits) into a game's entry. */
export function mergeRun(
   prev: LocalScoreEntry | undefined,
   run: FinishedRun,
   meta: ArcadeGameMeta,
   cleared = false,
   active: boolean = levelsActive(meta)
): { entry: LocalScoreEntry; isNewBest: boolean; newlyCleared: boolean; level: LocalLevelEntry } {
   const id = run.level ?? 1;
   const key = levelKey(id);
   const before = prev ? (normalizeEntry(meta.slug, prev, active) ?? undefined) : undefined;
   const prevLevel = before?.levels?.[key];
   const wasCleared = levelEntryCleared(meta, levelMetaFor(meta, id), prevLevel);
   const isNewBest = !prevLevel || run.score > prevLevel.best;
   const level: LocalLevelEntry = {
      best: isNewBest ? run.score : prevLevel!.best,
      bestDurationMs: isNewBest ? run.durationMs : prevLevel!.bestDurationMs,
      plays: (prevLevel?.plays ?? 0) + 1,
      lastPlayed: run.finishedAt,
      cleared: wasCleared || cleared,
   };
   const levels: LocalLevels = { ...before?.levels, [key]: level };
   return {
      isNewBest,
      newlyCleared: cleared && !wasCleared,
      level,
      entry: {
         ...levelTotals(meta, levels, active),
         plays: (before?.plays ?? 0) + 1,
         lastPlayed: run.finishedAt,
         rank: before?.rank ?? null,
         levels,
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

/** This user's entries, each normalized (normalizeEntry): never throws, never writes. */
export function readLocalScores(userId: number | null): LocalScores {
   const raw = storage()?.getItem(scoresKey(userId));
   if (!raw) return {};
   let parsed: unknown;
   try {
      parsed = JSON.parse(raw);
   } catch {
      return {};
   }
   if (!parsed || typeof parsed !== "object") return {};
   const scores: LocalScores = {};
   for (const [slug, value] of Object.entries(parsed as Record<string, unknown>)) {
      const entry = normalizeEntry(slug, value);
      if (entry) scores[slug as ArcadeSlug] = entry;
   }
   return scores;
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

/** Patches one level of a stored entry (and its rank); returns the entry with fresh totals. */
function patchLocalLevel(
   userId: number | null,
   meta: ArcadeGameMeta,
   id: LevelId,
   patch: Partial<LocalLevelEntry>,
   rank: number | null
): LocalScoreEntry | null {
   const scores = readLocalScores(userId);
   const current = scores[meta.slug];
   if (!current) return null;
   const key = levelKey(id);
   const levels: LocalLevels = { ...current.levels };
   if (levels[key]) levels[key] = { ...levels[key]!, ...patch };
   const entry: LocalScoreEntry = { ...current, levels, rank, ...levelTotals(meta, levels) };
   scores[meta.slug] = entry;
   writeLocalScores(userId, scores);
   return entry;
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
         // run-token rejections are invalid_data too; only "required" gets its own copy
         return error.reason === "required" ? "ranking-unavailable" : "rejected";
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

interface LocalSave {
   meta: ArcadeGameMeta;
   normalized: FinishedRun & { level: LevelId };
   result: SubmitResult;
}

/** The run's level, or 1 when the game does not have it. */
function runLevel(meta: ArcadeGameMeta, run: FinishedRun): LevelId {
   return run.level !== undefined && isLevelId(meta, run.level) ? run.level : 1;
}

/** Merges a run into this user's local scores (one play). */
function saveLocally(run: FinishedRun, userId: number | null): LocalSave {
   const meta = getGameMeta(run.slug);
   if (!meta) throw new Error(`Unknown arcade game: ${run.slug}`);

   const level = runLevel(meta, run);
   const levelMeta = levelMetaFor(meta, level);
   const normalized = { ...normalizeRun(run, levelMeta.scoring), level };
   const active = levelsActive(meta);
   const cleared = isLevelCleared(run.endReason ?? null, normalized.score, levelMeta);
   const scores = readLocalScores(userId);
   const prev = scores[run.slug];
   const before = levelProgress(meta, prev, active);
   const merged = mergeRun(prev, normalized, meta, cleared, active);
   scores[run.slug] = merged.entry;
   writeLocalScores(userId, scores);
   const after = levelProgress(meta, merged.entry, active);
   const next = levelsOf(meta).length > level ? ((level + 1) as LevelId) : null;
   const unlockedLevel =
      next !== null && active && !before.levels[level]?.unlocked && !!after.levels[level]?.unlocked ? next : null;

   return {
      meta,
      normalized,
      result: {
         slug: run.slug,
         score: normalized.score,
         best: merged.level.best,
         bestDurationMs: merged.level.bestDurationMs,
         isNewBest: merged.isNewBest,
         plays: merged.entry.plays,
         rank: merged.entry.rank,
         status: "saved-local",
         level,
         total: merged.entry.best,
         totalDurationMs: after.totalDurationMs,
         newlyCleared: merged.newlyCleared,
         unlockedLevel,
      },
   };
}

/**
 * Sends an already saved run to the leaderboard when the player is logged in: once, with the run's
 * ticket when it has one, otherwise without (the server decides; docs/run-tokens.md §7). Level 1
 * goes up exactly as before levels; levels 2-5 carry `level` and go up only to a server that
 * advertises features.levels (else they stay on this device: a v3 server would store them as the
 * game's best).
 */
async function sendToLeaderboard({ meta, normalized, result }: LocalSave, userId: number | null, runToken: string | null): Promise<SubmitResult> {
   if (!ARCADE_LEADERBOARD) return { ...result, status: "leaderboard-off" };
   if (!userId || !getJwtToken()) return { ...result, status: "login-required" };
   const level = normalized.level;
   if (level !== 1 && !(await serverSupportsLevels())) return { ...result, status: "saved-local" };

   try {
      const { data } = await arcadeApi.submit({
         slug: normalized.slug,
         score: normalized.score,
         duration_ms: normalized.durationMs,
         ...(level !== 1 ? { level } : {}),
         ...(runToken ? { run_token: runToken } : {}),
      });
      // a server with levels reports the level's best; an old one only the game's (= level 1's)
      const serverBest = data.level_best_score ?? (level === 1 ? data.best_score : undefined);
      const best = serverBest === undefined ? result.best : Math.max(result.best, serverBest);
      // the server does not return the best run's duration; it is only known if the local best still stands
      const bestDurationMs = best === result.best ? result.bestDurationMs : null;
      const entry = patchLocalLevel(userId, meta, level, { best, bestDurationMs }, data.rank);
      return {
         ...result,
         best,
         bestDurationMs,
         rank: data.rank,
         isNewBest: data.is_new_level_best ?? data.is_new_best,
         total: entry?.best ?? result.total,
         totalDurationMs: entry ? levelProgress(meta, entry).totalDurationMs : result.totalDurationMs,
         status: "synced",
      };
   } catch (error) {
      return { ...result, status: statusFromError(error) };
   }
}

/** runs already merged into an account's local scores, so a retry never counts a second play */
const accountSaves = new Map<string, LocalSave>();
const accountSaveKey = (userId: number, run: FinishedRun) => `${userId}|${run.slug}|${run.level ?? 1}|${run.finishedAt}`;

/**
 * Saves a finished run locally, then sends it to the leaderboard when the player is logged in.
 * `runToken`: the run's single-use ticket (memory only, never stored), or null to send without one.
 */
export async function submitScore(run: FinishedRun, userId: number | null, runToken: string | null = null): Promise<SubmitResult> {
   // a multiplayer run never reaches the solo board, whoever calls this (GameShell already skips it)
   if (isMultiplayerRun(run.players)) return unrankedResult(run.slug, userId, run.level ?? 1);
   const saved = saveLocally(run, userId);
   // a later "Save to my account" by the same user only resends (no second local play)
   if (userId) accountSaves.set(accountSaveKey(userId, run), saved);
   return sendToLeaderboard(saved, userId, runToken);
}

/**
 * Result screen: the player logged in on the spot and wants this run on their account.
 * Safe to retry (e.g. after a fresh login): the run is merged locally only once per user.
 * Pass the run's ticket only when the run was played by this same user.
 */
export function saveRunToAccount(run: FinishedRun, userId: number, runToken: string | null = null): Promise<SubmitResult> {
   if (isMultiplayerRun(run.players)) return Promise.resolve(unrankedResult(run.slug, userId, run.level ?? 1));
   const key = accountSaveKey(userId, run);
   let saved = accountSaves.get(key);
   if (!saved) {
      saved = saveLocally(run, userId);
      accountSaves.set(key, saved);
   }
   return sendToLeaderboard(saved, userId, runToken);
}

/** Result of a run that does not count (see isRankedRun): nothing is saved, the level's best is shown. */
export function unrankedResult(slug: ArcadeSlug, userId: number | null, level: LevelId = 1): SubmitResult {
   const entry = readLocalScores(userId)[slug];
   const meta = getGameMeta(slug);
   const stored = entry?.levels?.[levelKey(level)];
   return {
      slug,
      score: 0,
      best: stored?.best ?? 0,
      bestDurationMs: stored?.bestDurationMs ?? null,
      isNewBest: false,
      plays: entry?.plays ?? 0,
      rank: entry?.rank ?? null,
      status: "unranked",
      level,
      total: entry?.best ?? 0,
      totalDurationMs: meta && entry ? levelProgress(meta, entry).totalDurationMs : null,
      newlyCleared: false,
      unlockedLevel: null,
   };
}

/**
 * Replaces local bests with the server's for a logged-in user (at most every 5 minutes). The server
 * wins where it has data: its per-level bests (a server with levels) or its one best as level 1
 * (an older server); levels only this device has are kept, and so are their cleared flags.
 */
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
         const meta = getGameMeta(slug);
         const prevLevels = scores[slug as ArcadeSlug]?.levels;
         const levels: LocalLevels = { ...prevLevels };
         const take = (id: LevelId, v: { best: number; best_duration_ms: number | null; plays: number; last_played: string }) => {
            const key = levelKey(id);
            levels[key] = {
               best: v.best,
               bestDurationMs: v.best_duration_ms,
               plays: v.plays,
               lastPlayed: v.last_played,
               cleared: prevLevels?.[key]?.cleared ?? false,
            };
         };
         if (s.levels && typeof s.levels === "object") {
            for (const [key, v] of Object.entries(s.levels)) {
               const id = Number(key);
               if (v && meta && isLevelId(meta, id)) take(id, v);
            }
         } else {
            take(1, s);
         }
         const entry: LocalScoreEntry = {
            best: s.best,
            bestDurationMs: s.best_duration_ms,
            plays: s.plays,
            lastPlayed: s.last_played,
            rank: s.rank,
            levels,
         };
         scores[slug as ArcadeSlug] = (meta && normalizeEntry(slug, entry)) || entry;
      }
      writeLocalScores(userId, scores);
      session?.setItem(syncKey, String(Date.now()));
   } catch (error) {
      statusFromError(error);
   }
}
