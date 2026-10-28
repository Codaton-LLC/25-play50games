"use client";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";
import { useDeliveryLevel } from "./useDeliveryLevel";
import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";

function GameHud() {
   const battery = useArcadeStore((s) => s.stats.battery ?? 100);
   const loading = useArcadeStore((s) => s.stats.loading ?? 0);
   const carrying = useArcadeStore((s) => s.stats.carrying ?? 0);
   const fragile = useArcadeStore((s) => s.stats.fragile ?? 0);
   const feedback = useArcadeStore((s) => s.stats.feedback ?? 0);
   const { config } = useDeliveryLevel();
   // levels 4-5 start above 100 units: show the share of this level's full charge, never over 100 %
   const percent = Math.min(100, Math.round((100 * battery) / config.battery));
   return <div className={styles.panel} data-arcade-safe-area>
      <div className={battery <= 20 ? styles.low : styles.battery}>Battery {percent}% <progress aria-label="Battery" max={100} value={percent} /></div>
      <div aria-live="polite">{loading > 0 ? `Loading ${loading}% — hold still` : carrying ? fragile ? `Fragile — aim for ${config.fragilePrecision}+ precision` : "Follow the blue rooftop beacon" : "Return to depot · hover to reload"}</div>
      <div className={styles.hint}>{feedback === 1 ? "Delivered!" : feedback === 2 ? "Parcel missed — reload" : feedback === 3 ? "Tower contact!" : "Brake early · line up the landing cross"}</div>
   </div>;
}

/** The game's HUD plus the core 📷 camera-view button (core/camera). */
export default function Hud() {
   return (
      <>
         <CameraViewButton />
         <GameHud />
      </>
   );
}
