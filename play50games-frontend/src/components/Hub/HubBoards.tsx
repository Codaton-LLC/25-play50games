"use client";

// "Top of the boards" on the hub: the real leaderboard of one game at a time (chips switch the
// game), beside the visitor's own best scores. Rendered only with the leaderboard flag on.
import { useState } from "react";
import Link from "next/link";
import type { ArcadeGameMeta } from "@/arcade3d/types";
import { useAuth } from "@/contexts/AuthContext";
import { formatScore } from "@/arcade3d/core/format";
import { LOGIN_EVENT } from "@/components/Site/siteData";
import { useLocalScores } from "@/components/Site/hooks";
import BoardRows from "@/components/Site/BoardRows";
import ui from "@/components/Site/ui.module.css";
import styles from "./HubBoards.module.css";

export interface HubBoardsProps {
   /** the games whose boards the chips offer (live games) */
   games: ArcadeGameMeta[];
}

const ROWS = 5;

export default function HubBoards({ games }: HubBoardsProps) {
   const { isAuthenticated } = useAuth();
   const scores = useLocalScores();
   const [slug, setSlug] = useState(games[0]?.slug);
   const game = games.find((item) => item.slug === slug) ?? games[0];
   if (!game) return null;

   const mine = games
      .filter((item) => scores[item.slug])
      .sort((a, b) => (scores[b.slug]?.lastPlayed ?? "").localeCompare(scores[a.slug]?.lastPlayed ?? ""))
      .slice(0, 3);

   return (
      <section className={ui.wrap} aria-labelledby="hub-boards">
         <div className={ui.secHead}>
            <h2 id="hub-boards" className={ui.h2}>
               Top of the boards
            </h2>
            <Link href="/leaderboards" className={styles.all}>
               All leaderboards
            </Link>
         </div>

         <div className={styles.boards}>
            <div>
               <div className={styles.chips} role="group" aria-label="Game">
                  {games.map((item) => (
                     <button
                        key={item.slug}
                        type="button"
                        className={styles.chip}
                        aria-pressed={item.slug === game.slug}
                        onClick={() => setSlug(item.slug)}
                     >
                        {item.title}
                     </button>
                  ))}
               </div>
               <BoardRows key={game.slug} game={game} limit={ROWS} />
            </div>

            <aside className={styles.yours} aria-label="Your best scores">
               <h3 className={styles.yoursTitle}>Your best scores</h3>
               {mine.length > 0 ? (
                  <ul className={styles.mine}>
                     {mine.map((item) => {
                        const entry = scores[item.slug];
                        return (
                           <li key={item.slug}>
                              <Link href={`/3d/${item.slug}`} className={styles.mineRow}>
                                 {item.thumbnail ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={item.thumbnail} alt="" loading="lazy" />
                                 ) : (
                                    <span />
                                 )}
                                 <b>{item.title}</b>
                                 <span className={styles.score}>
                                    {entry ? formatScore(entry.best, item.scoring, entry.bestDurationMs) : ""}
                                 </span>
                              </Link>
                           </li>
                        );
                     })}
                  </ul>
               ) : (
                  <p className={styles.yoursText}>Nothing played yet. Your best scores will show here after your first round.</p>
               )}
               {isAuthenticated ? null : (
                  <>
                     <p className={styles.yoursText}>Log in to keep your scores on every device and to see your rank.</p>
                     <button
                        type="button"
                        className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm}`}
                        onClick={() => window.dispatchEvent(new Event(LOGIN_EVENT))}
                     >
                        Log in
                     </button>
                  </>
               )}
            </aside>
         </div>
      </section>
   );
}
