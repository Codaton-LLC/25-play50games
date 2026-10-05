// Client for the WordPress 3D Arcade API (play50/v1/arcade/*). Contract: docs/arcade-api.md.
// Wire format is snake_case, like the rest of the WordPress API.
import type { ArcadeSlug } from "@/arcade3d/types";
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
   constructor(public code: ArcadeApiErrorCode, message: string, public status: number | null = null) {
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

export interface ArcadeMeEntry {
   best: number;
   best_duration_ms: number | null;
   plays: number;
   last_played: string;
   rank: number | null;
}

export interface ArcadeSubmitBody {
   slug: ArcadeSlug;
   score: number;
   duration_ms: number;
   run_token?: string;
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
   };
}

export interface ArcadeApiClient {
   submit(body: ArcadeSubmitBody): Promise<ArcadeSubmitResponse>;
   leaderboard(slug: ArcadeSlug, limit?: number): Promise<ArcadeLeaderboard>;
   me(): Promise<Partial<Record<ArcadeSlug, ArcadeMeEntry>>>;
   setPrivacy(hideName: boolean): Promise<{ hide_name: boolean }>;
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
      throw new ArcadeApiError(
         mapErrorCode(body?.code, response.status),
         body?.message || `HTTP ${response.status}`,
         response.status
      );
   }
   return body as T;
}

const realClient: ArcadeApiClient = {
   submit: (body) =>
      request<ArcadeSubmitResponse>("/arcade/scores", { method: "POST", body: JSON.stringify(body) }),
   leaderboard: (slug, limit = 10) =>
      request<ArcadeLeaderboard>(`/arcade/leaderboard/${slug}?limit=${limit}`),
   me: () => request<Partial<Record<ArcadeSlug, ArcadeMeEntry>>>("/arcade/me"),
   setPrivacy: (hideName) =>
      request<{ hide_name: boolean }>("/arcade/me/privacy", {
         method: "POST",
         body: JSON.stringify({ hide_name: hideName }),
      }),
};

// ---------- mock (NEXT_PUBLIC_ARCADE_API_MOCK=1) ----------

const MOCK_NAMES = ["Ana K.", "Blerim D.", "Drita M.", "Ermal S.", "Fjolla R.", "Gent H.", "Hana L."];
const mockBest = new Map<ArcadeSlug, { score: number; duration_ms: number; plays: number; at: string }>();

const mockClient: ArcadeApiClient = {
   async submit(body) {
      const prev = mockBest.get(body.slug);
      const isNewBest = !prev || body.score > prev.score;
      const plays = (prev?.plays ?? 0) + 1;
      const best = isNewBest
         ? { score: body.score, duration_ms: body.duration_ms, plays, at: new Date().toISOString() }
         : { ...prev!, plays };
      mockBest.set(body.slug, best);
      return {
         success: true,
         data: {
            slug: body.slug,
            score: body.score,
            best_score: best.score,
            is_new_best: isNewBest,
            plays,
            rank: 1 + MOCK_NAMES.filter((_n, i) => 1000 - i * 120 > best.score).length,
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
      const mine = mockBest.get(slug);
      if (mine) {
         entries.push({ rank: 0, name: "You", score: mine.score, duration_ms: mine.duration_ms, achieved_at: mine.at, is_me: true });
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
      mockBest.forEach((v, slug) => {
         out[slug] = { best: v.score, best_duration_ms: v.duration_ms, plays: v.plays, last_played: v.at, rank: null };
      });
      return out;
   },
   async setPrivacy(hideName) {
      return { hide_name: hideName };
   },
};

export const arcadeApi: ArcadeApiClient = ARCADE_API_MOCK ? mockClient : realClient;
