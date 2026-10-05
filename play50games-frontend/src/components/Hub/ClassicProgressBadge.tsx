"use client";

// Shows the visitor's classic progress ("X / 50 completed") on the hub.
// Reads progress once on mount and then only listens for "play50games_progress_loaded"
// (fired after login/register and auth refresh). No polling.
import { useEffect, useState } from "react";
import { getAllProgress } from "@/lib/storage/progressStorage";
import styles from "./ClassicProgressBadge.module.css";

const TOTAL_GAMES = 50;

type ProgressMap = Record<string, { completed?: unknown } | null | undefined>;

function countCompleted(progress: unknown): number {
   if (!progress || typeof progress !== "object") return 0;
   const completed = Object.values(progress as ProgressMap).filter(
      (entry) => entry?.completed === true
   ).length;
   return Math.min(completed, TOTAL_GAMES);
}

export default function ClassicProgressBadge() {
   const [completed, setCompleted] = useState<number | null>(null);

   useEffect(() => {
      let active = true;
      // Once the event has delivered fresh server data, the initial read must not overwrite it.
      let updatedByEvent = false;

      getAllProgress()
         .then((progress) => {
            if (active && !updatedByEvent) setCompleted(countCompleted(progress));
         })
         .catch(() => {
            // Keep the neutral placeholder; the dashboard itself reports connection errors.
         });

      const handleProgressLoaded = (event: Event) => {
         const progress = (event as CustomEvent<{ progress?: unknown }>).detail?.progress;
         if (!progress) return;
         updatedByEvent = true;
         setCompleted(countCompleted(progress));
      };

      window.addEventListener("play50games_progress_loaded", handleProgressLoaded);
      return () => {
         active = false;
         window.removeEventListener("play50games_progress_loaded", handleProgressLoaded);
      };
   }, []);

   if (completed === null) {
      return (
         <div className={`${styles.badge} ${styles.pending}`} aria-busy="true">
            <span className={styles.label}>Your progress</span>
            <span className={styles.value}>– / {TOTAL_GAMES} completed</span>
            <span className={styles.track} aria-hidden="true" />
         </div>
      );
   }

   const percent = Math.round((completed / TOTAL_GAMES) * 100);

   return (
      <div className={styles.badge}>
         <span className={styles.label}>Your progress</span>
         <span className={styles.value}>
            {completed} / {TOTAL_GAMES} completed
         </span>
         <span className={styles.track} aria-hidden="true">
            <span className={styles.fill} style={{ width: `${percent}%` }} />
         </span>
      </div>
   );
}
