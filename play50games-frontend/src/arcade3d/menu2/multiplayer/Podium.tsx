"use client";

// The multiplayer result screen. Versus: a podium (2nd, 1st, 3rd, then 4th) with each player's
// line. Co-op: one team result above the same podium of contributions. Buttons: Play again (same
// players), Lobby (back to the join screen), Solo (ends the session). Rendered by the game's HUD
// in a portal over the shell's result card once the result delay is over (isResultShown).
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { PLAYER_COLORS } from "./players";
import { podiumOrder, type Placed, type TeamResult } from "./results";
import type { MpHero } from "./JoinScreen";
import styles from "./Podium.module.css";

export interface PodiumEntry extends Placed {
   heroId: string;
   /** the line under the name (time, orbs, height...) */
   detail: ReactNode;
}

export interface PodiumProps {
   heroes: readonly MpHero[];
   entries: readonly PodiumEntry[];
   /** co-op: the team line on top */
   team?: (TeamResult & { text: ReactNode }) | null;
   title: string;
   onAgain(): void;
   onLobby(): void;
   onSolo(): void;
}

const HEIGHTS = [100, 72, 52, 36];

export function Podium({ heroes, entries, team, title, onAgain, onLobby, onSolo }: PodiumProps) {
   if (typeof document === "undefined") return null;
   const order = podiumOrder(entries);
   return createPortal(
      <div className={styles.backdrop}>
         <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Results">
            <h2 className={styles.title}>{title}</h2>
            {team && <p className={team.cleared ? styles.teamWin : styles.team}>{team.text}</p>}
            <ol className={styles.podium}>
               {order.map((e) => {
                  const hero = heroes.find((h) => h.id === e.heroId) ?? heroes[0];
                  return (
                     <li key={e.index} className={styles.column} style={{ ["--tag" as string]: PLAYER_COLORS[e.index], ["--hero" as string]: hero?.color }}>
                        <span className={styles.who}>
                           <span className={styles.tag}>P{e.index + 1}</span>
                           <span className={styles.heroName}>{hero?.name}</span>
                        </span>
                        <span className={styles.detail}>{e.detail}</span>
                        <span className={styles.block} style={{ height: `${HEIGHTS[Math.min(3, e.place - 1)]}px` }}>
                           <span className={styles.place}>{e.place}</span>
                        </span>
                     </li>
                  );
               })}
            </ol>
            <div className={styles.actions}>
               <button type="button" className={styles.primary} onClick={onAgain}>
                  Play again
               </button>
               <button type="button" className={styles.secondary} onClick={onLobby}>
                  Lobby
               </button>
               <button type="button" className={styles.secondary} onClick={onSolo}>
                  Solo
               </button>
            </div>
         </div>
      </div>,
      document.body,
   );
}
