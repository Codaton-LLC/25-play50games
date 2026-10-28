"use client";

import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import styles from "./Hud.module.css";
import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";

function Marks({ n, total, kind }: { n: number; total: number; kind: "mitt" | "dot" }) {
   const on = Math.max(0, Math.min(total, n));
   const cells = [];
   for (let i = 0; i < total; i++) {
      const full = i < on;
      cells.push(
         <span
            key={i}
            className={kind === "mitt" ? (full ? styles.mitt : `${styles.mitt} ${styles.empty}`) : (full ? styles.dot : `${styles.dot} ${styles.dotOff}`)}
         />,
      );
   }
   return <span className={styles.group}>{cells}</span>;
}

function GameHud() {
   const health = useArcadeStore((s) => s.stats.health ?? 5);
   const ammo = useArcadeStore((s) => s.stats.ammo ?? 0);
   return (
      <div className={styles.panel} data-arcade-safe-area>
         <Marks n={health} total={5} kind="mitt" />
         <Marks n={ammo} total={3} kind="dot" />
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
