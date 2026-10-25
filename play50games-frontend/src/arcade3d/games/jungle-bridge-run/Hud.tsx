"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

export default function Hud() {
   const section = useArcadeStore((s) => s.stats.section ?? 1);
   const sectionCleared = useArcadeStore((s) => s.stats.sectionCleared ?? 0);

   if (!sectionCleared) return null;

   return (
      <div className={styles.hudContainer} data-arcade-safe-area>
         <div className={styles.checkpointToast} role="status">
            Checkpoint Cleared! +100
         </div>
      </div>
   );
}
