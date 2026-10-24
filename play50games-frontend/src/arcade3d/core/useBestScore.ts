"use client";

import { useEffect, useMemo, useState } from "react";
import type { ArcadeGameMeta, ArcadeSlug } from "../types";
import { useAuth } from "@/contexts/AuthContext";
import { ARCADE_SCORES_EVENT, readLocalScores, scoresKey, type LocalScoreEntry } from "./scores";
import { levelProgress, type LevelProgressSummary } from "./levelProgress";

/** This user's (or the guest's) normalized local entry for one game, live on saves and other tabs. */
function useLocalEntry(slug: ArcadeSlug): LocalScoreEntry | null {
   const { user } = useAuth();
   const userId = user?.id ?? null;
   const [entry, setEntry] = useState<LocalScoreEntry | null>(null);

   useEffect(() => {
      const read = () => setEntry(readLocalScores(userId)[slug] ?? null);
      const onStorage = (event: StorageEvent) => {
         if (event.key === scoresKey(userId)) read();
      };
      read();
      window.addEventListener(ARCADE_SCORES_EVENT, read);
      window.addEventListener("storage", onStorage);
      return () => {
         window.removeEventListener(ARCADE_SCORES_EVENT, read);
         window.removeEventListener("storage", onStorage);
      };
   }, [slug, userId]);

   return entry;
}

/**
 * Best local score for one game, for the current user (or guest). Updates live. `best` is the
 * game's total for a game whose levels are on (core/levels.ts levelTotals), else its one best.
 */
export function useBestScore(slug: ArcadeSlug): LocalScoreEntry | null {
   return useLocalEntry(slug);
}

/** The level tiles' data for one game (core/levelProgress.ts), live like useBestScore. */
export function useLevelProgress(meta: ArcadeGameMeta, active?: boolean): LevelProgressSummary {
   const entry = useLocalEntry(meta.slug);
   return useMemo(() => levelProgress(meta, entry, active), [meta, entry, active]);
}
