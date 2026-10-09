"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

export default function DinoHud() {
   const carried = useArcadeStore((s) => s.stats.carried ?? 0);
   const golden = useArcadeStore((s) => (s.stats.golden ?? 0) > 0);
   const dashReady = useArcadeStore((s) => (s.stats.dash ?? 1) > 0);

   return (
      <div
         className={styles.panel}
         data-arcade-safe-area=""
         role="status"
         aria-live="polite"
      >
         <div className={styles.pill} aria-hidden="true">
            <span>
               Eggs: <span className={styles.eggCount}>{carried}/3</span>
            </span>
            {golden && <span className={styles.goldenBadge}>⭐ Gold</span>}
            <span className={dashReady ? styles.dashBadge : styles.dashWait}>
               {dashReady ? "⚡ Dash" : "⏳ CD"}
            </span>
         </div>
      </div>
   );
}
