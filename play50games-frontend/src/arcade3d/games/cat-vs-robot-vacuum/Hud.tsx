"use client";

import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";
import { HintLine } from "@/arcade3d/core/hud/HintLine";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { GUIDE } from "./guide";
import styles from "./Hud.module.css";

/** The hop state. The goal is the hint line's (guide.ts); treats and the score are the shell's chips. */
function GameHud() {
   const ready = useArcadeStore((s) => (s.stats.hop ?? 1) > 0);
   return (
      <div className={styles.panel} data-arcade-safe-area>
         <span className={ready ? styles.ready : styles.cooling}>{ready ? "Hop ready" : "Hop..."}</span>
      </div>
   );
}

/** The game's HUD plus the core 📷 camera-view button (core/camera). The goal panel is top-right,
 * the button bottom-right above the touch Hop, so they never overlap (390 x 844 checked). */
export default function Hud() {
   return (
      <>
         <CameraViewButton />
         <HintLine signal={GUIDE} />
         <GameHud />
      </>
   );
}
