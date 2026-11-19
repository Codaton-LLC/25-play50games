"use client";

// The game list on the left, the chosen game's board on the right (docs/design/DESIGN.md §6).
// On phones the list becomes a row of chips above the board.
import { useState } from "react";
import Link from "next/link";
import type { ArcadeGameMeta } from "@/arcade3d/types";
import BoardRows from "@/components/Site/BoardRows";
import { PlayIcon } from "@/components/Site/icons";
import ui from "@/components/Site/ui.module.css";
import styles from "./page.module.css";

export interface LeaderboardsViewProps {
   /** the live games, in arcade order */
   games: ArcadeGameMeta[];
}

const ROWS = 20;

export default function LeaderboardsView({ games }: LeaderboardsViewProps) {
   const [slug, setSlug] = useState(games[0]?.slug);
   // the picked board's state, read out from a line that stays mounted while boards change
   const [status, setStatus] = useState("");
   const game = games.find((item) => item.slug === slug) ?? games[0];

   if (!game) {
      return <p className={styles.lead}>No game is live yet. The first leaderboard opens with the first game.</p>;
   }

   return (
      <div className={styles.view}>
         <div className={styles.list} role="group" aria-label="Games">
            {games.map((item) => (
               <button
                  key={item.slug}
                  type="button"
                  className={styles.game}
                  aria-pressed={item.slug === game.slug}
                  onClick={() => setSlug(item.slug)}
               >
                  {item.thumbnail ? (
                     // eslint-disable-next-line @next/next/no-img-element
                     <img src={item.thumbnail} alt="" loading="lazy" />
                  ) : (
                     <span className={styles.noArt} />
                  )}
                  <span className={styles.gameTitle}>{item.title}</span>
               </button>
            ))}
         </div>

         <section className={styles.board} aria-labelledby="board-title">
            <div className={styles.boardHead}>
               <div>
                  <h2 id="board-title" className={ui.h2}>
                     {game.title}
                  </h2>
                  <p className={ui.secNote}>
                     {game.scoring.kind === "time" ? "Fastest times first" : "Highest scores first"}, top {ROWS}
                  </p>
               </div>
               <Link href={`/3d/${game.slug}`} className={`${ui.btn} ${ui.btnPrimary} ${ui.btnSm}`}>
                  <PlayIcon />
                  Play
               </Link>
            </div>
            <BoardRows key={game.slug} game={game} limit={ROWS} onStatus={setStatus} />
            <p className={ui.srOnly} role="status">
               {status}
            </p>
         </section>
      </div>
   );
}
