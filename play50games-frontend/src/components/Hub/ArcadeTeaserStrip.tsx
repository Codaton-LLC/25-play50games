import Link from "next/link";
import type { CSSProperties } from "react";
import type { ArcadeGameMeta } from "@/arcade3d/types";
import styles from "./ArcadeTeaserStrip.module.css";

export interface ArcadeTeaserStripProps {
   /** all games; live ones link to /3d/<slug>, the rest show as "soon" */
   games: ArcadeGameMeta[];
}

export default function ArcadeTeaserStrip({ games }: ArcadeTeaserStripProps) {
   if (games.length === 0) {
      return null;
   }

   return (
      <ul className={styles.strip} aria-label="3D arcade games">
         {games.map((game) => {
            const accent = { "--tile-accent": game.accent } as CSSProperties;
            const face = (
               <>
                  <span className={styles.bar} aria-hidden="true" />
                  <span className={styles.title}>{game.title}</span>
                  {game.status === "soon" ? <span className={styles.badge}>Soon</span> : null}
               </>
            );

            return (
               <li key={game.slug} className={styles.item}>
                  {game.status === "live" ? (
                     <Link className={`${styles.tile} ${styles.link}`} href={`/3d/${game.slug}`} style={accent}>
                        {face}
                     </Link>
                  ) : (
                     <div className={styles.tile} style={accent}>
                        {face}
                     </div>
                  )}
               </li>
            );
         })}
      </ul>
   );
}
