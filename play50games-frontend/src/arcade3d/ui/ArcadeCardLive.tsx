"use client";

// An ArcadeCard that reads this visitor's best score itself (live on saves and other tabs).
import type { ArcadeGameMeta } from "../types";
import { useBestScore } from "../core/useBestScore";
import ArcadeCard, { type ArcadeCardProps } from "./ArcadeCard";

export interface ArcadeCardLiveProps {
   meta: ArcadeGameMeta;
   size?: ArcadeCardProps["size"];
}

export default function ArcadeCardLive({ meta, size }: ArcadeCardLiveProps) {
   const best = useBestScore(meta.slug);
   return <ArcadeCard meta={meta} best={best} size={size} />;
}
