"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

/** Bales on the trailer this trip. Score, time, lives and Trips are the shell's chips. */
export default function Hud() {
   const loaded = useArcadeStore((s) => s.stats.loaded ?? 0);
   const size = useArcadeStore((s) => s.stats.load ?? 1);
   return (
      <div className={styles.load} data-arcade-safe-area>
         <span>Load</span>
         <strong>{loaded}/{size}</strong>
      </div>
   );
}
