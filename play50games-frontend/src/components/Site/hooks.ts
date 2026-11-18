"use client";

// Small client hooks for the site chrome and the hub: classic progress, local arcade scores, theme.
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAllProgress } from "@/lib/storage/progressStorage";
import { ARCADE_SCORES_EVENT, readLocalScores, scoresKey, type LocalScores } from "@/arcade3d/core/scores";
import { applyTheme, currentTheme, type ThemeChoice } from "@/lib/theme";

export const CLASSIC_TOTAL = 50;

type ProgressMap = Record<string, { completed?: unknown } | null | undefined>;

function countCompleted(progress: unknown): number {
   if (!progress || typeof progress !== "object") return 0;
   const completed = Object.values(progress as ProgressMap).filter((entry) => entry?.completed === true).length;
   return Math.min(completed, CLASSIC_TOTAL);
}

/**
 * How many classic games this visitor finished; null until the first read. Reads once, then
 * listens for "play50games_progress_loaded" (login, register, auth refresh). No polling.
 * `enabled` false reads nothing yet (the header only asks once its Classic panel opens, so the
 * arcade pages do not load classic progress on their own).
 */
export function useClassicCompleted(enabled: boolean = true): number | null {
   const [completed, setCompleted] = useState<number | null>(null);

   useEffect(() => {
      if (!enabled) return;
      let active = true;
      // once the event has delivered fresh server data, the first read must not overwrite it
      let updatedByEvent = false;

      getAllProgress()
         .then((progress) => {
            if (active && !updatedByEvent) setCompleted(countCompleted(progress));
         })
         .catch(() => {
            /* keep the neutral placeholder; the classic dashboard reports connection errors */
         });

      const onLoaded = (event: Event) => {
         const progress = (event as CustomEvent<{ progress?: unknown }>).detail?.progress;
         if (!progress) return;
         updatedByEvent = true;
         setCompleted(countCompleted(progress));
      };

      window.addEventListener("play50games_progress_loaded", onLoaded);
      return () => {
         active = false;
         window.removeEventListener("play50games_progress_loaded", onLoaded);
      };
   }, [enabled]);

   return completed;
}

/** Every local arcade score of the current user (or the guest), live on saves and other tabs. */
export function useLocalScores(): LocalScores {
   const { user } = useAuth();
   const userId = user?.id ?? null;
   const [scores, setScores] = useState<LocalScores>({});

   useEffect(() => {
      const read = () => setScores(readLocalScores(userId));
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
   }, [userId]);

   return scores;
}

/** The theme choice on <html> and a setter that applies and remembers it. */
export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
   const [choice, setChoice] = useState<ThemeChoice>("system");

   useEffect(() => {
      const sync = () => setChoice(currentTheme());
      sync();
      const observer = new MutationObserver(sync);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      return () => observer.disconnect();
   }, []);

   return [choice, applyTheme];
}
