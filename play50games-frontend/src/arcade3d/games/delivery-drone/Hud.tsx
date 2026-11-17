"use client";
import { useSafeArea, type SafeArea } from "@/arcade3d/core/safeArea";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";
import { useDeliveryLevel } from "./useDeliveryLevel";
import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";

/**
 * Top of the battery panel (px): its CSS spot (4.5rem, 3.25rem on short screens), or 8 px under
 * every shell HUD rect that starts above it (the chips wrap to a second row on a phone).
 */
export function panelTop(area: SafeArea): number {
   const minimum = area.height > 0 && area.height <= 520 ? 52 : 72;
   let bottom = minimum - 8;
   for (const rect of area.hud) if (rect.top < minimum - 1) bottom = Math.max(bottom, rect.bottom);
   return Math.round(bottom + 8);
}

function GameHud() {
   const { config } = useDeliveryLevel();
   // before the first played frame the stat is unset: a full charge, not 100 of a 160 / 230 battery
   const battery = useArcadeStore((s) => s.stats.battery ?? config.battery);
   const loading = useArcadeStore((s) => s.stats.loading ?? 0);
   const carrying = useArcadeStore((s) => s.stats.carrying ?? 0);
   const fragile = useArcadeStore((s) => s.stats.fragile ?? 0);
   const feedback = useArcadeStore((s) => s.stats.feedback ?? 0);
   // levels 4-5 start above 100 units: show the share of this level's full charge, never over 100 %
   const percent = Math.min(100, Math.round((100 * battery) / config.battery));
   const top = useSafeArea(panelTop);
   return <div className={styles.panel} style={{ top }} data-arcade-safe-area>
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
