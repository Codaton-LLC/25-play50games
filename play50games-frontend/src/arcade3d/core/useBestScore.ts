"use client";

import { useEffect, useState } from "react";
import type { ArcadeSlug } from "../types";
import { useAuth } from "@/contexts/AuthContext";
import { ARCADE_SCORES_EVENT, readLocalScores, scoresKey, type LocalScoreEntry } from "./scores";

/** Best local score for one game, for the current user (or guest). Updates live. */
export function useBestScore(slug: ArcadeSlug): LocalScoreEntry | null {
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
