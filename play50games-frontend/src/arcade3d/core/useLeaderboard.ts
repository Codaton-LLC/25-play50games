"use client";

// Top-N leaderboard for one game. Disabled (no request at all) while the
// NEXT_PUBLIC_ARCADE_LEADERBOARD flag is off; with NEXT_PUBLIC_ARCADE_API_MOCK on,
// arcadeApi is the in-memory mock, so this works without WordPress.
import { useCallback, useEffect, useState } from "react";
import type { ArcadeSlug } from "../types";
import { ARCADE_LEADERBOARD } from "../flags";
import { arcadeApi, ArcadeApiError, type ArcadeLeaderboard } from "@/lib/api/arcade";

export interface LeaderboardState {
   /** false when the leaderboard flag is off: render nothing */
   enabled: boolean;
   data: ArcadeLeaderboard | null;
   loading: boolean;
   /** user-facing message, or null */
   error: string | null;
   /** reload (also after a submit, to show the new rank) */
   retry: () => void;
}

export interface UseLeaderboardOptions {
   /** rows to load (the API clamps to 1..50); default 10 */
   limit?: number;
   /** change it to reload, e.g. the user id after a login */
   refreshKey?: string | number | null;
}

const noop = () => {};

function messageFor(error: unknown): string {
   if (error instanceof ArcadeApiError) {
      if (error.code === "network") return "You are offline. The leaderboard will load when you are back online.";
      if (error.code === "not_found") return "This leaderboard is not open yet.";
   }
   return "The leaderboard could not be loaded.";
}

export function useLeaderboard(slug: ArcadeSlug, options: UseLeaderboardOptions = {}): LeaderboardState {
   const { limit = 10, refreshKey = null } = options;
   const [data, setData] = useState<ArcadeLeaderboard | null>(null);
   const [loading, setLoading] = useState(ARCADE_LEADERBOARD);
   const [error, setError] = useState<string | null>(null);
   const [attempt, setAttempt] = useState(0);

   useEffect(() => {
      if (!ARCADE_LEADERBOARD) return;
      let cancelled = false;
      setLoading(true);
      setError(null);
      arcadeApi
         .leaderboard(slug, limit)
         .then((result) => {
            if (cancelled) return;
            setData(result);
            setLoading(false);
         })
         .catch((err: unknown) => {
            if (cancelled) return;
            setError(messageFor(err));
            setLoading(false);
         });
      return () => {
         cancelled = true;
      };
   }, [slug, limit, refreshKey, attempt]);

   const retry = useCallback(() => setAttempt((n) => n + 1), []);

   if (!ARCADE_LEADERBOARD) return { enabled: false, data: null, loading: false, error: null, retry: noop };
   return { enabled: true, data, loading, error, retry };
}
