// Client for the WordPress 3D Arcade API (play50/v1/arcade/*). Contract: docs/arcade-api.md.
// Wire format is snake_case, like the rest of the WordPress API.
import type { ArcadeSlug, LevelId, LevelKey } from "@/arcade3d/types";
import { ARCADE_API_MOCK } from "@/arcade3d/flags";
import { getApiBase } from "./apiBase";
import { getApiHeaders } from "./apiUtils";

export type ArcadeApiErrorCode =
   | "api_key"
   | "unauthorized"
   | "banned"
   | "rate_limited"
   | "invalid_data"
   | "not_found"
   | "network"
   | "server";

export class ArcadeApiError extends Error {
   /**
    * `reason`: the server's fixed `data.reason` for a run-token rejection (`required`, `malformed`,
    * `signature`, `expired`, `elapsed`, `used`; docs/arcade-api.md §7a), else null.
    */
   constructor(
      public code: ArcadeApiErrorCode,
      message: string,
      public status: number | null = null,
      public reason: string | null = null
   ) {
      super(message);
      this.name = "ArcadeApiError";
   }
}

export interface ArcadeLeaderboardEntry {
   rank: number;
   name: string;
   score: number;
   duration_ms: number | null;
   achieved_at: string;
   is_me?: boolean;
}

export interface ArcadeLeaderboard {
   slug: ArcadeSlug;
   entries: ArcadeLeaderboardEntry[];
   me: { rank: number; best_score: number } | null;
}

/** One level's best in GET /arcade/me (a server with levels only; only scored levels). */
export interface ArcadeMeLevelEntry {
   best: number;
   best_duration_ms: number | null;
   plays: number;
   last_played: string;
}

export interface ArcadeMeEntry {
   /** the board value: the total over the levels on a server with levels, else the one best */
   best: number;
   best_duration_ms: number | null;
   plays: number;
   last_played: string;
   rank: number | null;
   /** a server with levels (features.levels): the per-level bests, keys "1".."5" */
   levels?: Partial<Record<LevelKey, ArcadeMeLevelEntry>>;
}

export interface ArcadeSubmitBody {
   slug: ArcadeSlug;
   score: number;
   duration_ms: number;
   /**
    * The level played (docs/arcade-levels.md §4.3). Sent only for levels 2-5 and only to a server
    * that advertises `features.levels`; level 1 omits it, so its payload is exactly the old one.
    */
   level?: LevelId;
   /** the run's single-use ticket from startRun(), when one arrived in time (docs/run-tokens.md) */
   run_token?: string;
}

/** POST /arcade/runs/start: an opaque single-use ticket for one run of one game by this user. */
export interface ArcadeRunStart {
   run_token: string;
}

export interface ArcadeSubmitResponse {
   success: true;
   data: {
      slug: ArcadeSlug;
      score: number;
      best_score: number;
      is_new_best: boolean;
      plays: number;
      rank: number;
      /** a server with levels: the level played, its best and whether this run raised it */
      level?: LevelId;
      level_best_score?: number;
      is_new_level_best?: boolean;
   };
}

/** One game's limits in GET /arcade/games (snake_case, docs/arcade-api.md §6.1). */
export interface ArcadeServerGame {
   title?: string;
   kind?: "points" | "time";
   max_score?: number;
   enabled?: boolean;
   [key: string]: unknown;
}

/** GET /arcade/games. `features.levels: true` = the server knows levels (docs/arcade-levels.md §4.1). */
export interface ArcadeGamesResponse {
   games: Record<string, ArcadeServerGame>;
   run_tokens?: { mode: "optional" | "required"; ready: boolean };
   features?: { levels?: boolean };
}

/** `hide_name: true` = leaderboards show the player as "Anonymous" (the score stays ranked). */
export interface ArcadePrivacy {
   hide_name: boolean;
}

export interface ArcadeApiClient {
   /**
    * JWT only. An older server answers 404 (no route): the run then submits without a ticket.
    * `level` 2-5 binds the ticket to that level (sent only then; level 1 sends `{ slug }` as before).
    */
   startRun(slug: ArcadeSlug, level?: LevelId): Promise<ArcadeRunStart>;
   /** GET /arcade/games: limits per game, run-token mode and the server's features */
   games(): Promise<ArcadeGamesResponse>;
   submit(body: ArcadeSubmitBody): Promise<ArcadeSubmitResponse>;
   leaderboard(slug: ArcadeSlug, limit?: number): Promise<ArcadeLeaderboard>;
   me(): Promise<Partial<Record<ArcadeSlug, ArcadeMeEntry>>>;
   getPrivacy(): Promise<ArcadePrivacy>;
   setPrivacy(hideName: boolean): Promise<ArcadePrivacy>;
}

