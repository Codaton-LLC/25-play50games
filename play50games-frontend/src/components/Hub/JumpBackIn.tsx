"use client";

// "Jump back in": the games this visitor played last, newest first, as a rail of tiles.
// Scores live in localStorage, so the section renders nothing on the server and for new visitors.
import type { ArcadeGameMeta } from "@/arcade3d/types";
import ArcadeCard from "@/arcade3d/ui/ArcadeCard";
import { useLocalScores } from "@/components/Site/hooks";
import ui from "@/components/Site/ui.module.css";
import styles from "./JumpBackIn.module.css";

export interface JumpBackInProps {
   /** the visible arcade games */
   games: ArcadeGameMeta[];
}

const MAX_TILES = 8;

export default function JumpBackIn({ games }: JumpBackInProps) {
   const scores = useLocalScores();
   const played = games
      .filter((game) => (game.status === "live" || game.status === "dev") && scores[game.slug])
      .sort((a, b) => (scores[b.slug]?.lastPlayed ?? "").localeCompare(scores[a.slug]?.lastPlayed ?? ""))
      .slice(0, MAX_TILES);

   if (played.length === 0) return null;

   return (
      <section className={ui.wrap} aria-labelledby="hub-back">
         <div className={ui.secHead}>
            <h2 id="hub-back" className={ui.h2}>
               Jump back in
            </h2>
            <p className={ui.secNote}>Your last games and best scores</p>
         </div>
         <ul className={styles.rail} tabIndex={0} aria-label="Recent games">
            {played.map((game) => (
               <li key={game.slug} className={styles.item}>
                  <ArcadeCard meta={game} best={scores[game.slug] ?? null} />
               </li>
            ))}
         </ul>
      </section>
   );
}
