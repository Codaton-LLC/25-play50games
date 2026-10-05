"use client";

import type { ArcadeGameMeta } from "../types";
import { useBestScore } from "../core/useBestScore";
import ArcadeCard from "./ArcadeCard";
import styles from "./ArcadeGrid.module.css";

export interface ArcadeGridProps {
   games: ArcadeGameMeta[];
}

function CardWithBest({ meta }: { meta: ArcadeGameMeta }) {
   const best = useBestScore(meta.slug);
   return <ArcadeCard meta={meta} best={best} />;
}

export default function ArcadeGrid({ games }: ArcadeGridProps) {
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
