"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

/** Breath meter. Fires and Saved are the shell's stat chips; this is not a second clock. */
export default function Hud() {
   const breath = useArcadeStore((s) => s.stats.breath ?? 100);
   const width = Math.max(0, Math.min(100, breath));
   return (
      <div className={styles.breath} data-arcade-safe-area>
         <span>Breath {width}</span>
         <div className={styles.track} aria-hidden>
            <div className={styles.fill} style={{ width: `${width}%` }} />
         </div>
      </div>
   );
}
