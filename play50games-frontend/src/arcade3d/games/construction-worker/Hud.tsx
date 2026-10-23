"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { PIECE_NAME } from "./rules";
import styles from "./Hud.module.css";

const BUILDING = ["House", "Shop", "Tower"];

/** The blueprint line. The shell draws time, stability, building and swing. */
export function Hud() {
   const piece = useArcadeStore((s) => s.stats.piece ?? 1);
   const building = useArcadeStore((s) => s.stats.building ?? 1);
   const name = PIECE_NAME[Math.min(4, Math.max(0, piece - 1))] ?? "Slab";
   const site = BUILDING[Math.min(2, Math.max(0, building - 1))] ?? "House";
   return (
      <div className={styles.slot} data-arcade-safe-area>
         <p className={styles.pill}>
            {site}: next <span className={styles.name}>{name}</span>
         </p>
      </div>
   );
}
