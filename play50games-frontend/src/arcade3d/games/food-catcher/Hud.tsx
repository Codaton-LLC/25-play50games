"use client";

// The shell already shows score, time, lives and the combo count. This badge is only the 2x mark.
// It stays mounted and laid out for the whole run and is only made invisible under a 5 combo:
// its rect (data-arcade-safe-area) never changes, so the camera fit never moves mid-run.
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { COMBO_DOUBLE_AT } from "./rules";
import styles from "./Hud.module.css";

export default function FoodHud() {
   const doubled = useArcadeStore((s) => (s.stats.combo ?? 0) >= COMBO_DOUBLE_AT);
   return (
      <p className={doubled ? styles.badge : `${styles.badge} ${styles.off}`} data-arcade-safe-area role="status">
         2× combo
      </p>
   );
}
