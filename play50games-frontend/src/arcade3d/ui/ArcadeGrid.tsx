"use client";

import { useEffect, useState } from "react";
import type { ArcadeGameMeta } from "../types";
import { useBestScore } from "../core/useBestScore";
import ArcadeCard from "./ArcadeCard";
import {
   activeCollectionFilter,
   collectionChips,
   sectionsForFilter,
   sectionsWithGames,
   storedCollectionFilter,
   type CollectionFilter,
   type CollectionInfo,
} from "./collectionFilter";
import styles from "./ArcadeGrid.module.css";

const FILTER_KEY = "play50games_3d_collection";

export interface ArcadeGridProps {
   games: ArcadeGameMeta[];
   /** When set, games are grouped into these sections with filter chips. Omitted = one flat grid. */
   collections?: CollectionInfo[];
}

function CardWithBest({ meta }: { meta: ArcadeGameMeta }) {
   const best = useBestScore(meta.slug);
   return <ArcadeCard meta={meta} best={best} />;
}

function GameList({ games }: { games: ArcadeGameMeta[] }) {
   const ordered = [...games].sort((a, b) => a.order - b.order);

   return (
      <ul className={styles.grid}>
         {ordered.map((meta) => (
            <li key={meta.slug} className={styles.item}>
               <CardWithBest meta={meta} />
            </li>
         ))}
      </ul>
   );
}

export default function ArcadeGrid({ games, collections }: ArcadeGridProps) {
   const [filter, setFilter] = useState<CollectionFilter>("all");
   const grouped = collections !== undefined;

   useEffect(() => {
      if (!grouped) return;
      try {
         const stored = storedCollectionFilter(sessionStorage.getItem(FILTER_KEY));
         if (stored !== "all") setFilter(stored);
      } catch {
         /* private mode, or storage blocked */
      }
   }, [grouped]);

   if (!collections) return <GameList games={games} />;

   const populated = sectionsWithGames(games, collections);
   const active = activeCollectionFilter(filter, populated);
   const shown = sectionsForFilter(populated, active);
   const chips = populated.length > 0 ? collectionChips(populated) : [];

   function choose(next: CollectionFilter) {
      setFilter(next);
      try {
         sessionStorage.setItem(FILTER_KEY, next);
      } catch {
         /* private mode, or storage blocked */
      }
   }

   return (
      <div className={styles.sections}>
         {chips.length > 0 ? (
            <div className={styles.filters} role="group" aria-label="Filter by collection">
               {chips.map((chip) => (
                  <button
                     key={chip.id}
                     type="button"
                     className={styles.chip}
                     aria-pressed={active === chip.id}
                     onClick={() => choose(chip.id)}
                  >
                     {chip.label}
                  </button>
               ))}
            </div>
         ) : null}
         {shown.map((section) => (
            <section key={section.id} className={styles.section} aria-labelledby={`arcade-${section.id}`}>
               <h2 id={`arcade-${section.id}`} className={styles.sectionTitle}>
                  {section.title}
               </h2>
               <p className={styles.blurb}>{section.blurb}</p>
               <GameList games={section.games} />
            </section>
         ))}
      </div>
   );
}