/** Maps a WordPress WP_Error `code` to our error codes. Uses body.code, never the HTTP status alone. */
export function mapErrorCode(code: string | undefined, status: number): ArcadeApiErrorCode {
   switch (code) {
      case "missing_api_key":
      case "invalid_api_key":
         return "api_key";
      case "unauthorized":
         return "unauthorized";
      case "forbidden":
         return "banned";
      case "rate_limited":
         return "rate_limited";
      case "invalid_data":
         return "invalid_data";
      case "not_found":
         return "not_found";
      default:
         return status === 404 ? "not_found" : "server";
   }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
   let response: Response;
   try {
      response = await fetch(`${getApiBase()}${path}`, {
         ...init,
         headers: getApiHeaders(),
      });
   } catch {
      throw new ArcadeApiError("network", "Network error");
   }

   let body: any = null;
   try {
      body = await response.json();
   } catch {
      // empty or non-JSON body
   }

   if (!response.ok) {
      const reason = body?.data?.reason;
      throw new ArcadeApiError(
         mapErrorCode(body?.code, response.status),
         body?.message || `HTTP ${response.status}`,
         response.status,
         typeof reason === "string" ? reason : null
      );
   }
   return body as T;
}

/** A ticket is opaque to the client; this only keeps junk (an HTML page, a huge string) out of the submit. */
export function isRunToken(value: unknown): value is string {
   return typeof value === "string" && value.length > 0 && value.length <= 256 && /^[\x21-\x7e]+$/.test(value);
}

const realClient: ArcadeApiClient = {
   startRun: async (slug, level) => {
      const body = await request<Partial<ArcadeRunStart> | null>("/arcade/runs/start", {
         method: "POST",
         body: JSON.stringify(level && level !== 1 ? { slug, level } : { slug }),
      });
      const token = body?.run_token;
      if (!isRunToken(token)) throw new ArcadeApiError("server", "Invalid run start response", 200);
      return { run_token: token };
   },
   games: () => request<ArcadeGamesResponse>("/arcade/games"),
   submit: (body) =>
      request<ArcadeSubmitResponse>("/arcade/scores", { method: "POST", body: JSON.stringify(body) }),
   leaderboard: (slug, limit = 10) =>
      request<ArcadeLeaderboard>(`/arcade/leaderboard/${slug}?limit=${limit}`),
   me: () => request<Partial<Record<ArcadeSlug, ArcadeMeEntry>>>("/arcade/me"),
   getPrivacy: () => request<ArcadePrivacy>("/arcade/me/privacy"),
   setPrivacy: (hideName) =>
      request<ArcadePrivacy>("/arcade/me/privacy", {
         method: "POST",
         body: JSON.stringify({ hide_name: hideName }),
      }),
};

// ---------- mock (NEXT_PUBLIC_ARCADE_API_MOCK=1) ----------

const isMockLevel = (value: unknown): value is LevelId =>
   typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;

const MOCK_NAMES = ["Ana K.", "Blerim D.", "Drita M.", "Ermal S.", "Fjolla R.", "Gent H.", "Hana L."];

export interface MockArcadeOptions {
   /** like the server's PLAY50_ARCADE_REQUIRE_RUN_TOKEN: reject submits without a ticket */
   requireRunToken?: boolean;
}

/**
 * In-memory stand-in for the WordPress API (dev only, and tests). Run tickets: issued per start and
 * claimed once for their own game and level. Like the server with enforcement off, a missing or
 * failed ticket is accepted unless `requireRunToken`, which rejects it with the server's reason.
 * Levels like a v4 server (`features.levels`): bests are kept per game and level, the board value
 * (`best_score`, the leaderboard, `me().best`) is the sum of the level bests.
 */
