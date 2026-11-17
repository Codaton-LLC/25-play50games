// A game tile: the art is the card (docs/design/DESIGN.md §4). Title, tagline and score sit below
// the 16:9 screenshot on the page background. Display only.
import Link from "next/link";
import type { ArcadeGameMeta } from "../types";
import type { LocalScoreEntry } from "../core/scores";
import { formatScore } from "../core/format";
import { levelsActive } from "../core/levels";
import { levelClearedText, levelProgress, levelTotalText } from "../core/levelProgress";
import { ClockIcon, PlayIcon } from "@/components/Site/icons";
import ui from "@/components/Site/ui.module.css";
import styles from "./ArcadeCard.module.css";

export interface ArcadeCardProps {
   meta: ArcadeGameMeta;
   best: LocalScoreEntry | null;
   /** "xl" = the large tile of a bento: its art fills the tile's height */
   size?: "md" | "xl";
}

function Badge({ meta }: { meta: ArcadeGameMeta }) {
   if (meta.status === "soon") return <span className={`${styles.badge} ${styles.badgeSoon}`}>Soon</span>;
   if (meta.status === "dev") return <span className={`${styles.badge} ${styles.badgeNew}`}>Dev</span>;
   if (meta.order > 10 && meta.status === "live") return <span className={`${styles.badge} ${styles.badgeNew}`}>New</span>;
   if (meta.scoring.kind === "time") {
      return (
         <span className={styles.badge}>
            <ClockIcon />
            Time trial
         </span>
      );
   }
   return null;
}

export default function ArcadeCard({ meta, best, size = "md" }: ArcadeCardProps) {
   const soon = meta.status === "soon";
   const levels = levelsActive(meta);
   const summary = levels ? levelProgress(meta, best) : null;

   const body = (
      <>
         <span className={styles.art}>
            {meta.thumbnail ? (
               // eslint-disable-next-line @next/next/no-img-element
               <img className={styles.image} src={meta.thumbnail} alt="" loading="lazy" />
            ) : null}
            <Badge meta={meta} />
            {soon ? null : (
               <span className={styles.play} aria-hidden="true">
                  <PlayIcon />
                  Play
               </span>
            )}
         </span>

         <span className={styles.row}>
            <span className={styles.title}>{meta.title}</span>
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
            ) : (
               <span className={styles.dots} role="img" aria-label={`Difficulty ${meta.difficulty} of 3`}>
                  {[1, 2, 3].map((level) => (
                     <i key={level} className={level <= meta.difficulty ? styles.dotOn : styles.dot} />
                  ))}
               </span>
            )}
         </span>

         <span className={styles.tagline}>{meta.tagline}</span>

         {soon ? (
            <span className={styles.none}>Opens soon</span>
         ) : best && summary ? (
            <span className={styles.best}>{levelTotalText(meta, summary)}</span>
         ) : best ? (
            <span className={styles.best}>
               <span className={styles.bestLabel}>Best</span>
               {formatScore(best.best, meta.scoring, best.bestDurationMs)}
            </span>
         ) : (
            <span className={styles.none}>No score yet</span>
         )}
      </>
   );

   const className = [styles.card, size === "xl" ? styles.xl : "", soon ? styles.soon : ""].filter(Boolean).join(" ");

   if (soon) {
      return (
         <article className={className} aria-label={`${meta.title}, opens soon`}>
            {body}
         </article>
      );
   }

   return (
      <Link className={className} href={`/3d/${meta.slug}`}>
         {body}
      </Link>
   );
}
