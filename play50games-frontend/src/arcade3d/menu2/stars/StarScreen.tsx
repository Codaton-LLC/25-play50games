"use client";

// The Menu 2 level-end star screen: three stars that pop in one after another (the new ones glow),
// the goal under each, the no-hit badge, the secrets found and the XP gained. Display only: the game
// evaluates the stars (stars.ts) and records progress (menu2/progress) before it shows this.
// Fits a 390 px card; respects prefers-reduced-motion (no pop, everything shown at once).
import type { CSSProperties } from "react";
import { STAR_BIT } from "./stars";
import styles from "./StarScreen.module.css";

export interface StarScreenProps {
   /** this run's STAR_BIT mask */
   mask: number;
   /** stars earned for the first time on this run (mask) */
   newMask?: number;
   labels: readonly [string, string, string];
   noHit: boolean;
   /** the no-hit badge was earned before (shown dimmer when this run had hits) */
   noHitEver?: boolean;
   secrets?: { found: number; total: number; newFound?: number };
   xpGained?: number;
   /** the hero's accent colour */
   accent?: string;
}

const BITS = [STAR_BIT.clear, STAR_BIT.orbs, STAR_BIT.goal] as const;

function StarIcon() {
   return (
      <svg viewBox="0 0 48 48" className={styles.starSvg} aria-hidden="true">
         <path d="M24 3.5l6.2 13.1 14.3 1.8-10.5 9.9 2.7 14.2L24 35.6l-12.7 6.9 2.7-14.2L3.5 18.4l14.3-1.8z" />
      </svg>
   );
}

export default function StarScreen({ mask, newMask = 0, labels, noHit, noHitEver, secrets, xpGained, accent }: StarScreenProps) {
   const count = BITS.filter((b) => mask & b).length;
   const style = accent ? ({ "--m2-accent": accent } as CSSProperties) : undefined;
   return (
      <section className={styles.screen} style={style} aria-label={`${count} of 3 stars`}>
         <ol className={styles.stars}>
            {BITS.map((bit, i) => {
               const on = (mask & bit) !== 0;
               const fresh = (newMask & bit) !== 0;
               return (
                  <li
                     key={bit}
                     className={`${styles.star} ${on ? styles.on : styles.off} ${fresh ? styles.fresh : ""} ${i === 1 ? styles.middle : ""}`}
                     style={{ "--i": i } as CSSProperties}
                  >
                     <span className={styles.starIcon}>
                        <StarIcon />
                     </span>
                     <span className={styles.starLabel}>
                        <span className={styles.srOnly}>{on ? "Earned: " : "Missed: "}</span>
                        {labels[i]}
                     </span>
                     {fresh && <span className={styles.newTag}>New</span>}
                  </li>
               );
            })}
         </ol>
         <div className={styles.extras}>
            <span className={`${styles.badge} ${noHit ? styles.badgeOn : noHitEver ? styles.badgeEver : ""}`}>
               <svg viewBox="0 0 24 24" className={styles.badgeIcon} aria-hidden="true">
                  <path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z" />
                  {noHit && <path d="M8 12l3 3 5-6" className={styles.check} />}
               </svg>
               {noHit ? "No-hit run" : noHitEver ? "No-hit (earned before)" : "No-hit: missed"}
            </span>
            {secrets && secrets.total > 0 && (
               <span className={styles.badge}>
                  <span className={styles.shard} aria-hidden="true" />
                  Secrets {secrets.found}/{secrets.total}
                  {secrets.newFound ? <span className={styles.plus}>+{secrets.newFound}</span> : null}
               </span>
            )}
            {xpGained !== undefined && xpGained > 0 && <span className={`${styles.badge} ${styles.xp}`}>+{xpGained} XP</span>}
         </div>
      </section>
   );
}
