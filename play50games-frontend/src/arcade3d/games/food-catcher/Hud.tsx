"use client";

// The shell already shows score, time, lives and the combo count. This badge is only the 2x mark.
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { COMBO_DOUBLE_AT } from "./rules";
import styles from "./Hud.module.css";

export default function FoodHud() {
   const combo = useArcadeStore((s) => s.stats.combo ?? 0);
   if (combo < COMBO_DOUBLE_AT) return null;
   return (
      <p className={styles.badge} data-arcade-safe-area role="status">
         2× combo
      </p>
   );
}
