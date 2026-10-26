"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

/** Shown on a finish that missed the quota. Rings and Stars chips already show the counts. */
export default function Hud() {
   const phase = useArcadeStore((s) => s.phase);
   const reason = useArcadeStore((s) => s.endReason);
   const rings = useArcadeStore((s) => s.stats.needRings ?? 0);
   const stars = useArcadeStore((s) => s.stats.needStars ?? 0);
   if (phase !== "over" || reason !== "lose" || (rings <= 0 && stars <= 0)) return null;
   const parts: string[] = [];
   if (rings > 0) parts.push(`${rings} more ring${rings === 1 ? "" : "s"}`);
   if (stars > 0) parts.push(`${stars} more star${stars === 1 ? "" : "s"}`);
   return (
      <div className={styles.miss} data-arcade-safe-area>
         Need {parts.join(" and ")} to clear.
      </div>
   );
}
