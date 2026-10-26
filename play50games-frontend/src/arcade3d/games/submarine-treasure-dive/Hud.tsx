"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

/** Battery meter. Treasure is the shell's stat chip; this is not a second clock. */
export default function Hud() {
   const battery = useArcadeStore((s) => s.stats.battery ?? 100);
   const width = Math.max(0, Math.min(100, battery));
   return (
      <div className={styles.battery} data-arcade-safe-area>
         <span>Battery {width}</span>
         <div className={styles.track} aria-hidden>
            <div className={width < 25 ? `${styles.fill} ${styles.low}` : styles.fill} style={{ width: `${width}%` }} />
         </div>
      </div>
   );
}
