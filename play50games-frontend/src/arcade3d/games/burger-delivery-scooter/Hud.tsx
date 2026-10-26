"use client";
import { useLevel } from "../../core/level";
import { useArcadeStore } from "../../core/useArcadeStore";
import type { BurgerLevel } from "./levels";
import styles from "./Hud.module.css";
export default function Hud() {
   const carrying = useArcadeStore((s) => s.stats.carrying ?? 0);
   const average = useArcadeStore((s) => s.stats.average ?? 100);
   const required = useLevel<BurgerLevel>().config.qualityMin;
   const progress = useArcadeStore((s) => s.stats.stop ?? 0);
   return <div className={styles.card} data-arcade-safe-area>
      <strong>{carrying ? "Deliver to the green ring" : "Return to the pink shop"}</strong>
      <span>Average {Math.floor(average)} / {required} required</span>
      <div className={styles.track} role="progressbar" aria-label="Stopped in delivery pad" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
         <i style={{ width: Math.round(progress * 100) + "%" }} />
      </div>
   </div>;
}
