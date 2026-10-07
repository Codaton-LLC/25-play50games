"use client";

// The map name. Score, time, Litter and Map n/3 are the shell HUD (hudStats). This pill is the
// one element marked data-arcade-safe-area, and it is a fixed box (Hud.module.css) so a map
// change never moves the camera fit.
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

const NAMES = ["Park", "City", "Beach"] as const;

export default function MapHud() {
   const map = useArcadeStore((s) => s.stats.map ?? 1);
   const name = NAMES[map - 1] ?? NAMES[0];
   return (
      <div className={styles.panel} data-arcade-safe-area="" role="status" aria-live="polite">
         <div className={styles.pill}>{name}</div>
      </div>
   );
}
