import type { CSSProperties } from "react";
import type { ArcadeGameMeta } from "../types";
import styles from "./ArcadeLoadingCard.module.css";

export interface ArcadeLoadingCardProps {
   meta: ArcadeGameMeta;
}

/** Card shown while a game's screen is still loading. Display only. */
export default function ArcadeLoadingCard({ meta }: ArcadeLoadingCardProps) {
   const accent = { "--card-accent": meta.accent } as CSSProperties;

   return (
      <article className={styles.card} style={accent} aria-busy="true">
         <div className={styles.art}>
            {meta.thumbnail ? <img className={styles.image} src={meta.thumbnail} alt="" /> : null}
         </div>
         <div className={styles.copy}>
            <p className={styles.title}>{meta.title}</p>
            <p className={styles.progress} role="status">
               Loading
            </p>
            <div className={styles.track} aria-hidden="true">
               <span className={styles.shimmer} />
            </div>
         </div>
      </article>
   );
}
