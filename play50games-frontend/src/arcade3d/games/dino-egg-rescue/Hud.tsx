"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";
import { useDinoLevel } from "./useDinoLevel";
import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";

function GameHud() {
   const maxStack = useDinoLevel().config.maxStack;
   const carried = useArcadeStore((s) => s.stats.carried ?? 0);
   const golden = useArcadeStore((s) => (s.stats.golden ?? 0) > 0);
   const dashReady = useArcadeStore((s) => (s.stats.dash ?? 1) > 0);

   return (
      <div
         className={styles.panel}
         data-arcade-safe-area=""
         role="status"
         aria-live="polite"
      >
         <div className={styles.pill} aria-hidden="true">
            <span>
               Eggs: <span className={styles.eggCount}>{carried}/{maxStack}</span>
            </span>
            {golden && <span className={styles.goldenBadge}>⭐ Gold</span>}
            <span className={dashReady ? styles.dashBadge : styles.dashWait}>
               {dashReady ? "⚡ Dash" : "⏳ CD"}
            </span>
         </div>
      </div>
   );
}

/** The game's HUD plus the core 📷 camera-view button (core/camera). */
export default function DinoHud() {
   return (
      <>
         <CameraViewButton />
         <GameHud />
      </>
   );
}
