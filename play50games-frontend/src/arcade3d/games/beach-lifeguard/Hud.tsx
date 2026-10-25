"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

/** Alert meter. Saved and Score are the shell's stat chips. */
export default function Hud() {
   const alert = useArcadeStore((s) => s.stats.alert ?? 100);
   const carrying = useArcadeStore((s) => s.stats.carrying === 1);
   const onJetSki = useArcadeStore((s) => s.stats.jetSki === 1);
   const width = Math.max(0, Math.min(100, alert));

   const color = width < 25 ? "#ef4444" : width < 50 ? "#f59e0b" : "#fb7185";

   return (
      <div className={styles.alertPanel} data-arcade-safe-area>
         <div className={styles.header}>
            <span className={carrying ? styles.carryingAlert : undefined}>
               {carrying ? "Safe Sand (z \u2265 2)!" : onJetSki ? "Jet Ski Active" : "Rescue Alert"}
            </span>
            <strong>{width}%</strong>
         </div>
         <div className={styles.track} aria-hidden>
            <div
               className={styles.fill}
               style={{
                  width: `${width}%`,
                  background: color,
               }}
            />
         </div>
      </div>
   );
}
