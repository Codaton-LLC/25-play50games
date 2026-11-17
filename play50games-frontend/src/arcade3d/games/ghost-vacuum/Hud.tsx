"use client";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";
import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";
function GameHud() {
   const last = useArcadeStore((s) => s.stats.last ?? 90);
   const waiting = useArcadeStore((s) => s.stats.waiting ?? 0);
   return <div className={styles.panel} data-arcade-safe-area>{last > 0 ? `Last ghost in ${last}s` : waiting ? "Last ghost waiting" : "Light → stun → hold Vacuum"}</div>;
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
