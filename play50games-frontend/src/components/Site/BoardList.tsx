// A leaderboard as hairline rows (docs/design/DESIGN.md §4): shields for ranks 1 to 3, mono
// scores, the visitor's own row washed in coral and kept under the list when it is outside the
// rows shown. Loading, error and empty states included. Display only: the caller loads the board
// (BoardRows on the hub and /leaderboards, the game lobby in arcade3d/core/ShellOverlays).
import type { CSSProperties, ReactNode } from "react";
import type { ScoringRules } from "@/arcade3d/types";
import type { ArcadeLeaderboardEntry } from "@/lib/api/arcade";
import { formatScore } from "@/arcade3d/core/format";
import { RankShield } from "./icons";
import ui from "./ui.module.css";
import styles from "./BoardRows.module.css";

export interface BoardListProps {
   scoring: ScoringRules;
   entries: readonly ArcadeLeaderboardEntry[];
   /** the signed-in player's rank and best, also when outside `entries` */
   me: { rank: number; best_score: number } | null;
   loading: boolean;
   error: string | null;
   onRetry: () => void;
   /** what an empty board says and offers (one sentence, at most one action) */
   empty: ReactNode;
   /** rows of the loading skeleton */
   skeletonRows?: number;
   /** shorter rows, for a board inside a sheet (the game lobby) */
   dense?: boolean;
   /** draws a faint outline of the missing rows above `empty` */
   ghost?: boolean;
}

/**
 * What a polite status line says about a board (the /leaderboards page reads it out when the
 * picked game's board is loading, ready, empty or failed).
 */
export function boardStatusText(
   title: string,
   state: { loading: boolean; error: string | null; rows: number; me: boolean },
): string {
   if (state.loading) return `Loading the ${title} leaderboard.`;
   if (state.error) return `The ${title} leaderboard did not load.`;
   if (state.rows === 0 && !state.me) return `${title}: no scores yet.`;
   return `${title} leaderboard, ${state.rows} ${state.rows === 1 ? "row" : "rows"}.`;
}

export const rankText = (rank: number): string => `#${String(rank).padStart(2, "0")}`;

/**
 * The own row under the list has no finish time (the API sends the rank and the score only), so a
 * time game shows its score there, as points: its unit label ("time") belongs to a duration.
 */
export const ownScoreText = (score: number, scoring: ScoringRules): string =>
   formatScore(score, { ...scoring, display: "int", unitLabel: scoring.kind === "time" ? "pts" : scoring.unitLabel });

const GHOST_ROWS = [1, 2, 3];

export default function BoardList({
   scoring,
   entries,
   me,
   loading,
   error,
   onRetry,
   empty,
   skeletonRows = 5,
   dense = false,
   ghost = false,
}: BoardListProps) {
   const rows = dense ? `${styles.rows} ${styles.dense}` : styles.rows;

   if (loading) {
      return (
         <ol className={rows} aria-busy="true" aria-label="Loading the leaderboard">
            {Array.from({ length: skeletonRows }, (_, index) => (
               <li key={index} className={`${styles.row} ${styles.skeleton}`}>
                  <span className={styles.skBox} />
                  <span className={styles.skLine} />
                  <span className={styles.skScore} />
               </li>
            ))}
         </ol>
      );
   }

   if (error) {
      return (
         <div className={styles.notice} role="status">
            <p>{error}</p>
            <button type="button" className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm}`} onClick={onRetry}>
               Try again
            </button>
         </div>
      );
   }

   const meListed = entries.some((entry) => entry.is_me);

   if (entries.length === 0 && !me) {
      if (!ghost) return <div className={styles.notice}>{empty}</div>;
      return (
         <div className={styles.empty}>
            <ol className={`${rows} ${styles.ghost}`} aria-hidden="true">
               {GHOST_ROWS.map((rank) => (
                  <li key={rank} className={styles.row}>
                     <RankShield rank={rank} className={styles.shield} />
                     <span className={styles.ghostLine} />
                     <span className={styles.ghostScore} />
                  </li>
               ))}
            </ol>
            <div className={styles.emptyText}>{empty}</div>
         </div>
      );
   }

   return (
      <ol className={rows}>
         {entries.map((entry, index) => (
            <li
               key={`${entry.rank}-${entry.name}-${index}`}
               className={entry.is_me ? `${styles.row} ${styles.you}` : styles.row}
               style={{ "--i": Math.min(index, 10) } as CSSProperties}
            >
               {entry.rank <= 3 ? (
                  <RankShield
                     rank={entry.rank}
                     className={entry.rank === 1 ? `${styles.shield} ${styles.first}` : styles.shield}
                  />
               ) : (
                  <span className={styles.rank}>{rankText(entry.rank)}</span>
               )}
               <span className={styles.who}>{entry.is_me ? "You" : entry.name}</span>
               <span className={styles.score}>{formatScore(entry.score, scoring, entry.duration_ms)}</span>
            </li>
         ))}
         {me && !meListed ? (
            <li
               className={`${styles.row} ${styles.you} ${styles.outside}`}
               style={{ "--i": Math.min(entries.length, 10) } as CSSProperties}
            >
               <span className={styles.rank}>{rankText(me.rank)}</span>
               <span className={styles.who}>You</span>
               <span className={styles.score}>{ownScoreText(me.best_score, scoring)}</span>
            </li>
         ) : null}
      </ol>
   );
}
