"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

/** Hop state. Treats and the score are the shell's chips; this is not a second clock. */
export default function Hud() {
   const ready = useArcadeStore((s) => (s.stats.hop ?? 1) > 0);
   return (
      <div className={styles.hop} data-arcade-safe-area>
         <span className={ready ? styles.ready : styles.cooling}>{ready ? "Hop ready" : "Hop..."}</span>
      </div>
   );
}
