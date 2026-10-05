"use client";

import type { ArcadeSlug } from "../types";
import { getGameMeta } from "../registry";
import { useBestScore } from "../core/useBestScore";
import { formatScore } from "../core/format";
import styles from "./BestScoreBadge.module.css";

export interface BestScoreBadgeProps {
   slug: ArcadeSlug;
}

export default function BestScoreBadge({ slug }: BestScoreBadgeProps) {
   const best = useBestScore(slug);
   const meta = getGameMeta(slug);
   const text = best && meta ? formatScore(best.best, meta.scoring, best.bestDurationMs) : "No score yet";

   return <span className={styles.badge}>{text}</span>;
}