export function createMockArcadeClient(options: MockArcadeOptions = {}): ArcadeApiClient {
   type MockBest = { score: number; duration_ms: number; plays: number; at: string };
   const mockLevels = new Map<ArcadeSlug, Map<LevelId, MockBest>>();
   const tickets = new Map<string, { slug: ArcadeSlug; level: LevelId; used: boolean }>();
   let ticketCount = 0;
   let mockHideName = false;

   /** the board row: the sum of the level bests (and durations), the plays over all levels */
   const totalOf = (slug: ArcadeSlug): MockBest | null => {
      const levels = mockLevels.get(slug);
      if (!levels || levels.size === 0) return null;
      let score = 0;
      let duration_ms = 0;
      let plays = 0;
      let at = "";
      levels.forEach((l) => {
         score += l.score;
         duration_ms += l.duration_ms;
         plays += l.plays;
         if (l.at > at) at = l.at;
      });
      return { score, duration_ms, plays, at };
   };

   const ticketError = (reason: string) =>
      new ArcadeApiError("invalid_data", "This run could not be verified. Play again to rank.", 400, reason);

   return {
      async games() {
         return {
            games: {},
            run_tokens: { mode: options.requireRunToken ? "required" : "optional", ready: true },
            features: { levels: true },
         };
      },
      async startRun(slug, level = 1) {
         if (!isMockLevel(level)) throw new ArcadeApiError("invalid_data", "Unknown level.", 400);
         ticketCount += 1;
         const run_token = `mock.${ticketCount}.${Math.random().toString(16).slice(2, 10)}`;
         tickets.set(run_token, { slug, level, used: false });
         return { run_token };
      },
      async submit(body) {
         const level = body.level ?? 1;
         if (!isMockLevel(level)) throw new ArcadeApiError("invalid_data", "Unknown level.", 400);
         // like the server: a valid ticket is claimed once; a failed one rejects only when required
         if (body.run_token === undefined) {
            if (options.requireRunToken) throw ticketError("required");
         } else {
            const ticket = tickets.get(body.run_token);
            const failure = !ticket || ticket.slug !== body.slug || ticket.level !== level ? "signature" : ticket.used ? "used" : null;
            if (failure && options.requireRunToken) throw ticketError(failure);
            if (ticket && !failure) ticket.used = true;
         }
         const levels = mockLevels.get(body.slug) ?? new Map<LevelId, MockBest>();
         mockLevels.set(body.slug, levels);
         const prev = levels.get(level);
         const isNewBest = !prev || body.score > prev.score;
         const levelPlays = (prev?.plays ?? 0) + 1;
         levels.set(
            level,
            isNewBest
               ? { score: body.score, duration_ms: body.duration_ms, plays: levelPlays, at: new Date().toISOString() }
               : { ...prev!, plays: levelPlays }
         );
         const total = totalOf(body.slug)!;
         return {
            success: true,
            data: {
               slug: body.slug,
               score: body.score,
               best_score: total.score,
               is_new_best: isNewBest,
               plays: total.plays,
               rank: 1 + MOCK_NAMES.filter((_n, i) => 1000 - i * 120 > total.score).length,
               level,
               level_best_score: levels.get(level)!.score,
               is_new_level_best: isNewBest,
            },
         };
      },
      async leaderboard(slug, limit = 10) {
         const entries: ArcadeLeaderboardEntry[] = MOCK_NAMES.map((name, i) => ({
            rank: 0,
            name,
            score: 1000 - i * 120,
            duration_ms: 30000 + i * 1500,
            achieved_at: new Date(Date.UTC(2026, 9, 1 + i)).toISOString(),
         }));
         const mine = totalOf(slug);
         if (mine) {
            entries.push({ rank: 0, name: mockHideName ? "Anonymous" : "You", score: mine.score, duration_ms: mine.duration_ms, achieved_at: mine.at, is_me: true });
         }
         entries.sort((a, b) => b.score - a.score).forEach((e, i) => (e.rank = i + 1));
         const me = entries.find((e) => e.is_me);
         return {
            slug,
            entries: entries.slice(0, limit),
            me: me ? { rank: me.rank, best_score: me.score } : null,
         };
      },
      async me() {
         const out: Partial<Record<ArcadeSlug, ArcadeMeEntry>> = {};
         mockLevels.forEach((levels, slug) => {
            const v = totalOf(slug)!;
            const perLevel: Partial<Record<LevelKey, ArcadeMeLevelEntry>> = {};
            levels.forEach((l, id) => {
               perLevel[`${id}` as LevelKey] = { best: l.score, best_duration_ms: l.duration_ms, plays: l.plays, last_played: l.at };
            });
            out[slug] = { best: v.score, best_duration_ms: v.duration_ms, plays: v.plays, last_played: v.at, rank: null, levels: perLevel };
         });
         return out;
      },
      async getPrivacy() {
         return { hide_name: mockHideName };
      },
      async setPrivacy(hideName) {
         mockHideName = hideName;
         return { hide_name: mockHideName };
      },
   };
}

const mockClient = createMockArcadeClient();

export const arcadeApi: ArcadeApiClient = ARCADE_API_MOCK ? mockClient : realClient;
