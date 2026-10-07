"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { HOLD_MS } from "./rules";
import styles from "./Hud.module.css";

export default function Hud() {
   const starting = useArcadeStore(s => s.phase !== "over" && s.elapsedMs < HOLD_MS);
   const fallen = useArcadeStore(s => s.stats.fallen === 1);
   const checkpoint = useArcadeStore(s => s.stats.checkpoint ?? 0);
   return (
      <div className={styles.root}>
         <div className={styles.hint} data-arcade-safe-area role="status" aria-live="polite">
            {fallen ? "You fell! Nice climb." : starting ? "Left / right, then Jump" : checkpoint > 0 ? `Checkpoint ${checkpoint} · Keep climbing` : "Orange slabs crumble · Keep moving"}
         </div>
      </div>
   );
}
