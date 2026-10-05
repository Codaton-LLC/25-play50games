"use client";

// STUB (Phase 0). Owner: Cursor (K2). Keep the props exactly as typed; add a .module.css next to this file.
import type { ArcadeSlug } from "../types";
import { getGameMeta } from "../registry";
import { useBestScore } from "../core/useBestScore";
import { formatScore } from "../core/format";

export interface BestScoreBadgeProps {
   slug: ArcadeSlug;
}

export default function BestScoreBadge({ slug }: BestScoreBadgeProps) {
   const best = useBestScore(slug);
   const meta = getGameMeta(slug);
   if (!best || !meta) return null;
   return <span>Best {formatScore(best.best, meta.scoring, best.bestDurationMs)}</span>;
}
