"use client";

// One game's leaderboard as hairline rows (docs/design/DESIGN.md §4): shields for ranks 1 to 3,
// mono scores, the visitor's own row washed in coral. Loading, error and empty states included.
import type { CSSProperties } from "react";
import Link from "next/link";
import type { ArcadeGameMeta } from "@/arcade3d/types";
import { useAuth } from "@/contexts/AuthContext";
import { useLeaderboard } from "@/arcade3d/core/useLeaderboard";
import { formatScore } from "@/arcade3d/core/format";
import { RankShield } from "./icons";
import ui from "./ui.module.css";
import styles from "./BoardRows.module.css";

export interface BoardRowsProps {
   game: ArcadeGameMeta;
   /** rows to load (the API clamps to 1..50) */
   limit: number;
}

const rankText = (rank: number): string => `#${String(rank).padStart(2, "0")}`;

export default function BoardRows({ game, limit }: BoardRowsProps) {
   const { user } = useAuth();
   const board = useLeaderboard(game.slug, { limit, refreshKey: user?.id ?? null });

   if (!board.enabled) return null;

   if (board.loading) {
      return (
         <ol className={styles.rows} aria-busy="true" aria-label="Loading the leaderboard">
            {Array.from({ length: Math.min(limit, 5) }, (_, index) => (
               <li key={index} className={`${styles.row} ${styles.skeleton}`}>
                  <span className={styles.skBox} />
                  <span className={styles.skLine} />
                  <span className={styles.skScore} />
               </li>
            ))}
         </ol>
      );
   }

   if (board.error) {
      return (
         <div className={styles.notice} role="status">
            <p>{board.error}</p>
            <button type="button" className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm}`} onClick={board.retry}>
               Try again
            </button>
         </div>
      );
   }

   const entries = board.data?.entries ?? [];
   if (entries.length === 0) {
      return (
         <div className={styles.notice}>
            <p>No scores yet. Play one round to take first place.</p>
            <Link href={`/3d/${game.slug}`} className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm}`}>
               Play {game.title}
            </Link>
         </div>
      );
   }

   const me = board.data?.me ?? null;
   const meListed = entries.some((entry) => entry.is_me);

   return (
      <ol className={styles.rows}>
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
               <span className={styles.score}>{formatScore(entry.score, game.scoring, entry.duration_ms)}</span>
            </li>
         ))}
         {me && !meListed ? (
            <li className={`${styles.row} ${styles.you}`}>
               <span className={styles.rank}>{rankText(me.rank)}</span>
               <span className={styles.who}>You</span>
               <span className={styles.score}>{formatScore(me.best_score, { ...game.scoring, display: "int" })}</span>
            </li>
         ) : null}
      </ol>
   );
}
