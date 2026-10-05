"use client";

import type { ScoringRules } from "../types";
import type { ArcadeLeaderboardEntry } from "@/lib/api/arcade";
import { formatScore } from "../core/format";
import styles from "./LeaderboardTable.module.css";

export interface LeaderboardTableProps {
   entries: ArcadeLeaderboardEntry[];
   /** the logged-in player's rank, also when outside the shown entries */
   me: { rank: number; best_score: number } | null;
   loading: boolean;
   error: string | null;
   scoring: ScoringRules;
   onRetry?: () => void;
}

function formatPlayed(iso: string): string {
   const date = new Date(iso);
   if (Number.isNaN(date.getTime())) return "";
   return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
   }).format(date);
}

export default function LeaderboardTable({ entries, me, loading, error, scoring, onRetry }: LeaderboardTableProps) {
   if (loading) {
      return (
         <p className={styles.state} role="status">
            Loading leaderboard…
         </p>
      );
   }

   if (error) {
      return (
         <div className={styles.state} role="alert">
            <p className={styles.errorText}>{error}</p>
            {onRetry ? (
               <button type="button" className={styles.retry} onClick={onRetry}>
                  Retry
               </button>
            ) : null}
         </div>
      );
   }

   const meShown = me != null && entries.some((entry) => entry.is_me || entry.rank === me.rank);
   if (entries.length === 0 && me == null) {
      return <p className={styles.state}>Be the first on the leaderboard.</p>;
   }

   return (
      <div className={styles.wrap}>
         <table className={styles.table}>
            <caption className={styles.caption}>Leaderboard</caption>
            <thead>
               <tr>
                  <th className={styles.rank} scope="col">
                     Rank
                  </th>
                  <th className={styles.name} scope="col">
                     Name
                  </th>
                  <th className={styles.score} scope="col">
                     Score
                  </th>
                  <th className={styles.date} scope="col">
                     Date
                  </th>
               </tr>
            </thead>
            {entries.length > 0 ? (
               <tbody>
                  {entries.map((entry) => {
                     const mine = entry.is_me || (me != null && entry.rank === me.rank);
                     return (
                        <tr key={entry.rank} className={mine ? styles.me : undefined}>
                           <th className={styles.rank} scope="row">
                              {entry.rank}
                           </th>
                           <td className={styles.name}>
                              {entry.name}
                              {mine ? <span className={styles.sr}> (you)</span> : null}
                           </td>
                           <td className={styles.score}>{formatScore(entry.score, scoring, entry.duration_ms)}</td>
                           <td className={styles.date}>{formatPlayed(entry.achieved_at)}</td>
                        </tr>
                     );
                  })}
               </tbody>
            ) : null}
            {me && !meShown ? (
               <tbody className={styles.youBody}>
                  <tr className={styles.me}>
                     <th className={styles.rank} scope="row">
                        {me.rank}
                     </th>
                     <td className={styles.name}>You</td>
                     <td className={styles.score}>{formatScore(me.best_score, scoring)}</td>
                     <td className={styles.date}>—</td>
                  </tr>
               </tbody>
            ) : null}
         </table>
      </div>
   );
}
