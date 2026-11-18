"use client";

// The per-player HUD: one chip per player (P-tag in the player colour, the hero swatch, the game's
// own stat line and a finished / place badge). Marked data-arcade-safe-area so the cameras keep
// the heroes out from under it. Re-renders only when a player's store fields change.
import type { ReactNode } from "react";
import { PLAYER_COLORS, usePlayers, type PlayerState } from "./players";
import type { MpHero } from "./JoinScreen";
import styles from "./PlayerHud.module.css";

export interface PlayerHudProps {
   heroes: readonly MpHero[];
   /** the chip's stat line (e.g. "12 orbs · 40 m") */
   stat: (player: PlayerState) => ReactNode;
   /** a place badge (versus) once known, e.g. from rankRace */
   place?: (player: PlayerState) => number | null;
   /** "top-left" (default, under the shell chips) or "bottom" (a row along the bottom edge) */
   placement?: "top-left" | "bottom";
}

const ORDINAL = ["1st", "2nd", "3rd", "4th"];

export function PlayerHud({ heroes, stat, place, placement = "top-left" }: PlayerHudProps) {
   const players = usePlayers((s) => s.players);
   return (
      <ol className={placement === "bottom" ? styles.bottom : styles.strip} data-arcade-safe-area="" aria-label="Players">
         {players.map((p) => {
            const hero = heroes.find((h) => h.id === p.heroId) ?? heroes[0];
            const rank = place?.(p) ?? null;
            return (
               <li key={p.index} className={p.finished ? styles.chipDone : styles.chip} style={{ ["--tag" as string]: PLAYER_COLORS[p.index] }}>
                  <span className={styles.tag}>P{p.index + 1}</span>
                  <span className={styles.swatch} style={{ background: hero?.color }} aria-hidden="true" />
                  <span className={styles.body}>
                     <span className={styles.name}>{hero?.name}</span>
                     <span className={styles.stat}>{stat(p)}</span>
                  </span>
                  {rank !== null && <span className={styles.place}>{ORDINAL[rank - 1] ?? `${rank}th`}</span>}
                  {p.finished && rank === null && (
                     <span className={styles.place} aria-label="finished">
                        ✓
                     </span>
                  )}
               </li>
            );
         })}
      </ol>
   );
}
