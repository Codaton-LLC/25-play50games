"use client";

import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";
import { HintLine } from "@/arcade3d/core/hud/HintLine";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { GUIDE } from "./guide";
import styles from "./Hud.module.css";

/** Breath meter. Fires and Saved are the shell's stat chips; this is not a second clock. */
function GameHud() {
   const breath = useArcadeStore((s) => s.stats.breath ?? 100);
   const width = Math.max(0, Math.min(100, breath));
   return (
      <div className={`${styles.breath} ${width < 35 ? styles.low : ""}`} data-arcade-safe-area>
         <span>{width < 35 ? `Low breath ${width}` : `Breath ${width}`}</span>
         <div className={styles.track} aria-hidden>
            <div className={styles.fill} style={{ width: `${width}%` }} />
         </div>
      </div>
   );
}

/** The game's HUD, the target hint line (guide.ts) and the core 📷 camera-view button (core/camera). */
export default function Hud() {
   return (
      <>
         <CameraViewButton />
         <HintLine signal={GUIDE} />
         <GameHud />
      </>
   );
}
