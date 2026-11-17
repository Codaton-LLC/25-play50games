"use client";

import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { floorColor } from "./looks";
import styles from "./Hud.module.css";

/**
 * The key card: the room on the bag (colour + digits, never colour alone), what to do next, and the
 * bag's own 30 s clock (gold above half: the +40). Score, time, lives, Bags and Floor are the shell's chips.
 */
function GameHud() {
   const card = useArcadeStore((s) => s.stats.card ?? 0);
   const cardFloor = useArcadeStore((s) => s.stats.cardFloor ?? 1);
   const floor = useArcadeStore((s) => s.stats.floor ?? 1);
   const carrying = useArcadeStore((s) => (s.stats.carrying ?? 0) > 0);
   const riding = useArcadeStore((s) => (s.stats.riding ?? 0) > 0);
   const clock = useArcadeStore((s) => s.stats.clock ?? 0);
   if (!card) return null;
   const color = floorColor(cardFloor);
   const hint = !carrying ? "Take the bag at the desk" : riding ? "Riding up..." : floor !== cardFloor ? `Elevator to floor ${cardFloor}` : `Door ${card}`;
   const share = Math.max(0, Math.min(1, clock / 30));
   return (
      <div className={styles.card} data-arcade-safe-area>
         <div className={styles.top}>
            <span className={styles.band} style={{ background: color }} aria-hidden />
            <span className={styles.label}>Key card</span>
            <span className={styles.room}>{card}</span>
         </div>
         <span className={styles.hint}>{hint}</span>
         {carrying && (
            <div className={styles.track} aria-hidden>
               <div className={share > 0.5 ? styles.fillQuick : styles.fill} style={{ width: `${share * 100}%` }} />
            </div>
         )}
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
