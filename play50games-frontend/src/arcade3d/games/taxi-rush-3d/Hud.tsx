"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

/** Fare patience. Rides is a shell stat chip. This is not a second clock. */
export default function Hud() {
   const fare = useArcadeStore((s) => s.stats.fare ?? 100);
   const width = Math.max(0, Math.min(100, fare));
   return (
      <div className={styles.fare} data-arcade-safe-area>
         <span>Fare {width}</span>
         <div className={styles.track} aria-hidden>
            <div className={styles.fill} style={{ width: `${width}%` }} />
         </div>
      </div>
   );
}
