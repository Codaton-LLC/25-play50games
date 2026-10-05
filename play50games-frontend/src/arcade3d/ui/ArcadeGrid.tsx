"use client";

// STUB (Phase 0). Owner: Cursor (K2). Keep the props exactly as typed; add a .module.css next to this file.
import type { ArcadeGameMeta } from "../types";
import { useBestScore } from "../core/useBestScore";
import ArcadeCard from "./ArcadeCard";

export interface ArcadeGridProps {
   games: ArcadeGameMeta[];
}

function CardWithBest({ meta }: { meta: ArcadeGameMeta }) {
   const best = useBestScore(meta.slug);
   return <ArcadeCard meta={meta} best={best} />;
}

export default function ArcadeGrid({ games }: ArcadeGridProps) {
   return (
      <div>
         {games.map((meta) => (
            <CardWithBest key={meta.slug} meta={meta} />
         ))}
      </div>
   );
}
