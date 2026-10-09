"use client";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

export default function Hud() {
   const battery = useArcadeStore((s) => s.stats.battery ?? 100);
   const loading = useArcadeStore((s) => s.stats.loading ?? 0);
   const carrying = useArcadeStore((s) => s.stats.carrying ?? 0);
   const fragile = useArcadeStore((s) => s.stats.fragile ?? 0);
   const feedback = useArcadeStore((s) => s.stats.feedback ?? 0);
   return <div className={styles.panel} data-arcade-safe-area>
      <div className={battery <= 20 ? styles.low : styles.battery}>Battery {battery}% <progress aria-label="Battery" max={100} value={battery} /></div>
      <div aria-live="polite">{loading > 0 ? `Loading ${loading}% — hold still` : carrying ? fragile ? "Fragile — aim for 40+ precision" : "Follow the blue rooftop beacon" : "Return to depot · hover to reload"}</div>
      <div className={styles.hint}>{feedback === 1 ? "Delivered!" : feedback === 2 ? "Parcel missed — reload" : feedback === 3 ? "Tower contact!" : "Brake early · line up the landing cross"}</div>
   </div>;
}
