"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

/** Battery meter. Samples and time are shell chips; this provides instant power visual feedback. */
export default function Hud() {
   const battery = useArcadeStore((s) => s.stats.battery ?? 100);
   const percent = Math.max(0, Math.min(100, Math.round(battery)));
   const isLow = percent < 30;

   return (
      <div className={styles.meter} data-arcade-safe-area>
         <div className={`${styles.labelRow} ${isLow ? styles.low : ""}`}>
            <span>Battery</span>
            <span>{percent}%</span>
         </div>
         <div className={styles.track} aria-hidden>
            <div
               className={`${styles.fill} ${isLow ? styles.fillLow : ""}`}
               style={{ width: `${percent}%` }}
            />
         </div>
      </div>
   );
}
