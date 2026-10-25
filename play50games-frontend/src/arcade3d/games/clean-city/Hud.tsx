"use client";

// The map name. Score, time, Litter and Map n/3 are the shell HUD (hudStats). This pill is the
// one element marked data-arcade-safe-area, and it is a fixed box (Hud.module.css) so a map
// change never moves the camera fit.
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useCleanLevel } from "./useCleanLevel";
import styles from "./Hud.module.css";

const NAMES = ["Park", "City", "Beach"] as const;

export default function MapHud() {
   const { config } = useCleanLevel();
   const delivering = useArcadeStore((s) => s.stats.delivering ?? 0);
   const kind = useArcadeStore((s) => s.stats.kind ?? 0);
   const map = useArcadeStore((s) => s.stats.map ?? 1);
   const name = NAMES[map - 1] ?? NAMES[0];
   return (
      <div className={styles.panel} data-arcade-safe-area="" role="status" aria-live="polite">
         <div className={styles.pill}>{config.delivery && delivering ? "Return to pad" : config.matching ? ({ 0: "Bottle / bag", 2: "Can / banana" } as Record<number, string>)[kind] ?? name : name}</div>
      </div>
   );
}
