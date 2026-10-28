"use client";

import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";

/** Breath meter. Fires and Saved are the shell's stat chips; this is not a second clock. */
function GameHud() {
   const breath = useArcadeStore((s) => s.stats.breath ?? 100);
   const width = Math.max(0, Math.min(100, breath));
   return (
      <div className={styles.breath} data-arcade-safe-area>
         <span>Breath {width}</span>
         <div className={styles.track} aria-hidden>
            <div className={styles.fill} style={{ width: `${width}%` }} />
         </div>
      </div>
   );
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
