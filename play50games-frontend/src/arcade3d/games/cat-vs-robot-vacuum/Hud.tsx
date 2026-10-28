"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

/** The goal right now and the hop state. Treats and the score are the shell's chips; this is not a second clock. */
export default function Hud() {
   const ready = useArcadeStore((s) => (s.stats.hop ?? 1) > 0);
   const bed = useArcadeStore((s) => (s.stats.goal ?? 0) === 1);
   return (
      <div className={styles.panel} data-arcade-safe-area>
         <span className={bed ? styles.goalBed : styles.goal}>{bed ? "All fish! Nap on the bed" : "Eat the gold fish, dodge red"}</span>
         <span className={ready ? styles.ready : styles.cooling}>{ready ? "Hop ready" : "Hop..."}</span>
      </div>
   );
}
