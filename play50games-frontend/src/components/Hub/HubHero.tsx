"use client";

// Hub hero (docs/design/DESIGN.md §6): the copy on the left, the featured stage on the right.
// The stage shows one live game at a time and moves on every 7 seconds; the one coral button
// always plays the game on stage. The copy is rendered on the server and passed in.
import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ArcadeGameMeta } from "@/arcade3d/types";
import { useBestScore } from "@/arcade3d/core/useBestScore";
import { formatScore } from "@/arcade3d/core/format";
import { levelsActive } from "@/arcade3d/core/levels";
import { levelClearedText, levelProgress, levelTotalText } from "@/arcade3d/core/levelProgress";
import { PlayIcon } from "@/components/Site/icons";
import ui from "@/components/Site/ui.module.css";
import styles from "./HubHero.module.css";

export interface HubHeroProps {
   /** eyebrow, headline and the sentence under it */
   copy: ReactNode;
   /** the small facts line under the button */
   facts: ReactNode;
   /** live games with art for the stage; empty = the classic cover with a Classic 50 button */
   games: ArcadeGameMeta[];
}

const STAGE_MS = 7000;

function Stage({ games, index, onPick }: { games: ArcadeGameMeta[]; index: number; onPick: (next: number) => void }) {
   const game = games[index];
   const best = useBestScore(game.slug);
   const summary = levelsActive(game) ? levelProgress(game, best) : null;
   // the stage only moves by itself once we know the visitor has not asked for less motion
   const [auto, setAuto] = useState(false);

   useEffect(() => {
      setAuto(games.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
   }, [games.length]);

   return (
      <div className={styles.stage}>
         <Link href={`/3d/${game.slug}`} className={styles.art} aria-label={`Play ${game.title}`}>
            {games.map((item, itemIndex) =>
               item.thumbnail ? (
                  // the first frame is the LCP image of the hub: preloaded, never lazy
                  <Image
                     key={item.slug}
                     src={item.thumbnail}
                     alt=""
                     fill
                     sizes="(max-width: 899px) 100vw, 58vw"
                     priority={itemIndex === 0}
                     className={itemIndex === index ? `${styles.image} ${styles.imageOn}` : styles.image}
                  />
               ) : null,
            )}
         </Link>

         {games.length > 1 ? (
            <div className={styles.segs} role="group" aria-label="Featured games">
               {games.map((item, itemIndex) => (
                  <button
                     key={item.slug}
                     type="button"
                     className={styles.seg}
                     aria-label={`Show ${item.title}`}
                     aria-pressed={itemIndex === index}
                     onClick={() => onPick(itemIndex)}
                  >
                     <span className={styles.segTrack}>
                        {itemIndex < index || (itemIndex === index && !auto) ? (
                           <i className={`${styles.segFill} ${styles.segDone}`} />
                        ) : itemIndex === index ? (
                           <i
                              key={`run-${index}`}
                              className={`${styles.segFill} ${styles.segRun}`}
                              style={{ animationDuration: `${STAGE_MS}ms` }}
                              onAnimationEnd={() => onPick((index + 1) % games.length)}
                           />
                        ) : (
                           <i className={styles.segFill} />
                        )}
                     </span>
                  </button>
               ))}
            </div>
         ) : null}

         <div className={styles.strip}>
            <div className={styles.stripText}>
               <p className={styles.kicker}>
                  {game.order > 10 ? (
                     <span className={`${styles.badge} ${styles.badgeNew}`}>New</span>
                  ) : (
                     <span className={styles.badge}>
                        <i className={ui.dot} />
                        Live
                     </span>
                  )}
                  <span className={ui.label}>3D Arcade</span>
               </p>
               <p className={styles.title}>{game.title}</p>
               <p className={styles.tagline}>{game.tagline}</p>
            </div>
            <div className={styles.side}>
               {summary ? (
                  <span
                     className={summary.cleared >= summary.levels.length ? `${ui.pips} ${ui.pipsAll}` : ui.pips}
                     role="img"
                     aria-label={levelClearedText(summary)}
                  >
                     {summary.levels.map((level) => (
                        <i key={level.id} className={level.cleared ? `${ui.pip} ${ui.pipOn}` : ui.pip} />
                     ))}
                  </span>
               ) : null}
               {best && summary ? (
                  <span className={styles.best}>{levelTotalText(game, summary)}</span>
               ) : best ? (
                  <span className={styles.best}>
                     <span className={styles.bestLabel}>Best</span>
                     {formatScore(best.best, game.scoring, best.bestDurationMs)}
                  </span>
               ) : (
                  <span className={styles.none}>No score yet</span>
               )}
            </div>
         </div>
      </div>
   );
}

export default function HubHero({ copy, facts, games }: HubHeroProps) {
   const [index, setIndex] = useState(0);
   const game = games[Math.min(index, games.length - 1)];

   return (
      <div className={styles.hero}>
         <div className={styles.copy}>
            {copy}
            {game ? (
               <Link href={`/3d/${game.slug}`} className={`${ui.btn} ${ui.btnPrimary} ${styles.cta}`}>
                  <PlayIcon />
                  Play now
               </Link>
            ) : (
               <Link href="/classic" className={`${ui.btn} ${ui.btnPrimary} ${styles.cta}`}>
                  <PlayIcon />
                  Play Classic 50
               </Link>
            )}
            {facts}
         </div>

         {game ? (
            <Stage games={games} index={Math.min(index, games.length - 1)} onPick={setIndex} />
         ) : (
            <Link href="/classic" className={`${styles.stage} ${styles.cover}`} aria-label="Play Classic 50">
               <Image
                  src="/images/play50games-cover.jpg"
                  alt=""
                  width={1200}
                  height={630}
                  sizes="(max-width: 899px) 100vw, 58vw"
                  priority
               />
            </Link>
         )}
      </div>
   );
}
