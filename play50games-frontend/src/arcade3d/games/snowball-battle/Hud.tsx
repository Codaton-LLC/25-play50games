"use client";

import { useSafeArea, type SafeArea } from "@/arcade3d/core/safeArea";
import { useCoarsePointer } from "@/arcade3d/core/TouchControls";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { HintLine } from "@/arcade3d/core/hud/HintLine";
import { hintFor } from "./guide";
import styles from "./Hud.module.css";
import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";

function Marks({ n, total, kind }: { n: number; total: number; kind: "mitt" | "dot" }) {
   const on = Math.max(0, Math.min(total, n));
   const cells = [];
   for (let i = 0; i < total; i++) {
      const full = i < on;
      cells.push(
         <span
            key={`${i}-${full ? 1 : 0}`}
            className={kind === "mitt" ? (full ? styles.mitt : `${styles.mitt} ${styles.empty}`) : (full ? `${styles.dot} ${styles.dotNew}` : `${styles.dot} ${styles.dotOff}`)}
         />,
      );
   }
   return <span className={styles.group}>{cells}</span>;
}

/** Default top of the mittens panel (px); it moves below the shell chips when they wrap (a phone). */
export const PANEL_TOP = 58;

/** Below every shell HUD rect that starts above the panel (the chips wrap to two rows at 390 px). */
export function panelTop(area: SafeArea): number {
   let bottom = PANEL_TOP - 8;
   for (const rect of area.hud) if (rect.top < PANEL_TOP - 1) bottom = Math.max(bottom, rect.bottom);
   return Math.round(bottom + 8);
}

function GameHud() {
   const health = useArcadeStore((s) => s.stats.health ?? 5);
   const ammo = useArcadeStore((s) => s.stats.ammo ?? 0);
   const touch = useCoarsePointer();
   const hint = hintFor(ammo, health, touch);
   const top = useSafeArea(panelTop);
   return (
      <>
         <HintLine text={hint.text} tone={hint.tone} />
         <div className={styles.panel} style={{ top }} data-arcade-safe-area>
            <Marks n={health} total={5} kind="mitt" />
            <Marks n={ammo} total={3} kind="dot" />
         </div>
      </>
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
