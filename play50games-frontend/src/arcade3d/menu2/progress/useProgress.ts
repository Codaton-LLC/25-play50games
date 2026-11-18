"use client";

// The current user's Menu 2 progress, live: re-read on this tab's PROGRESS_EVENT and on another tab's
// storage event. The first render (and the server) sees empty progress, so hydration matches.
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { emptyProgress, type ProgressData } from "./progress";
import { PROGRESS_EVENT, loadProgress, progressKey } from "./progressStore";

export function useProgress(): { data: ProgressData; userId: number | null; loaded: boolean } {
   const { user } = useAuth();
   const userId = user?.id ?? null;
   const [state, setState] = useState<{ data: ProgressData; loaded: boolean }>(() => ({ data: emptyProgress(), loaded: false }));
   useEffect(() => {
      const read = () => setState({ data: loadProgress(userId), loaded: true });
      read();
      const onStorage = (e: StorageEvent) => {
         if (e.key === progressKey(userId)) read();
      };
      window.addEventListener(PROGRESS_EVENT, read);
      window.addEventListener("storage", onStorage);
      return () => {
         window.removeEventListener(PROGRESS_EVENT, read);
         window.removeEventListener("storage", onStorage);
      };
   }, [userId]);
   return { data: state.data, userId, loaded: state.loaded };
}
