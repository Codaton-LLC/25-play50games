import Link from "next/link";
import type { CSSProperties } from "react";
import { ARCADE_COLLECTIONS, type ArcadeGameMeta } from "../types";
import type { LocalScoreEntry } from "../core/scores";
import { formatScore } from "../core/format";
import styles from "./ArcadeCard.module.css";

function collectionLabel(meta: ArcadeGameMeta): string {
   const id = meta.collection ?? "originals";
   return ARCADE_COLLECTIONS.find((item) => item.id === id)?.title ?? "Originals";
}

export interface ArcadeCardProps {
   meta: ArcadeGameMeta;
   best: LocalScoreEntry | null;
}

export default function ArcadeCard({ meta, best }: ArcadeCardProps) {
   const accent = { "--card-accent": meta.accent } as CSSProperties;
   const soon = meta.status === "soon";
   const dev = meta.status === "dev";
   const isNew = meta.order > 10 && meta.status === "live";
   const body = (
      <>
         <div className={styles.art}>
            {meta.thumbnail ? <img className={styles.image} src={meta.thumbnail} alt="" /> : null}
            {soon ? <span className={styles.soon}>Soon</span> : null}
            {dev ? <span className={styles.dev}>Dev</span> : null}
            {isNew ? <span className={styles.fresh}>New</span> : null}
         </div>
         <div className={styles.copy}>
            <p className={styles.collection}>{collectionLabel(meta)}</p>
            <div className={styles.heading}>
               <h3 className={styles.title}>{meta.title}</h3>
               <span className={styles.dots} aria-label={`Difficulty ${meta.difficulty} of 3`}>
                  {[1, 2, 3].map((level) => (
                     <span
                        key={level}
                        className={level <= meta.difficulty ? styles.dotOn : styles.dot}
                        aria-hidden="true"
                     />
                  ))}
               </span>
            </div>
            <p className={styles.tagline}>{meta.tagline}</p>
            <p className={styles.best}>
               {best ? (
                  <>
                     <span className={styles.bestLabel}>Best</span>{" "}
                     {formatScore(best.best, meta.scoring, best.bestDurationMs)}
                  </>
               ) : (
                  "No score yet"
               )}
            </p>
         </div>
      </>
   );

   if (meta.status === "live" || meta.status === "dev") {
      return (
         <Link className={`${styles.card} ${styles.link}`} href={`/3d/${meta.slug}`} style={accent}>
            {body}
         </Link>
      );
   }

   return (
      <article className={styles.card} style={accent}>
         {body}
      </article>
   );
}
