"use client";

import { useShallow } from "zustand/react/shallow";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

export default function Hud() {
   const stats = useArcadeStore(
      useShallow((s) => ({
         nectar: s.stats.nectar ?? 0,
         stamina: s.stats.stamina ?? 100,
         phase: s.phase,
      }))
   );

   if (stats.phase !== "playing" && stats.phase !== "countdown" && stats.phase !== "paused") {
      return null;
   }

   const carried = Math.min(3, Math.max(0, stats.nectar));
   const stamina = Math.min(100, Math.max(0, stats.stamina));

   return (
      <div className={styles.panel} data-arcade-safe-area>
         <div className={styles.nectarGroup} title="Carried Nectar">
            <span>Nectar:</span>
            {[0, 1, 2].map((i) => (
               <div
                  key={i}
                  className={`${styles.nectarSlot} ${i < carried ? styles.nectarFilled : ""}`}
               />
            ))}
         </div>

         <div className={styles.staminaContainer} title="Boost Stamina">
            <span>Stamina:</span>
            <div className={styles.staminaTrack}>
               <div
                  className={`${styles.staminaBar} ${stamina <= 0 ? styles.staminaLock : ""}`}
                  style={{ width: `${stamina}%` }}
               />
            </div>
         </div>

         {carried === 3 && <span className={styles.statusPill}>Full! Fly to Hive</span>}
      </div>
   );
}
