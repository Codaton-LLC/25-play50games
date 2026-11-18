"use client";

// "More like this" on a game's lobby (docs/design/DESIGN.md §6 item 3): a short row of other live
// games as the catalogue's own tiles. A rail that scrolls inside itself on a narrow sheet (the next
// tile shows partly, as the hint); one row of equal columns on the wide lobby.
import type { ArcadeGameMeta } from "../types";
import ArcadeCardLive from "./ArcadeCardLive";
import styles from "./MoreLikeThis.module.css";

export interface MoreLikeThisProps {
   /** live games only (arcade3d/related.ts); an empty list draws nothing */
   games: readonly ArcadeGameMeta[];
   className?: string;
   /** the class of the heading, so it matches the other headings of the sheet it sits in */
   titleClassName?: string;
}

export default function MoreLikeThis({ games, className, titleClassName }: MoreLikeThisProps) {
   // a tile of a game that is not live would be a dead end (soon) or a 404 on production (dev)
   const shown = games.filter((game) => game.status === "live");
   if (shown.length === 0) return null;
   return (
      <section className={`${styles.section} ${className ?? ""}`} aria-label="More like this">
         <h2 className={titleClassName ?? styles.title}>More like this</h2>
         <ul className={styles.rail}>
            {shown.map((game) => (
               <li key={game.slug} className={styles.item}>
                  <ArcadeCardLive meta={game} />
               </li>
            ))}
         </ul>
      </section>
   );
}
